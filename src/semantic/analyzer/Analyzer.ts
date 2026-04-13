import { Expr, Stmt, LiteralExpr, IdentifierExpr, UnaryExpr, BinaryExpr, GroupExpr, AssignExpr, VariableStmt, ArrayExpr } from "../../ast"
import { AndroType, Primitive, TypeKind, SymbolKind, SymbolDefinition, Array } from "../types"
import { TypeChecker } from "../TypeChecker"
import { AnalyzerContext, AnalyzerError, createContext } from "./types"
import { SemanticErrorHandler } from "../SemanticError"
import { ScopeStack } from "../ScopeStack"

export class Analyzer {
  private errors: SemanticErrorHandler
  private scopeStack: ScopeStack
  private context: AnalyzerContext
  private inLoop: boolean = false
  private inFunction: boolean = false
  private expectedReturnType: AndroType = Primitive.void()
  private hasReachableReturn: boolean = false

  constructor(scopeStack?: ScopeStack, errors?: SemanticErrorHandler) {
    this.errors = errors || new SemanticErrorHandler()
    this.scopeStack = scopeStack || new ScopeStack()
    this.context = createContext()
  }

  private report(code: string, message: string, line: number, column: number) {
    this.errors.report(`[${code}] ${message}`, line, column)
  }

  private getLineColumn(node: { line?: number; column?: number }): [number, number] {
    return [node.line ?? 0, node.column ?? 0]
  }

  enterGlobalScope(): void {
    this.scopeStack.enter("global")
  }

  exitGlobalScope(): void {
    this.scopeStack.exit()
  }

  enterScope(kind: "function" | "block" | "class"): void {
    this.scopeStack.enter(kind)
  }

  exitScope(): void {
    this.scopeStack.exit()
  }

  analyzeProgram(statements: Stmt[]): void {
    for (const stmt of statements) {
      this.analyzeStatement(stmt)
    }
  }

  analyzeStatement(stmt: Stmt): void {
    switch (stmt.kind) {
      case "ExpressionStmt":
        this.analyzeExpression(stmt.expression)
        break

      case "BlockStmt":
        this.enterScope("block")
        for (const s of stmt.statements) {
          this.analyzeStatement(s)
        }
        this.exitScope()
        break

      case "VariableStmt":
        this.analyzeVariable(stmt)
        break

      case "IfStmt":
        this.analyzeIf(stmt)
        break

      case "WhileStmt":
        this.analyzeWhile(stmt)
        break

      case "BreakStmt":
        this.analyzeBreak(stmt)
        break

      case "ContinueStmt":
        this.analyzeContinue(stmt)
        break

      case "FunctionStmt":
        this.analyzeFunction(stmt)
        break

      case "ReturnStmt":
        this.analyzeReturn(stmt)
        break

      default:
        break
    }
  }

  analyzeExpression(expr: Expr): AndroType {
    switch (expr.kind) {
      case "Literal":
        return this.visitLiteral(expr)

      case "Identifier":
        return this.visitIdentifier(expr)

      case "Assign":
        return this.visitAssign(expr)

      case "Group":
        return this.analyzeExpression(expr.expression)

      case "Unary":
        return this.visitUnary(expr)

      case "Binary":
      case "Logical":
        return this.visitBinary(expr as BinaryExpr)

      case "Call":
        return this.visitCall(expr)

      case "Member":
        return this.visitMember(expr)

      case "Index":
        return this.visitIndex(expr)

      case "Array":
        return this.visitArrayLiteral(expr)

      case "ArrowFunction":
        return this.visitArrowFunction(expr)

      case "Conditional":
        return this.visitConditional(expr)

      case "NullishCoalescing":
        return this.visitNullishCoalescing(expr)

      default:
        return Primitive.unknown()
    }
  }

  visitLiteral(expr: LiteralExpr): AndroType {
    const value = expr.value

    if (value === null) {
      return Primitive.null()
    }

    if (typeof value === "boolean") {
      return Primitive.bool()
    }

    if (typeof value === "string") {
      return Primitive.string()
    }

    if (typeof value === "number") {
      if (Number.isInteger(value)) {
        return Primitive.int()
      }
      return Primitive.float()
    }

    return Primitive.unknown()
  }

