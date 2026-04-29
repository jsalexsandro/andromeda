import { Token } from "../lexer/types";
import { Stmt, Expr, TypeNode } from "../ast";
import { Symbol, createSymbol } from "./types";
import { SemanticError, Errors } from "./errors";
import { Environment } from "./Environment";

export class TypeChecker {
  private errors: SemanticError[] = [];
  private globalEnv: Environment;
  private currentEnv: Enviroanment;
  private loopDepth: number = 0;
  private functionDepth: number = 0;
  private hasReturn: boolean = false;
  private currentFunctionReturnType: TypeNode | null = null;
  private contextualType: TypeNode | null = null;

  constructor() {
    this.globalEnv = new Environment(null, true);
    this.currentEnv = this.globalEnv;
  }

  public check(program: Stmt[]): SemanticError[] {
    this.errors = [];

    for (const stmt of program) {
      this.checkStatement(stmt);
    }

    return this.errors;
  }

  private checkStatement(stmt: Stmt): void {
    switch (stmt.kind) {
      case "VariableStmt":
        this.checkVariableStmt(stmt);
        break;
      case "FunctionStmt":
        this.checkFunctionStmt(stmt);
        break;
      case "BlockStmt":
        this.checkBlockStmt(stmt);
        break;
      case "IfStmt":
        this.checkIfStmt(stmt);
        break;
      case "WhileStmt":
        this.checkWhileStmt(stmt);
        break;
      case "ForStmt":
        this.checkForStmt(stmt);
        break;
      case "BreakStmt":
        this.checkBreakStmt(stmt);
        break;
      case "ContinueStmt":
        this.checkContinueStmt(stmt);
        break;
      case "ReturnStmt":
        this.checkReturnStmt(stmt);
        break;
      case "TypeAliasStmt":
        this.checkTypeAliasStmt(stmt);
        break;
      case "ExpressionStmt":
        this.checkExpressionStmt(stmt);
        break;
      case "Assign":
        this.checkAssignStmt(stmt);
        break;
      default:
        break;
    }
  }

  private checkVariableStmt(stmt: Extract<Stmt, { kind: "VariableStmt" }>): void {
    const name = stmt.name.value as string;
    const existing = this.currentEnv.lookupLocal(name);

    if (existing) {
      this.errors.push(Errors.alreadyDeclared(name, stmt.name));
      return;
    }

    if (stmt.declarationType === "val" && !stmt.type && !stmt.initializer) {
      this.errors.push(Errors.valRequiresType(name, stmt.name));
    }

    let typeNode: TypeNode;
    if (stmt.type) {
      const validationError = this.validateTypeNode(stmt.type, stmt.name);
      if (validationError) {
        this.errors.push(validationError);
        typeNode = { kind: "PrimitiveType", name: "any" };
      } else {
        typeNode = stmt.type;
      }
      if (stmt.initializer) {
        this.contextualType = typeNode;
        const inferredType = this.inferType(stmt.initializer);
        this.contextualType = null;
        if (!this.areTypesCompatible(typeNode, inferredType)) {
          // Hint para função nullable
          const isNullableFunctionHint = 
            typeNode.kind === "FunctionType" &&
            inferredType.kind === "PrimitiveType" &&
            inferredType.name === "null";
          
          const hint = isNullableFunctionHint
            ? ` Hint: para uma função nullable, use '((${this.typeToString(typeNode)}) | null' ou '(${this.typeToString(typeNode)})?'`
            : "";
          
          this.errors.push(Errors.typeMismatch(
            `type '${this.typeToString(typeNode)}' is incompatible with initializer '${this.typeToString(inferredType)}'${hint}`,
            stmt.name
          ));
        }
      }
    } else if (stmt.initializer) {
      typeNode = this.inferType(stmt.initializer);
    } else {
      typeNode = { kind: "PrimitiveType", name: "any" };
    }

    const mutable =
      stmt.declarationType === "var" ||
      (stmt.declarationType === "val" && !stmt.initializer);

    const symbol = createSymbol(
      name,
      typeNode,
      "variable",
      mutable,
      stmt.name
    );

    this.currentEnv.define(name, symbol);
  }

  private checkTypeAliasStmt(stmt: Extract<Stmt, { kind: "TypeAliasStmt" }>): void {
    const name = stmt.name.value as string;

    // Verificar redeclaração no escopo local
    const existing = this.currentEnv.lookupLocal(name);
    if (existing) {
      this.errors.push(Errors.alreadyDeclared(name, stmt.name));
      return;
    }

    // Validar o tipo que está sendo aliasado
    const err = this.validateTypeNode(stmt.type, stmt.name);
    if (err) {
      this.errors.push(err);
      return;
    }

    // Registrar no ambiente global como kind: "type"
    const symbol = {
      name,
      type: stmt.type,   // o TypeNode que o alias representa
      kind: "type" as const,
      mutable: false,
      initialized: true,
      declarationToken: stmt.name,
    };

    this.globalEnv.define(name, symbol);
  }

