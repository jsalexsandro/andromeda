import { Expr, Stmt, LiteralExpr, IdentifierExpr, UnaryExpr, BinaryExpr, GroupExpr, AssignExpr, VariableStmt } from "../../ast"
import { AndroType, Primitive, TypeKind, SymbolKind, SymbolDefinition } from "../types"
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
    const nameExpr = expr.name

    if (nameExpr.kind !== "Identifier") {
      this.report("INVALID_ASSIGNMENT", "assignment target must be an identifier", 0, 0)
      return Primitive.unknown()
    }

    const name = nameExpr.name.value as string
    const [line, column] = this.getLineColumn(nameExpr.name)

    const symbol = this.scopeStack.lookup(name)

    if (!symbol) {
      this.report("UNDEFINED_VARIABLE", `variable '${name}' is not defined`, line, column)
      return Primitive.unknown()
    }

    if (!symbol.mutable) {
      this.report("CANNOT_ASSIGN", `cannot reassign '${name}': it is declared with '${symbol.kind === SymbolKind.Variable ? 'val' : 'const'} and is not mutable`, line, column)
      return Primitive.unknown()
    }

    const valueType = this.analyzeExpression(expr.value)

    if (!TypeChecker.isAssignableTo(valueType, symbol.type) && !TypeChecker.isUnknown(valueType)) {
      this.report(
        "TYPE_MISMATCH",
        `cannot assign '${TypeChecker.toString(valueType)}' to '${TypeChecker.toString(symbol.type)}'`,
        line,
        column
      )
    }

    return symbol.type
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
    for (const arg of expr.args || []) {
      this.analyzeExpression(arg)
    }
    return Primitive.unknown()
  }

  visitMember(expr: any): AndroType {
    this.analyzeExpression(expr.object)
    return Primitive.unknown()
  }

  visitIndex(expr: any): AndroType {
    this.analyzeExpression(expr.object)
    this.analyzeExpression(expr.index)
    return Primitive.unknown()
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

  analyzeVariable(stmt: VariableStmt): AndroType {
    const name = stmt.name.value as string
    const [line, column] = this.getLineColumn(stmt.name)

    let inferredType = Primitive.unknown()
    if (stmt.initializer) {
      inferredType = this.analyzeExpression(stmt.initializer)
    }

    const declaredType = stmt.typeAnnotation
      ? TypeChecker.fromKeyword(stmt.typeAnnotation.value as string) || Primitive.unknown()
      : inferredType

    if (stmt.typeAnnotation && stmt.initializer) {
      if (!TypeChecker.isAssignableTo(inferredType, declaredType) && !TypeChecker.isUnknown(inferredType)) {
        this.report(
          "TYPE_MISMATCH",
          `cannot initialize '${name}' of type '${TypeChecker.toString(declaredType)}' with value of type '${TypeChecker.toString(inferredType)}'`,
          line,
          column
        )
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

  analyzeIf(stmt: any): void {}

  analyzeWhile(stmt: any): void {}

  analyzeBreak(stmt: any): void {}

  analyzeContinue(stmt: any): void {}

  hasErrors(): boolean {
    return this.errors.hasErrors()
  }

  getErrors() {
    return this.errors.getErrors()
  }
}