  visitIdentifier(expr: IdentifierExpr): AndroType {
    const name = expr.name.value as string
    const [line, column] = this.getLineColumn(expr.name)

    const symbol = this.scopeStack.lookup(name)

    if (!symbol) {
      this.report("UNDEFINED_VARIABLE", `variable '${name}' is not defined`, line, column)
      return Primitive.unknown()
    }

    return symbol.type
  }

  visitAssign(expr: AssignExpr): AndroType {
    const targetExpr = expr.name
    const operator = expr.operator?.value as string | undefined
    const [line, column] = this.getLineColumn(targetExpr)

    if (targetExpr.kind === "Identifier") {
      return this.assignToIdentifier(targetExpr, expr.value, operator, line, column)
    }

    if (targetExpr.kind === "Index") {
      return this.assignToIndex(targetExpr, expr.value, operator, line, column)
    }

    this.report("INVALID_ASSIGNMENT", "assignment target must be an identifier or index expression", line, column)
    return Primitive.unknown()
  }

  private assignToIdentifier(target: any, valueExpr: any, operator: string | undefined, line: number, column: number): AndroType {
    const name = target.name.value as string

    const symbol = this.scopeStack.lookup(name)

    if (!symbol) {
      this.report("UNDEFINED_VARIABLE", `variable '${name}' is not defined`, line, column)
      return Primitive.unknown()
    }

    if (!symbol.mutable) {
      this.report("CANNOT_ASSIGN", `cannot reassign '${name}': it is declared with 'val' and is not mutable`, line, column)
      return Primitive.unknown()
    }

    const valueType = this.analyzeExpression(valueExpr)

    if (operator && ["+=", "-=", "*=", "/=", "%="].includes(operator)) {
      const validLeft = TypeChecker.isSameType(symbol.type, Primitive.int()) || TypeChecker.isSameType(symbol.type, Primitive.float())
      if (!validLeft && !TypeChecker.isUnknown(symbol.type)) {
        this.report("TYPE_MISMATCH", `compound assignment '${operator}' requires int or float, got '${TypeChecker.toString(symbol.type)}'`, line, column)
      }
      if (!TypeChecker.isAssignableTo(valueType, symbol.type) && !TypeChecker.isUnknown(valueType)) {
        this.report("TYPE_MISMATCH", `cannot assign '${TypeChecker.toString(valueType)}' to '${TypeChecker.toString(symbol.type)}'`, line, column)
      }
    } else {
      if (!TypeChecker.isAssignableTo(valueType, symbol.type) && !TypeChecker.isUnknown(valueType)) {
        this.report(
          "TYPE_MISMATCH",
          `cannot assign '${TypeChecker.toString(valueType)}' to '${TypeChecker.toString(symbol.type)}'`,
          line,
          column
        )
      }
    }

    return symbol.type
  }

  private assignToIndex(target: any, valueExpr: any, operator: string | undefined, line: number, column: number): AndroType {
    const objectType = this.analyzeExpression(target.object)
    this.analyzeExpression(target.index)

    if (!TypeChecker.isArray(objectType)) {
      this.report("INVALID_ASSIGNMENT", `cannot assign to index of non-array type '${TypeChecker.toString(objectType)}'`, line, column)
      return Primitive.unknown()
    }

    const symbol = this.scopeStack.lookup((target.object as any).name?.value as string)
    if (symbol && !symbol.mutable) {
      this.report("CANNOT_ASSIGN", `cannot modify array: it is declared with 'val' and is not mutable`, line, column)
      return Primitive.unknown()
    }

    const valueType = this.analyzeExpression(valueExpr)
    const elementType = (objectType as any).elementType

    if (operator && ["+=", "-=", "*=", "/=", "%="].includes(operator)) {
      const validElement = TypeChecker.isSameType(elementType, Primitive.int()) || TypeChecker.isSameType(elementType, Primitive.float())
      if (!validElement && !TypeChecker.isUnknown(elementType)) {
        this.report("TYPE_MISMATCH", `compound assignment '${operator}' requires int or float, got '${TypeChecker.toString(elementType)}'`, line, column)
      }
      if (!TypeChecker.isAssignableTo(valueType, elementType) && !TypeChecker.isUnknown(valueType)) {
        this.report("TYPE_MISMATCH", `cannot assign '${TypeChecker.toString(valueType)}' to '${TypeChecker.toString(elementType)}'`, line, column)
      }
    } else {
      if (!TypeChecker.isAssignableTo(valueType, elementType) && !TypeChecker.isUnknown(valueType)) {
        this.report(
          "TYPE_MISMATCH",
          `cannot assign '${TypeChecker.toString(valueType)}' to array element of type '${TypeChecker.toString(elementType)}'`,
          line,
          column
        )
      }
    }

    return elementType
  }