  private validateTypeNode(type: TypeNode, token: Token): SemanticError | null {
    if (type.kind === "PrimitiveType") {
      const validPrimitives = ["int", "float", "string", "bool", "void", "null", "any", "unknown"];
      if (!validPrimitives.includes(type.name)) {
        return Errors.typeMismatch(`primitive type '${type.name}' is not valid. Use: int, float, string, bool, void, null, any, or unknown`, token);
      }
      return null;
    }

    if (type.kind === "NamedType") {
      // Resolve alias before validating
      const resolved = this.resolveAlias(type);
      if (resolved !== type) {
        // É um alias, validar o tipo resolvido
        return this.validateTypeNode(resolved, token);
      }

      const typeName = type.name.value as string;
      const validPrimitives = ["int", "float", "string", "bool", "void", "null", "any", "unknown"];
      if (validPrimitives.includes(typeName)) {
        return null;
      }
      const existing = this.globalEnv.lookup(typeName);
      if (!existing || (existing.kind !== "type" && existing.kind !== "struct")) {
        return Errors.undefinedType(typeName, token);
      }
      return null;
    }

    if (type.kind === "ArrayType") {
      return this.validateTypeNode(type.elementType, token);
    }

    if (type.kind === "GenericType") {
      const typeName = type.name.value as string;
      const validGenerics: Record<string, number> = {
        "Array": 1,
        "List": 1,
        "Map": 2,
        "Set": 1,
        "Promise": 1,
      };
      if (typeName in validGenerics) {
        const expectedArgs = validGenerics[typeName];
        if (type.args.length !== expectedArgs) {
          return Errors.typeMismatch(`Generic '${typeName}' espera ${expectedArgs} parâmetro(s), obteve ${type.args.length}`, token);
        }
      }
      for (const arg of type.args) {
        const argError = this.validateTypeNode(arg, token);
        if (argError) return argError;
      }
      return null;
    }

    if (type.kind === "UnionType") {
      for (const member of type.types) {
        const memberError = this.validateTypeNode(member, token);
        if (memberError) return memberError;
      }
      return null;
    }

    if (type.kind === "NullableType") {
      return this.validateTypeNode(type.type, token);
    }

    if (type.kind === "FunctionType") {
      for (const param of type.params) {
        const paramError = this.validateTypeNode(param, token);
        if (paramError) return paramError;
      }
      return this.validateTypeNode(type.returnType, token);
    }

    if (type.kind === "TupleType") {
      for (const element of type.elements) {
        const elementError = this.validateTypeNode(element, token);
        if (elementError) return elementError;
      }
      return null;
    }

    return null;
  }

  private resolveAlias(type: TypeNode): TypeNode {
    // Só resolve se for NamedType
    if (type.kind !== "NamedType") return type;

    const name = type.name.value as string;
    const symbol = this.globalEnv.lookup(name);

    // Só expande se for alias (kind: "type") — structs/enums não expandem
    if (symbol?.kind === "type") {
      return this.resolveAlias(symbol.type);  // recursivo para aliases de aliases
    }

    return type;
  }

  private areTypesCompatible(expected: TypeNode, actual: TypeNode): boolean {
    // Resolve aliases antes de qualquer comparação
    const resolvedExpected = this.resolveAlias(expected);
    const resolvedActual = this.resolveAlias(actual);
    
    // Se ambos mudaram, reentrar com os resolvidos
    if (resolvedExpected !== expected || resolvedActual !== actual) {
      return this.areTypesCompatible(resolvedExpected, resolvedActual);
    }

    if (resolvedExpected.kind === "PrimitiveType" && resolvedActual.kind === "PrimitiveType") {
      // any aceita tudo (any no expected ou no actual)
      if (resolvedExpected.name === "any" || resolvedActual.name === "any") {
        return true;
      }
      // unknown no expected aceita qualquer actual
      if (resolvedExpected.name === "unknown") {
        return true;
      }
      // unknown no actual NÃO passa automaticamente
      return resolvedExpected.name === resolvedActual.name;
    }

    if (expected.kind === "ArrayType" && actual.kind === "ArrayType") {
      return this.areTypesCompatible(expected.elementType, actual.elementType);
    }

    if (expected.kind === "GroupingType") {
      return this.areTypesCompatible(expected.type, actual);
    }

    if (actual.kind === "GroupingType") {
      return this.areTypesCompatible(expected, actual.type);
    }

    if (expected.kind === "FunctionType" && actual.kind === "FunctionType") {
      const expectedIsUnknown = expected.params.every(p => p.kind === "PrimitiveType" && p.name === "unknown") &&
        expected.returnType.kind === "PrimitiveType" && expected.returnType.name === "unknown";
      const actualIsUnknown = actual.params.every(p => p.kind === "PrimitiveType" && p.name === "unknown") &&
        actual.returnType.kind === "PrimitiveType" && actual.returnType.name === "unknown";
      if (expectedIsUnknown || actualIsUnknown) {
        return true;
      }
      if (expected.params.length !== actual.params.length) return false;
      return expected.params.every((ep, i) => this.areTypesCompatible(ep, actual.params[i])) &&
        this.areTypesCompatible(expected.returnType, actual.returnType);
    }

    if (expected.kind === "UnionType") {
      if (actual.kind === "UnionType") {
        return actual.types.every((actualMember) =>
          expected.types.some((expectedMember) =>
            this.areTypesCompatible(expectedMember, actualMember)
          )
        );
      }
      return expected.types.some((member) =>
        this.areTypesCompatible(member, actual)
      );
    }

    if (expected.kind === "NullableType") {
      if (actual.kind === "PrimitiveType" && actual.name === "null") return true;
      if (actual.kind === "PrimitiveType" && actual.name === "unknown") return true;
      return this.areTypesCompatible(expected.type, actual);
    }

    if (actual.kind === "NullableType" && actual.type.kind === "PrimitiveType" && actual.type.name === "null") {
      return this.areTypesCompatible(expected, { kind: "PrimitiveType", name: "null" });
    }

    return false;
  }

  private isBoolType(type: TypeNode): boolean {
    if (type.kind === "PrimitiveType" && type.name === "bool") {
      return true;
    }
    return false;
  }