  visitUnary(expr: UnaryExpr): AndroType {
    const operandType = this.analyzeExpression(expr.right)
    const operator = expr.operator.value as string
    const [line, column] = this.getLineColumn(expr.operator)

    if (operator === "!") {
      if (!TypeChecker.isSameType(operandType, Primitive.bool()) && !TypeChecker.isUnknown(operandType)) {
        this.report(
          "TYPE_MISMATCH",
          `Unary '!' requires boolean, got '${TypeChecker.toString(operandType)}'`,
          line,
          column
        )
      }
      return Primitive.bool()
    }

    if (operator === "-" || operator === "+") {
      if (
        !TypeChecker.isSameType(operandType, Primitive.int()) &&
        !TypeChecker.isSameType(operandType, Primitive.float()) &&
        !TypeChecker.isUnknown(operandType)
      ) {
        this.report(
          "TYPE_MISMATCH",
          `Unary '${operator}' requires int or float, got '${TypeChecker.toString(operandType)}'`,
          line,
          column
        )
      }
      return operandType
    }

    return Primitive.unknown()
  }

  visitBinary(expr: BinaryExpr): AndroType {
    const leftType = this.analyzeExpression(expr.left)
    const rightType = this.analyzeExpression(expr.right)
    const operator = expr.operator.value as string
    const [line, column] = this.getLineColumn(expr.operator)

    const arithmeticOps = ["+", "-", "*", "/", "%"]
    const comparisonOps = ["==", "!=", "<", ">", "<=", ">="]
    const logicalOps = ["&&", "||"]

    if (arithmeticOps.includes(operator)) {
      return this.checkArithmetic(operator, leftType, rightType, line, column)
    }

    if (comparisonOps.includes(operator)) {
      return this.checkComparison(operator, leftType, rightType, line, column)
    }

    if (logicalOps.includes(operator)) {
      return this.checkLogical(operator, leftType, rightType, line, column)
    }

    return Primitive.unknown()
  }

  visitCall(expr: any): AndroType {
    const calleeType = this.analyzeExpression(expr.callee)
    const [line, column] = this.getLineColumn(expr.callee)

    const calleeName = expr.callee?.name?.value as string

    const argTypes: AndroType[] = []
    for (const arg of expr.args || []) {
      const argType = this.analyzeExpression(arg)
      argTypes.push(argType)
    }

    if (TypeChecker.isUnknown(calleeType)) {
      return Primitive.unknown()
    }

    if (!TypeChecker.isFunction(calleeType)) {
      this.report(
        "INVALID_CALL",
        `cannot call '${TypeChecker.toString(calleeType)}': not a function`,
        line,
        column
      )
      return Primitive.unknown()
    }

const paramTypes = calleeType.params
    const minParams = paramTypes.length

    if (argTypes.length > minParams && !calleeName) {
      this.report(
        "ARGUMENT_COUNT_MISMATCH",
        `expected ${minParams} arguments but got ${argTypes.length}`,
        line,
        column
      )
    }

    for (let i = 0; i < Math.min(argTypes.length, minParams); i++) {
      if (!TypeChecker.isAssignableTo(argTypes[i], paramTypes[i])) {
        this.report(
          "TYPE_MISMATCH",
          `argument ${i + 1}: expected '${TypeChecker.toString(paramTypes[i])}' but got '${TypeChecker.toString(argTypes[i])}'`,
          line,
          column
        )
      }
}

    return calleeType.returnType
  }