  private typeToString(type: TypeNode): string {
    // Resolve aliases before converting to string
    const resolved = this.resolveAlias(type);
    if (resolved !== type) {
      return this.typeToString(resolved);
    }

    switch (type.kind) {
      case "PrimitiveType":
        return type.name;
      case "NamedType":
        return type.name.value as string;
      case "LiteralType":
        return String(type.value);
      case "ArrayType":
        const elemStr = this.typeToString(type.elementType);
        const needsParens = type.elementType.kind === "UnionType" || type.elementType.kind === "FunctionType";
        const suffix = "[]".repeat(type.dimensions);
        return `${needsParens ? `(${elemStr})` : elemStr}${suffix}`;
      case "FunctionType":
        const params = type.params.map(p => this.typeToString(p)).join(", ");
        return `(${params}) => ${this.typeToString(type.returnType)}`;
      case "UnionType":
        return type.types.map(t => this.typeToString(t)).join(" | ");
      case "NullableType":
        return `${this.typeToString(type.type)}?`;
      case "TupleType":
        const elements = type.elements.map(t => this.typeToString(t)).join(", ");
        return `[${elements}]`;
      case "GenericType":
        const typeName = type.name.value as string;
        const args = type.args.map(t => this.typeToString(t)).join(", ");
        return `${typeName}<${args}>`;
      case "GroupingType":
        return `(${this.typeToString(type.type)})`;
      default:
        return "unknown";
    }
  }

  private checkFunctionStmt(stmt: Extract<Stmt, { kind: "FunctionStmt" }>): void {
    const name = stmt.name.value as string;
    const existing = this.currentEnv.lookupLocal(name);

    if (existing) {
      this.errors.push(Errors.alreadyDeclared(name, stmt.name));
      return;
    }

    const paramTypes: TypeNode[] = [];
    for (const param of stmt.params) {
      if (param.type) {
        const validationError = this.validateTypeNode(param.type, param.name);
        if (validationError) {
          this.errors.push(validationError);
          paramTypes.push({ kind: "PrimitiveType", name: "unknown" });
        } else {
          paramTypes.push(param.type);
        }
      } else {
        paramTypes.push({ kind: "PrimitiveType", name: "unknown" });
      }
    }

    if (stmt.returnType) {
      const returnValidation = this.validateTypeNode(stmt.returnType, stmt.name);
      if (returnValidation) {
        this.errors.push(returnValidation);
      }
    }

    const returnType = stmt.returnType || {
      kind: "PrimitiveType",
      name: "void",
    };

    const fnType: FunctionTypeNode = {
      kind: "FunctionType",
      params: paramTypes.map((pt, i) => ({
        ...pt,
        isRest: stmt.params[i]?.isRest || false
      })),
      returnType,
    };

    const symbol = createSymbol(
      name,
      fnType,
      "function",
      false,
      stmt.name
    );

    this.currentEnv.define(name, symbol);

    for (let i = 0; i < stmt.params.length; i++) {
      const param = stmt.params[i];
      if (param.isRest) {
        for (let j = i + 1; j < stmt.params.length; j++) {
          this.errors.push(Errors.restNotLast(param.name));
        }
      }
    }

    this.functionDepth++;
    const fnEnv = new Environment(this.currentEnv, false);

    for (const param of stmt.params) {
      const paramName = param.name.value as string;
      const paramType = param.type || {
        kind: "PrimitiveType",
        name: "unknown",
      };
      fnEnv.define(paramName, {
        name: paramName,
        type: paramType,
        kind: "parameter",
        mutable: false,
        initialized: true,
        declarationToken: param.name,
      });
    }

    const previousEnv = this.currentEnv;
    this.currentEnv = fnEnv;
    this.currentFunctionReturnType = returnType;
    this.hasReturn = false;
    this.checkBlockStmt(stmt.body);
    this.currentEnv = previousEnv;
    this.currentFunctionReturnType = null;

    if (returnType.kind !== "PrimitiveType" || returnType.name !== "void") {
      if (!this.hasReturn) {
        this.errors.push(Errors.missingReturn(stmt.name));
      }
    }

    this.functionDepth--;
  }

  private checkAssignStmt(stmt: Extract<Stmt, { kind: "Assign" }>): void {
    const targetName = stmt.name;
    let name: string;
    if (targetName.kind === "Identifier") {
      name = targetName.name.value as string;
    }

    const symbol = this.currentEnv.lookup(name);
    if (!symbol) {
      this.errors.push(Errors.undefinedVariable(name, targetName.name));
      return;
    }

    if (!symbol.mutable) {
      this.errors.push(Errors.cannotAssign(name, targetName.name));
      return;
    }

    // Check compound operators ( +=, -=, *=, /=, %= )
    const operator = stmt.operator?.value as string;
    if (operator && ['+=', '-=', '*=', '/=', '%='].includes(operator)) {
      // For compound assignment, check if target type is numeric
      if (!this.isNumericType(symbol.type)) {
        this.errors.push(Errors.typeMismatch(
          `Cannot use '${operator}' with non-numeric type '${this.typeToString(symbol.type)}'`,
          stmt.operator!
        ));
        return;
      }
    }

    const valueType = this.inferType(stmt.value);
    if (!this.areTypesCompatible(symbol.type, valueType)) {
      this.errors.push(Errors.typeMismatch(
        `Não é possível atribuir '${this.typeToString(valueType)}' a '${name}'(${this.typeToString(symbol.type)})`,
        targetName.name
      ));
    }
  }