  visitMember(expr: any): AndroType {
    this.analyzeExpression(expr.object)
    return Primitive.unknown()
  }

  visitIndex(expr: any): AndroType {
    const objectType = this.analyzeExpression(expr.object)
    const [line, column] = this.getLineColumn(expr)

    this.analyzeExpression(expr.index)

    if (TypeChecker.isArray(objectType)) {
      return (objectType as any).elementType
    }

    if (!TypeChecker.isUnknown(objectType)) {
      this.report(
        "INVALID_INDEX",
        `cannot index into type '${TypeChecker.toString(objectType)}': not an array`,
        line,
        column
      )
    }

    return Primitive.unknown()
  }

  visitArrayLiteral(expr: ArrayExpr): AndroType {
    if (expr.elements.length === 0) {
      return Array.of(Primitive.any())
    }

    const elementTypes: AndroType[] = []
    for (const element of expr.elements) {
      const elementType = this.analyzeExpression(element)
      elementTypes.push(elementType)
    }

    let commonType = elementTypes[0]
    for (let i = 1; i < elementTypes.length; i++) {
      commonType = TypeChecker.commonType(commonType, elementTypes[i])
    }

    return Array.of(commonType)
  }

  private resolveTypeAnnotation(annotation: any): AndroType {
    const baseType = TypeChecker.fromKeyword(annotation.base.value as string) || Primitive.unknown()
    const dimensions = annotation.dimensions || 0

    let type: AndroType = baseType
    for (let i = 0; i < dimensions; i++) {
      type = Array.of(type)
    }

    return type
  }

  private checkArrayElementsType(elements: any[], expectedType: AndroType, declaredType: AndroType): void {
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      const elementLine = element.line ?? 0
      const elementColumn = element.column ?? 0

      let actualType: AndroType
      if (element.kind === "Literal") {
        actualType = this.visitLiteral(element)
      } else if (element.kind === "Array") {
        actualType = this.visitArrayLiteral(element)
      } else {
        actualType = this.analyzeExpression(element)
      }

      if (!TypeChecker.isAssignableTo(actualType, expectedType) && !TypeChecker.isUnknown(actualType)) {
        this.report(
          "TYPE_MISMATCH",
          `array element ${i + 1} has type '${TypeChecker.toString(actualType)}' which is not assignable to '${TypeChecker.toString(expectedType)}'`,
          elementLine,
          elementColumn
        )
      }
    }
  }

  visitArrowFunction(expr: any): AndroType {
    // Save current state
    const savedInFunction = this.inFunction
    const savedReturnType = this.expectedReturnType
    const savedHasReturn = this.hasReachableReturn

    // Enter function scope for arrow function
    this.inFunction = true
    this.expectedReturnType = expr.returnType
      ? this.resolveTypeAnnotation(expr.returnType)
      : Primitive.unknown()
    this.hasReachableReturn = false
    this.enterScope("function")

    // Register parameters
    for (const param of expr.params || []) {
      const paramName = param.name.value as string
      const paramType = param.type
        ? this.resolveTypeAnnotation(param.type)
        : Primitive.unknown()

      const symbol: SymbolDefinition = {
        name: paramName,
        type: paramType,
        kind: SymbolKind.Param,
        mutable: true,
        ast: param,
        line: param.name.line ?? 0,
        column: param.name.column ?? 0,
      }

      try {
        this.scopeStack.current.define(symbol)
      } catch (e) {
        // Ignore duplicate param names (will be caught by parser)
      }
    }

    // Analyze body
    let actualReturnType: AndroType = Primitive.unknown()
    if (expr.body.kind === "BlockStmt") {
      this.analyzeStatement(expr.body)
      actualReturnType = this.expectedReturnType
    } else {
      actualReturnType = this.analyzeExpression(expr.body)
      this.hasReachableReturn = true
    }

    // Exit function scope
    this.exitScope()

    // Restore state
    this.inFunction = savedInFunction
    this.expectedReturnType = savedReturnType
    this.hasReachableReturn = savedHasReturn

    // Return function type
    const paramTypes = (expr.params || []).map((p: any) => {
      return p.type
        ? this.resolveTypeAnnotation(p.type)
        : Primitive.unknown()
    })

    const returnType = expr.returnType
      ? this.resolveTypeAnnotation(expr.returnType)
      : actualReturnType

    return {
      kind: "function",
      params: paramTypes,
      returnType: returnType,
    } as any
  }

  private checkArithmetic(operator: string, left: AndroType, right: AndroType, line: number, column: number): AndroType {
    const validLeft = TypeChecker.isSameType(left, Primitive.int()) || TypeChecker.isSameType(left, Primitive.float())
    const validRight = TypeChecker.isSameType(right, Primitive.int()) || TypeChecker.isSameType(right, Primitive.float())

    if (!validLeft && !TypeChecker.isUnknown(left)) {
      this.report("TYPE_MISMATCH", `Left operand of '${operator}' must be int or float, got '${TypeChecker.toString(left)}'`, line, column)
    }

    if (!validRight && !TypeChecker.isUnknown(right)) {
      this.report("TYPE_MISMATCH", `Right operand of '${operator}' must be int or float, got '${TypeChecker.toString(right)}'`, line, column)
    }

    if (TypeChecker.isUnknown(left) || TypeChecker.isUnknown(right)) {
      return Primitive.unknown()
    }

    if (TypeChecker.isSameType(left, Primitive.float()) || TypeChecker.isSameType(right, Primitive.float())) {
      return Primitive.float()
    }

    return Primitive.int()
  }

  private checkComparison(operator: string, left: AndroType, right: AndroType, line: number, column: number): AndroType {
    if (operator === "==" || operator === "!=") {
      return Primitive.bool()
    }

    const validLeft = TypeChecker.isSameType(left, Primitive.int()) || TypeChecker.isSameType(left, Primitive.float())
    const validRight = TypeChecker.isSameType(right, Primitive.int()) || TypeChecker.isSameType(right, Primitive.float())

    if (!validLeft && !TypeChecker.isUnknown(left)) {
      this.report("TYPE_MISMATCH", `Left operand of '${operator}' must be int or float`, line, column)
    }

    if (!validRight && !TypeChecker.isUnknown(right)) {
      this.report("TYPE_MISMATCH", `Right operand of '${operator}' must be int or float`, line, column)
    }

    return Primitive.bool()
  }

  private checkLogical(operator: string, left: AndroType, right: AndroType, line: number, column: number): AndroType {
    if (!TypeChecker.isSameType(left, Primitive.bool()) && !TypeChecker.isUnknown(left)) {
      this.report("TYPE_MISMATCH", `Left operand of '${operator}' must be bool, got '${TypeChecker.toString(left)}'`, line, column)
    }

    if (!TypeChecker.isSameType(right, Primitive.bool()) && !TypeChecker.isUnknown(right)) {
      this.report("TYPE_MISMATCH", `Right operand of '${operator}' must be bool, got '${TypeChecker.toString(right)}'`, line, column)
    }

    return Primitive.bool()
  }

  visitConditional(expr: any): AndroType {
    const conditionType = this.analyzeExpression(expr.condition)
    const [line, column] = this.getLineColumn(expr.condition)

    if (!TypeChecker.isSameType(conditionType, Primitive.bool()) && !TypeChecker.isUnknown(conditionType)) {
      this.report(
        "TYPE_MISMATCH",
        `ternary condition must be bool, got '${TypeChecker.toString(conditionType)}'`,
        line,
        column
      )
    }

    const consequentType = this.analyzeExpression(expr.consequent)
    const alternateType = this.analyzeExpression(expr.alternate)

    return TypeChecker.commonType(consequentType, alternateType)
  }

  visitNullishCoalescing(expr: any): AndroType {
    const leftType = this.analyzeExpression(expr.left)
    const rightType = this.analyzeExpression(expr.right)

    return TypeChecker.commonType(leftType, rightType)
  }

  analyzeVariable(stmt: VariableStmt): AndroType {
    const name = stmt.name.value as string
    const [line, column] = this.getLineColumn(stmt.name)

    let inferredType = Primitive.unknown()
    if (stmt.initializer) {
      inferredType = this.analyzeExpression(stmt.initializer)
    }

    const declaredType = stmt.typeAnnotation
      ? this.resolveTypeAnnotation(stmt.typeAnnotation)
      : inferredType

    if (stmt.typeAnnotation && stmt.initializer) {
      if (!TypeChecker.isAssignableTo(inferredType, declaredType) && !TypeChecker.isUnknown(inferredType)) {
        if (TypeChecker.isArray(declaredType) && stmt.initializer.kind === "Array") {
          const elementType = (declaredType as any).elementType
          this.checkArrayElementsType(stmt.initializer.elements, elementType, declaredType)
        } else {
          this.report(
            "TYPE_MISMATCH",
            `cannot initialize '${name}' of type '${TypeChecker.toString(declaredType)}' with value of type '${TypeChecker.toString(inferredType)}'`,
            line,
            column
          )
        }
      }
    }

    const existing = this.scopeStack.current.lookupLocal(name)
    if (existing) {
      this.report("ALREADY_DECLARED", `variable '${name}' is already declared in this scope`, line, column)
    } else {
      const mutable = stmt.declarationType === "var"
      const symbol: SymbolDefinition = {
        name,
        type: declaredType,
        kind: SymbolKind.Variable,
        mutable,
        ast: stmt,
        line,
        column,
      }

      try {
        this.scopeStack.current.define(symbol)
      } catch (e) {
        if (e instanceof Error) {
          this.report("ALREADY_DECLARED", e.message, line, column)
        }
      }
    }

    return declaredType
  }

  analyzeFunction(stmt: any): void {
    const name = stmt.name.value as string
    const [line, column] = this.getLineColumn(stmt.name)

    // Determine return type
    const hasExplicitReturnType = !!stmt.returnType
    const returnType = stmt.returnType
      ? this.resolveTypeAnnotation(stmt.returnType)
      : Primitive.unknown()

    // Build function type for symbol table
    const paramTypes = (stmt.params || []).map((p: any) => {
      return p.type
        ? this.resolveTypeAnnotation(p.type)
        : Primitive.unknown()
    })

    // Check for duplicate function name
    if (this.scopeStack.current.kind === "global") {
      const existing = this.scopeStack.current.lookupLocal(name)
      if (existing) {
        this.report("ALREADY_DECLARED", `function '${name}' is already declared in this scope`, line, column)
      }
    }

    // Create function symbol BEFORE entering scope (for recursion)
    const funcSymbol: SymbolDefinition = {
      name,
      type: { kind: "function", params: paramTypes, returnType } as any,
      kind: SymbolKind.Function,
      mutable: false,
      ast: stmt,
      line,
      column,
    }

    // Register function in current scope (allows recursion)
    try {
      this.scopeStack.current.define(funcSymbol)
    } catch (e) {
      if (e instanceof Error) {
        this.report("ALREADY_DECLARED", e.message, line, column)
      }
    }

    // Enter function scope
    const savedInFunction = this.inFunction
    const savedReturnType = this.expectedReturnType
    const savedHasReturn = this.hasReachableReturn

    this.inFunction = true
    this.expectedReturnType = returnType
    this.hasReachableReturn = false
    this.enterScope("function")

    // Register parameters
    for (const param of stmt.params || []) {
      const paramName = param.name.value as string
      const paramType = param.type
        ? TypeChecker.fromKeyword(param.type.value as string) || Primitive.unknown()
        : Primitive.unknown()

      const symbol: SymbolDefinition = {
        name: paramName,
        type: paramType,
        kind: SymbolKind.Param,
        mutable: true,
        ast: param,
        line: param.name.line ?? 0,
        column: param.name.column ?? 0,
      }

      try {
        this.scopeStack.current.define(symbol)
      } catch (e) {
        if (e instanceof Error) {
          this.report("ALREADY_DECLARED", e.message, line, column)
        }
      }
    }

    // Analyze body
    this.analyzeStatement(stmt.body)

    // Check if all code paths return (only for functions with EXPLICIT non-void return type)
    if (hasExplicitReturnType) {
      const isVoid = TypeChecker.isSameType(this.expectedReturnType, Primitive.void())
      if (!isVoid && !this.hasReachableReturn) {
        this.report(
          "MISSING_RETURN",
          `function '${name}' should return '${TypeChecker.toString(this.expectedReturnType)}' but not all paths return a value`,
          line,
          column
        )
      }
    }

    // Exit function scope
    this.exitScope()
    this.inFunction = savedInFunction
    this.expectedReturnType = savedReturnType
    this.hasReachableReturn = savedHasReturn
  }

  analyzeReturn(stmt: any): void {
    if (!this.inFunction) {
      this.report("INVALID_RETURN", "return statement must be inside a function", stmt.line ?? 0, stmt.column ?? 0)
      return
    }

    this.hasReachableReturn = true

    if (stmt.value) {
      const valueType = this.analyzeExpression(stmt.value)

      // Check if return type matches expected
      if (!TypeChecker.isAssignableTo(valueType, this.expectedReturnType) && !TypeChecker.isUnknown(valueType)) {
        this.report(
          "TYPE_MISMATCH",
          `return type '${TypeChecker.toString(valueType)}' does not match expected type '${TypeChecker.toString(this.expectedReturnType)}'`,
          stmt.line ?? 0,
          stmt.column ?? 0
        )
      }
    } else {
      // Return without value - check if function is void
      const isVoid = TypeChecker.isSameType(this.expectedReturnType, Primitive.void())
      if (!isVoid) {
        this.report(
          "TYPE_MISMATCH",
          `return with no value in function that expects '${TypeChecker.toString(this.expectedReturnType)}'`,
          stmt.line ?? 0,
          stmt.column ?? 0
        )
      }
    }
  }

  analyzeIf(stmt: any): void {
    const condType = this.analyzeExpression(stmt.condition)

    if (!TypeChecker.isSameType(condType, Primitive.bool()) && !TypeChecker.isUnknown(condType)) {
      this.report(
        "TYPE_MISMATCH",
        `if condition must be boolean, got '${TypeChecker.toString(condType)}'`,
        stmt.condition.line ?? 0,
        stmt.condition.column ?? 0
      )
    }

    const hadReturnBefore = this.hasReachableReturn
    this.hasReachableReturn = false
    this.analyzeStatement(stmt.thenBranch)
    const thenHasReturn = this.hasReachableReturn

    let elseHasReturn = false
    if (stmt.elseBranch) {
      this.hasReachableReturn = false
      this.analyzeStatement(stmt.elseBranch)
      elseHasReturn = this.hasReachableReturn
    }

    // If both branches have return, the function returns
    this.hasReachableReturn = thenHasReturn && elseHasReturn
    if (!this.hasReachableReturn && stmt.elseBranch) {
      // Restore the return status if not both branches return
      this.hasReachableReturn = hadReturnBefore
    }
  }

  analyzeWhile(stmt: any): void {
    const condType = this.analyzeExpression(stmt.condition)

    if (!TypeChecker.isSameType(condType, Primitive.bool()) && !TypeChecker.isUnknown(condType)) {
      this.report(
        "TYPE_MISMATCH",
        `while condition must be boolean, got '${TypeChecker.toString(condType)}'`,
        stmt.condition.line ?? 0,
        stmt.condition.column ?? 0
      )
    }

    this.inLoop = true
    this.enterScope("block")
    this.analyzeStatement(stmt.body)
    this.exitScope()
    this.inLoop = false
  }

  analyzeBreak(stmt: any): void {
    if (!this.inLoop) {
      this.report("INVALID_BREAK", "break statement must be inside a loop", stmt.line ?? 0, stmt.column ?? 0)
    }
  }

  analyzeContinue(stmt: any): void {
    if (!this.inLoop) {
      this.report("INVALID_CONTINUE", "continue statement must be inside a loop", stmt.line ?? 0, stmt.column ?? 0)
    }
  }

  hasErrors(): boolean {
    return this.errors.hasErrors()
  }

  getErrors() {
    return this.errors.getErrors()
  }
}