  private checkBlockStmt(stmt: Extract<Stmt, { kind: "BlockStmt" }>): void {
    const blockEnv = new Environment(this.currentEnv, false);
    const previousEnv = this.currentEnv;
    this.currentEnv = blockEnv;

    for (const innerStmt of stmt.statements) {
      this.checkStatement(innerStmt);
    }

    this.currentEnv = previousEnv;
  }

  private checkIfStmt(stmt: Extract<Stmt, { kind: "IfStmt" }>): void {
    const condType = this.checkExpression(stmt.condition);
    if (!this.isBoolType(condType)) {
      this.errors.push(Errors.invalidCondition(stmt.condition.kind === "Identifier" ? stmt.condition.name : { line: 0, column: 0, type: 0, value: "if" } as Token));
    }
    this.checkStatement(stmt.thenBranch);

    if (stmt.elseBranch) {
      this.checkStatement(stmt.elseBranch);
    }
  }

  private checkWhileStmt(stmt: Extract<Stmt, { kind: "WhileStmt" }>): void {
    const conditionType = this.checkExpression(stmt.condition);
    
    if (conditionType.kind !== "PrimitiveType" || conditionType.name !== "bool") {
      if (stmt.condition.kind !== "Literal" || (stmt.condition as any).value !== true) {
        this.errors.push(Errors.invalidCondition(stmt.condition));
      }
    }

    this.loopDepth++;
    this.checkStatement(stmt.body);
    this.loopDepth--;
  }

  private checkForStmt(stmt: Extract<Stmt, { kind: "ForStmt" }>): void {
    // Create new scope for the entire for loop (initializer + condition + update + body)
    this.currentEnv = new Environment(this.currentEnv, false);

    // Check initializer in the new scope
    if (stmt.initializer) {
      this.checkStatement(stmt.initializer);
    }

    // Check condition
    if (stmt.condition && stmt.condition.kind !== "Literal") {
      const conditionType = this.checkExpression(stmt.condition);
      
      if (conditionType.kind !== "PrimitiveType" || conditionType.name !== "bool") {
        if (stmt.condition.kind !== "Literal" || (stmt.condition as any).value !== true) {
          this.errors.push(Errors.invalidCondition(stmt.condition));
        }
      }
    }

    // Check update expression
    if (stmt.update && stmt.update.kind !== "Literal") {
      // If update is an assignment (Assign Stmt), check it properly
      if (stmt.update.kind === "Assign") {
        this.checkAssignStmt(stmt.update as any);
      } else {
        // Otherwise treat as expression
        this.checkExpression(stmt.update);
      }
    }

    // Check body
    this.loopDepth++;
    this.checkStatement(stmt.body);
    this.loopDepth--;
    
    // Restore environment
    this.currentEnv = this.currentEnv.parent!;
  }

  private checkBreakStmt(_stmt: Extract<Stmt, { kind: "BreakStmt" }>): void {
    if (this.loopDepth === 0) {
      this.errors.push(Errors.invalidBreak({ line: 0, column: 0, type: 0, value: "break" } as Token));
    }
  }

  private checkContinueStmt(_stmt: Extract<Stmt, { kind: "ContinueStmt" }>): void {
    if (this.loopDepth === 0) {
      this.errors.push(Errors.invalidContinue({ line: 0, column: 0, type: 0, value: "continue" } as Token));
    }
  }

  private checkReturnStmt(stmt: Extract<Stmt, { kind: "ReturnStmt" }>): void {
    if (this.functionDepth === 0) {
      this.errors.push(Errors.invalidReturn({ line: 0, column: 0, type: 0, value: "return" } as Token));
      return;
    }

    this.hasReturn = true;

    if (stmt.value) {
      const returnValueType = this.checkExpression(stmt.value);
      if (this.currentFunctionReturnType) {
        if (!this.areTypesCompatible(this.currentFunctionReturnType, returnValueType)) {
          this.errors.push(Errors.invalidReturnType(
            this.typeToString(this.currentFunctionReturnType),
            this.typeToString(returnValueType),
            stmt.value.kind === "Identifier" ? stmt.value.name : { line: 0, column: 0, type: 0, value: "" } as Token
          ));
        }
      }
    } else {
      if (this.currentFunctionReturnType) {
        const returnTypeStr = this.typeToString(this.currentFunctionReturnType);
        if (returnTypeStr !== "void") {
          this.errors.push(Errors.invalidReturnType(
            returnTypeStr,
            "void",
            { line: 0, column: 0, type: 0, value: "" } as Token
          ));
        }
      }
    }
  }

  private checkExpressionStmt(stmt: Extract<Stmt, { kind: "ExpressionStmt" }>): void {
    const expr = stmt.expression;
    if (expr.kind === "Assign") {
      this.checkAssignExpr(expr);
      return;
    }
    this.checkExpression(expr);
  }

  private isNumericType(type: TypeNode): boolean {
    if (type.kind === "PrimitiveType") {
      return type.name === "int" || type.name === "float";
    }
    return false;
  }

  private checkAssignExpr(expr: Extract<Expr, { kind: "Assign" }>): void {
    const targetName = expr.name;
    let name: string;
    if (targetName.kind === "Identifier") {
      name = targetName.name.value as string;
    }

    const symbol = this.currentEnv.lookup(name);
    if (!symbol) {
      this.errors.push(Errors.undefinedVariable(name, targetName.name));
      return;
    }

    if (!symbol.mutable) {
      this.errors.push(Errors.cannotAssign(name, targetName.name));
      return;
    }

    // Check compound operators ( +=, -=, *=, /=, %= )
    const operator = expr.operator?.value as string;
    if (operator && ['+=', '-=', '*=', '/=', '%='].includes(operator)) {
      // For compound assignment, check if target type is numeric
      if (!this.isNumericType(symbol.type)) {
        this.errors.push(Errors.typeMismatch(
          `Cannot use '${operator}' with non-numeric type '${this.typeToString(symbol.type)}'`,
          expr.operator!
        ));
        return;
      }
    }

    const valueType = this.inferType(expr.value);
    if (!this.areTypesCompatible(symbol.type, valueType)) {
      this.errors.push(Errors.typeMismatch(
        `Não é possível atribuir '${this.typeToString(valueType)}' a '${name}'`,
        targetName.name
      ));
    }
  }

  private checkExpression(expr: Expr): TypeNode {
    switch (expr.kind) {
      case "Identifier": {
        const name = expr.name.value as string;
        const symbol = this.currentEnv.lookup(name);
        if (!symbol) {
          this.errors.push(Errors.undefinedVariable(name, expr.name));
          return { kind: "PrimitiveType", name: "unknown" };
        }
        return symbol.type;
      }
      case "Literal":
        return this.inferLiteralType(expr.value);
      case "Binary":
        return this.checkBinaryExpr(expr);
      case "Unary":
        return this.checkUnaryExpr(expr);
      case "Logical":
        return this.checkLogicalExpr(expr);
      case "Call":
        return this.checkCallExpr(expr);
      case "Member":
        return this.checkMemberExpr(expr);
      case "Index":
        return this.checkIndexExpr(expr);
      case "Array":
        return this.checkArrayExpr(expr);
      case "Object":
        return this.checkObjectExpr(expr);
      case "Conditional":
        return this.checkConditionalExpr(expr);
      case "NullishCoalescing":
        return this.checkNullishCoalescingExpr(expr);
      case "ArrowFunction":
        return this.checkArrowFunctionExpr(expr);
      case "Spread":
        return this.checkSpreadExpr(expr);
      case "Group":
        return this.checkExpression(expr.expression);
      default:
        return { kind: "PrimitiveType", name: "unknown" };
    }
  }

  private inferType(expr: Expr): TypeNode {
    return this.checkExpression(expr);
  }

  private inferLiteralType(value: unknown): TypeNode {
    if (value === null) {
      return { kind: "PrimitiveType", name: "null" };
    }
    if (typeof value === "number") {
      return {
        kind: "PrimitiveType",
        name: Number.isInteger(value) ? "int" : "float",
      };
    }
    if (typeof value === "string") {
      return { kind: "PrimitiveType", name: "string" };
    }
    if (typeof value === "boolean") {
      return { kind: "PrimitiveType", name: "bool" };
    }
    return { kind: "PrimitiveType", name: "unknown" };
  }

  private checkBinaryExpr(expr: Extract<Expr, { kind: "Binary" }>): TypeNode {
    const leftType = this.checkExpression(expr.left);
    const rightType = this.checkExpression(expr.right);

    const op = expr.operator.value as string;

    if (op === "+") {
      if (
        leftType.kind === "PrimitiveType" &&
        rightType.kind === "PrimitiveType"
      ) {
        if (
          (leftType.name === "int" || leftType.name === "float") &&
          (rightType.name === "int" || rightType.name === "float")
        ) {
          return leftType.name === "int" && rightType.name === "int"
            ? { kind: "PrimitiveType", name: "int" }
            : { kind: "PrimitiveType", name: "float" };
        }
        if (leftType.name === "string" && rightType.name === "string") {
          return { kind: "PrimitiveType", name: "string" };
        }
      }
      this.errors.push(Errors.typeMismatch(`invalid operands for operator '${op}'`, expr.operator));
      return { kind: "PrimitiveType", name: "string" };
    }

    if (["-", "*", "/", "%"].includes(op)) {
      if (
        leftType.kind === "PrimitiveType" &&
        rightType.kind === "PrimitiveType" &&
        (leftType.name === "int" || leftType.name === "float") &&
        (rightType.name === "int" || rightType.name === "float")
      ) {
        return leftType.name === "int" && rightType.name === "int"
          ? { kind: "PrimitiveType", name: "int" }
          : { kind: "PrimitiveType", name: "float" };
      }
      this.errors.push(Errors.typeMismatch(`invalid operands for operator '${op}'`, expr.operator));
      return { kind: "PrimitiveType", name: "bool" };
    }

    if (["<", ">", "<=", ">="].includes(op)) {
      if (
        leftType.kind === "PrimitiveType" &&
        rightType.kind === "PrimitiveType" &&
        (leftType.name === "int" || leftType.name === "float" || leftType.name === "string") &&
        (rightType.name === "int" || rightType.name === "float" || rightType.name === "string")
      ) {
        return { kind: "PrimitiveType", name: "bool" };
      }
      this.errors.push(Errors.typeMismatch(`invalid operands for operator '${op}'`, expr.operator));
      return { kind: "PrimitiveType", name: "bool" };
    }

    if (["&&", "||"].includes(op)) {
      if (
        leftType.kind === "PrimitiveType" &&
        leftType.name === "bool" &&
        rightType.kind === "PrimitiveType" &&
        rightType.name === "bool"
      ) {
        return { kind: "PrimitiveType", name: "bool" };
      }
      this.errors.push(Errors.typeMismatch("Operadores lógicos precisam de operandos boolean", expr.operator));
      return { kind: "PrimitiveType", name: "bool" };
    }

    if (["==", "!="].includes(op)) {
      if (
        leftType.kind === "PrimitiveType" &&
        rightType.kind === "PrimitiveType" &&
        leftType.name !== rightType.name
      ) {
        this.errors.push(Errors.typeMismatch(`Tipos incompatíveis para '${op}'`, expr.operator));
      }
      return { kind: "PrimitiveType", name: "bool" };
    }

    return { kind: "PrimitiveType", name: "bool" };
  }

  private checkUnaryExpr(expr: Extract<Expr, { kind: "Unary" }>): TypeNode {
    const operandType = this.checkExpression(expr.right);
    const op = expr.operator.value as string;

    if (op === "-" || op === "+") {
      if (
        operandType.kind === "PrimitiveType" &&
        (operandType.name === "int" || operandType.name === "float")
      ) {
        return operandType;
      }
      this.errors.push(Errors.invalidUnary(op, expr.operator));
    }

    if (op === "++" || op === "--") {
      // Check if target is an Identifier
      if (expr.right.kind === "Identifier") {
        const name = expr.right.name.value as string;
        const symbol = this.currentEnv.lookup(name);

        if (!symbol) {
          this.errors.push(Errors.undefinedVariable(name, expr.right.name));
          return { kind: "PrimitiveType", name: "unknown" };
        }

        if (!symbol.mutable) {
          this.errors.push(Errors.cannotAssign(name, expr.right.name));
          return symbol.type;
        }

        // Check numeric type (not bool for ++/--)
        if (
          symbol.type.kind === "PrimitiveType" &&
          (symbol.type.name === "int" || symbol.type.name === "float")
        ) {
          return symbol.type;
        }

        this.errors.push(Errors.invalidUnary(op, expr.operator));
      } else {
        this.errors.push(Errors.invalidUnary(op, expr.operator));
      }
      return { kind: "PrimitiveType", name: "unknown" };
    }

    if (op === "!") {
      if (
        operandType.kind === "PrimitiveType" &&
        operandType.name === "bool"
      ) {
        return operandType;
      }
      this.errors.push(Errors.invalidUnary(op, expr.operator));
    }

    return { kind: "PrimitiveType", name: "unknown" };
  }

  private checkLogicalExpr(expr: Extract<Expr, { kind: "Logical" }>): TypeNode {
    const leftType = this.checkExpression(expr.left);
    const rightType = this.checkExpression(expr.right);

    if (
      leftType.kind === "PrimitiveType" &&
      leftType.name === "bool" &&
      rightType.kind === "PrimitiveType" &&
      rightType.name === "bool"
    ) {
      return { kind: "PrimitiveType", name: "bool" };
    }

    this.errors.push(Errors.typeMismatch("Operadores lógicos precisam de operandos boolean", { line: 0, column: 0, type: 0, value: "" } as Token));

    return { kind: "PrimitiveType", name: "bool" };
  }

private checkCallExpr(expr: Extract<Expr, { kind: "Call" }>): TypeNode {
    const calleeType = this.checkExpression(expr.callee);

    // callee não é função
    if (calleeType.kind !== "FunctionType") {
      // se for "any" ou "unknown", deixa passar sem checar args
      if (calleeType.kind === "PrimitiveType" &&
         (calleeType.name === "any" || calleeType.name === "unknown")) {
        expr.args.forEach(arg => this.checkExpression(arg));
        return { kind: "PrimitiveType", name: "any" };
      }
      const token = expr.callee.kind === "Identifier"
        ? expr.callee.name
        : { line: 0, column: 0, type: 0, value: "" } as Token;
      this.errors.push(Errors.invalidCall(token));
      return { kind: "PrimitiveType", name: "any" };
    }

    const params = calleeType.params;
    const args = expr.args;

    // ── detectar rest param na assinatura ──────────────────────
    const hasRest = params.length > 0 && params[params.length - 1].isRest === true;
    const restIndex = hasRest ? params.length - 1 : -1;

    // ── checar aridade ─────────────────────────────────────────
    if (hasRest) {
      // com rest: precisa de pelo menos (restIndex) args
      const minArgs = restIndex;
      if (args.length < minArgs) {
        const token = expr.callee.kind === "Identifier"
          ? expr.callee.name
          : { line: 0, column: 0, type: 0, value: "" } as Token;
        this.errors.push(Errors.argumentCountMismatch(minArgs, args.length, token));
      }
    } else {
      // sem rest: aridade exata
      if (params.length !== args.length) {
        const token = expr.callee.kind === "Identifier"
          ? expr.callee.name
          : { line: 0, column: 0, type: 0, value: "" } as Token;
        this.errors.push(Errors.argumentCountMismatch(params.length, args.length, token));
      }
    }

    // ── checar cada argumento ──────────────────────────────────
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // tipo esperado — pós restIndex todos mapeiam pro elementType do rest
      let expectedType: TypeNode | null = null;
      if (i < params.length) {
        expectedType = params[i];
      } else if (hasRest && restIndex >= 0 && restIndex < params.length) {
        // rest param: o tipo do param é T[], o arg deve ser T
        const restParamType = params[restIndex];
        expectedType = restParamType.kind === "ArrayType"
          ? restParamType.elementType
          : restParamType;
      }

      if (!expectedType) continue;

      // ── spread como argumento ─────────────────────────────────
      if (arg.kind === "Spread") {
        const spreadType = this.checkExpression(
          (arg as Extract<Expr, { kind: "Spread" }>).argument
        );
        
        if (spreadType.kind !== "ArrayType") {
          this.errors.push(Errors.invalidSpread(
            { line: 0, column: 0, type: 0, value: "" } as Token
          ));
          continue;
        }
        
        // Para rest param, o expectedType é ArrayType, o spread deve ser compatível com ArrayType
        // Não usar elementType aqui!
        if (!this.areTypesCompatible(expectedType, spreadType)) {
          this.errors.push(Errors.typeMismatch(
            `argument ${i + 1}: expected '${this.typeToString(expectedType)}', ` +
            `got '${this.typeToString(spreadType)}'`,
            { line: 0, column: 0, type: 0, value: "" } as Token
          ));
        }
        continue;
      }

      // ── contextual typing para arrow functions ─────────────────
      // se o param esperado for FunctionType e o arg for arrow sem anotação,
      // passa o tipo esperado como contexto para inferir os params da arrow
      if (expectedType.kind === "FunctionType" &&
          arg.kind === "ArrowFunction") {
        this.contextualType = expectedType;        // ← contexto
        const actualType = this.checkExpression(arg);
        this.contextualType = null;

        if (!this.areTypesCompatible(expectedType, actualType)) {
          this.errors.push(Errors.typeMismatch(
            `argument ${i + 1}: expected '${this.typeToString(expectedType)}', ` +
            `got '${this.typeToString(actualType)}'`,
            { line: 0, column: 0, type: 0, value: "" } as Token
          ));
        }
        continue;
      }

      // ── argumento normal ───────────────────────────────────────
      const actualType = this.checkExpression(arg);
      if (!this.areTypesCompatible(expectedType, actualType)) {
        this.errors.push(Errors.typeMismatch(
          `argument ${i + 1}: expected '${this.typeToString(expectedType)}', ` +
          `got '${this.typeToString(actualType)}'`,
          { line: 0, column: 0, type: 0, value: "" } as Token
        ));
      }
    }

    return calleeType.returnType;
  }

  private checkMemberExpr(expr: Extract<Expr, { kind: "Member" }>): TypeNode {
    const objectType = this.checkExpression(expr.object);

    if (objectType.kind === "NamedType") {
      return { kind: "PrimitiveType", name: "any" };
    }

    if (objectType.kind !== "Object") {
      this.errors.push(Errors.invalidMemberAccess("cannot access member on non-object type", { line: 0, column: 0, type: 0, value: "" } as Token));
    }

    return { kind: "PrimitiveType", name: "any" };
  }

  private checkIndexExpr(expr: Extract<Expr, { kind: "Index" }>): TypeNode {
    const objectType = this.checkExpression(expr.object);
    const indexType = this.checkExpression(expr.index);

    if (objectType.kind === "ArrayType") {
      if (
        indexType.kind === "PrimitiveType" &&
        indexType.name === "int"
      ) {
        return objectType.elementType;
      }
      this.errors.push(Errors.invalidIndex("Índice de array precisa ser int", { line: 0, column: 0, type: 0, value: "" } as Token));
    }

    return { kind: "PrimitiveType", name: "any" };
  }

  private checkArrayExpr(expr: Extract<Expr, { kind: "Array" }>): TypeNode {
    if (expr.elements.length === 0) {
      return {
        kind: "ArrayType",
        elementType: { kind: "PrimitiveType", name: "unknown" },
        dimensions: 1,
      };
    }

    let unwrapped = this.contextualType ? this.unwrapGrouping(this.contextualType) : null;
    let elementCtx: TypeNode | null = unwrapped?.kind === "ArrayType"
      ? this.unwrapGrouping(unwrapped.elementType)
      : null;

    const elementTypes: TypeNode[] = [];
    
    for (const e of expr.elements) {
      this.contextualType = elementCtx;
      
      // Se for spread, extrair o elementType do array
      if (e.kind === "Spread") {
        const spreadType = this.checkExpression(e);
        if (spreadType.kind === "ArrayType") {
          // Extrair o tipo do elemento do array
          elementTypes.push(this.unwrapGrouping(spreadType.elementType));
        } else {
          elementTypes.push(spreadType);
        }
      } else {
        const t = this.checkExpression(e);
        elementTypes.push(this.unwrapGrouping(t));
      }
      
      this.contextualType = null;
    }
    
    const unique = this.deduplicateTypes(elementTypes);
    
    let elementType: TypeNode;
    let dimensions = 1;

    if (unique.length === 1 && unique[0].kind === "ArrayType") {
      const innerArray = unique[0];
      elementType = innerArray.elementType;
      dimensions = innerArray.dimensions + 1;
    } else {
      elementType = unique.length === 1
        ? unique[0]
        : { kind: "UnionType", types: unique };
    }

    return {
      kind: "ArrayType",
      elementType,
      dimensions,
    };
  }

  private deduplicateTypes(types: TypeNode[]): TypeNode[] {
    const seen = new Set<string>();
    return types.filter((t) => {
      const key = this.typeToString(t);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private checkObjectExpr(expr: Extract<Expr, { kind: "Object" }>): TypeNode {
    const fields: Record<string, TypeNode> = {};
    for (const prop of expr.properties) {
      const key = prop.key || "unknown";
      fields[key] = this.checkExpression(prop.value);
    }
    return { kind: "Object", fields } as TypeNode;
  }

  private checkConditionalExpr(
    expr: Extract<Expr, { kind: "Conditional" }>
  ): TypeNode {
    this.checkExpression(expr.condition);
    const consequentType = this.checkExpression(expr.consequent);
    const alternateType = this.checkExpression(expr.alternate);
    return consequentType;
  }

  private checkNullishCoalescingExpr(
    expr: Extract<Expr, { kind: "NullishCoalescing" }>
  ): TypeNode {
    this.checkExpression(expr.left);
    return this.checkExpression(expr.right);
  }

  private unwrapGrouping(type: TypeNode): TypeNode {
    while (type.kind === "Group" || type.kind === "GroupingType") {
      type = (type as any).expression || (type as any).type;
    }
    if (type.kind === "ArrayType") {
      return {
        ...type,
        elementType: this.unwrapGrouping(type.elementType),
      };
    }
    if (type.kind === "FunctionType") {
      return {
        ...type,
        params: type.params.map(p => this.unwrapGrouping(p)),
        returnType: this.unwrapGrouping(type.returnType),
      };
    }
    return type;
  }

  private checkArrowFunctionExpr(
    expr: Extract<Expr, { kind: "ArrowFunction" }>
  ): TypeNode {
    let unwrapped = this.contextualType ? this.unwrapGrouping(this.contextualType) : null;
    let fnContext: FunctionTypeNode | null = unwrapped?.kind === "FunctionType" ? unwrapped : null;
    this.contextualType = null;

    const paramTypes: TypeNode[] = [];
    for (let i = 0; i < expr.params.length; i++) {
      const param = expr.params[i];
      if (param.type) {
        const err = this.validateTypeNode(param.type, param.name);
        if (err) {
          this.errors.push(err);
          paramTypes.push({ kind: "PrimitiveType", name: "unknown" });
        } else {
          paramTypes.push(param.type);
        }
      } else if (fnContext && i < fnContext.params.length) {
        paramTypes.push(fnContext.params[i]);
      } else {
        paramTypes.push({ kind: "PrimitiveType", name: "unknown" });
      }
    }

    for (let i = 0; i < expr.params.length - 1; i++) {
      if (expr.params[i].isRest) {
        this.errors.push(Errors.restNotLast(expr.params[i].name));
      }
    }

    const annotatedReturn = expr.returnType
      ? (() => {
          const err = this.validateTypeNode(expr.returnType!, expr.params[0]?.name ?? { line: 0, column: 0, type: 0, value: "" } as Token);
          if (err) this.errors.push(err);
          return expr.returnType!;
        })()
      : null;

    const expectedReturn: TypeNode | null =
      annotatedReturn ?? fnContext?.returnType ?? null;

    const previousEnv = this.currentEnv;
    const previousReturnType = this.currentFunctionReturnType;
    const previousHasReturn = this.hasReturn;
    const previousFunctionDepth = this.functionDepth;

    const fnEnv = new Environment(this.currentEnv, false);
    for (let i = 0; i < expr.params.length; i++) {
      const param = expr.params[i];
      const paramName = param.name.value as string;
      fnEnv.define(paramName, {
        name: paramName,
        type: paramTypes[i],
        kind: "parameter",
        mutable: false,
        initialized: true,
        declarationToken: param.name,
      });
    }

    this.currentEnv = fnEnv;
    this.functionDepth++;
    this.hasReturn = false;
    this.currentFunctionReturnType = expectedReturn;

    let inferredReturn: TypeNode;
    if (expr.body.kind !== "BlockStmt") {
      // PROPAGAÇÃO DE CONTEXTO: se o retorno esperado é FunctionType, passa como contexto
      if (expectedReturn && expectedReturn.kind === "FunctionType") {
        this.contextualType = expectedReturn;
      }

      inferredReturn = this.checkExpression(expr.body as Expr);
      this.contextualType = null; // limpa após checar
      this.hasReturn = true;

      if (expectedReturn && !this.areTypesCompatible(expectedReturn, inferredReturn)) {
        const token = expr.body.kind === "Identifier"
          ? (expr.body as Extract<Expr, { kind: "Identifier" }>).name
          : { line: 0, column: 0, type: 0, value: "" } as Token;
        this.errors.push(Errors.invalidReturnType(
          this.typeToString(expectedReturn),
          this.typeToString(inferredReturn),
          token
        ));
      }
    } else {
      this.checkBlockStmt(expr.body as Extract<Stmt, { kind: "BlockStmt" }>);

      const effectiveReturn = expectedReturn ?? { kind: "PrimitiveType", name: "void" } as TypeNode;
      const isVoid = effectiveReturn.kind === "PrimitiveType" && effectiveReturn.name === "void";

      if (!isVoid && !this.hasReturn) {
        const token = expr.params[0]?.name ?? { line: 0, column: 0, type: 0, value: "=>" } as Token;
        this.errors.push(Errors.missingReturn(token));
      }

      inferredReturn = expectedReturn ?? { kind: "PrimitiveType", name: "void" };
    }

    this.currentEnv = previousEnv;
    this.currentFunctionReturnType = previousReturnType;
    this.hasReturn = previousHasReturn;
    this.functionDepth = previousFunctionDepth;

    const finalReturn = annotatedReturn ?? inferredReturn;
    return {
      kind: "FunctionType",
      params: paramTypes.map((pt, i) => ({
        ...pt,
        isRest: expr.params[i]?.isRest || false
      })),
      returnType: finalReturn,
    };
  }

  private checkSpreadExpr(expr: Extract<Expr, { kind: "Spread" }>): TypeNode {
    const argType = this.checkExpression(expr.argument);

    if (argType.kind !== "ArrayType" && argType.kind !== "Object") {
      const token: Token = {
        line: expr.line ?? 0,
        column: expr.column ?? 0,
        type: 0,
        value: ""
      };
      this.errors.push(Errors.invalidSpread(token));
    }

    return argType;
  }

  public getErrors(): SemanticError[] {
    return this.errors;
  }

  public getSymbolCount(): number {
    return this.globalEnv.getSymbolCount();
  }
}

export function analyze(program: Stmt[]): {
  errors: SemanticError[];
  symbolCount: number;
} {
  const checker = new TypeChecker();
  const errors = checker.check(program);
  return {
    errors,
    symbolCount: checker.getSymbolCount(),
  };
}