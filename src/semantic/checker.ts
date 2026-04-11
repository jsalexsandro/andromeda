import { Expr, Stmt, VariableStmt, IdentifierExpr, LiteralExpr, BinaryExpr, UnaryExpr } from "../ast"
import { Type, PrimitiveType, isSameType, canAssign } from "./types"
import { ScopeManager, Symbol, Scope } from "./scope"
import { SemanticErrorReporter, SemanticErrorType } from "./error"
import { TokenType } from "../lexer/types"

export class TypeChecker {
  private scopeManager: ScopeManager
  private errors: SemanticErrorReporter

  constructor(scopeManager: ScopeManager, errors: SemanticErrorReporter) {
    this.scopeManager = scopeManager
    this.errors = errors
  }

  check(stmts: Stmt[]): void {
    for (const stmt of stmts) {
      this.checkStatement(stmt)
    }
  }

  private checkStatement(stmt: Stmt): void {
    switch (stmt.kind) {
      case "VariableStmt":
        this.checkVariableDeclaration(stmt)
        break
      case "ExpressionStmt":
        if (stmt.expression) {
          this.checkExpression(stmt.expression)
        }
        break
      case "BlockStmt":
        this.scopeManager.pushScope("block")
        for (const s of stmt.statements) {
          this.checkStatement(s)
        }
        this.scopeManager.popScope()
        break
      case "IfStmt":
        this.checkStatement(stmt.thenBranch)
        if (stmt.elseBranch) {
          this.checkStatement(stmt.elseBranch)
        }
        break
      case "WhileStmt":
      case "ForStmt":
        this.checkStatement(stmt.body)
        break
      case "FunctionStmt":
        this.checkFunctionDeclaration(stmt)
        break
      case "ReturnStmt":
        if (stmt.value) {
          this.checkExpression(stmt.value)
        }
        break
    }
  }

  private checkVariableDeclaration(stmt: VariableStmt): Type {
    const name = stmt.name.value as string
    const declarationType = stmt.declarationType

    if (this.scopeManager.has(name)) {
      this.errors.report({
        type: SemanticErrorType.ALREADY_DECLARED,
        message: `Variable '${name}' is already declared`,
        line: stmt.name.line,
        column: stmt.name.column,
        node: stmt
      })
      return { kind: "unknown" }
    }

    if (declarationType === "val" && !stmt.typeAnnotation) {
      this.errors.report({
        type: SemanticErrorType.VAL_REQUIRES_TYPE,
        message: `Type annotation is required for 'val' declarations`,
        line: stmt.name.line,
        column: stmt.name.column,
        node: stmt
      })
    }

    let type: Type = { kind: "inferred" }
    if (stmt.typeAnnotation) {
      type = this.resolveTypeToken(stmt.typeAnnotation)
    }

    if (stmt.initializer) {
      const initType = this.checkExpression(stmt.initializer)

      if (declarationType !== "val" && type.kind === "inferred") {
        type = initType
      } else if (!canAssign(initType, type)) {
        this.errors.report({
          type: SemanticErrorType.TYPE_MISMATCH,
          message: `Cannot assign type to variable`,
          line: stmt.name.line,
          column: stmt.name.column,
          node: stmt
        })
      }
    }

    this.scopeManager.define({
      name,
      type,
      declarationType,
      scope: this.scopeManager.currentScope,
      initializerNode: stmt.initializer
    })

    return type
  }

  private checkFunctionDeclaration(stmt: any): void {
    this.scopeManager.pushScope(stmt.name.value)

    for (const param of stmt.params || []) {
      let paramType: Type = { kind: "inferred" }
      if (param.type) {
        paramType = this.resolveTypeToken(param.type)
      }
      this.scopeManager.define({
        name: param.name.value,
        type: paramType,
        declarationType: "var",
        scope: this.scopeManager.currentScope
      })
    }

    let returnType: Type = "void"
    if (stmt.returnType) {
      returnType = this.resolveTypeToken(stmt.returnType)
    }

    if (stmt.body) {
      this.checkStatement(stmt.body)
    }

    this.scopeManager.popScope()

    this.scopeManager.define({
      name: stmt.name.value,
      type: { kind: "function", params: [], returnType },
      declarationType: "const",
      scope: this.scopeManager.getGlobalScope()
    })
  }

  checkExpression(expr: Expr): Type {
    switch (expr.kind) {
      case "Literal":
        return this.getLiteralType(expr)

      case "Identifier":
        return this.resolveIdentifier(expr)

      case "Binary":
        return this.checkBinaryExpression(expr)

      case "Unary":
        return this.checkUnaryExpression(expr)

      case "Group":
        if (expr.expression) {
          return this.checkExpression(expr.expression)
        }
        return { kind: "unknown" }

      case "Call":
        return this.checkCallExpression(expr)

      case "Array":
        let elementType: Type = { kind: "unknown" }
        for (const el of expr.elements || []) {
          const t = this.checkExpression(el)
          if (elementType.kind === "unknown") {
            elementType = t
          } else if (!isSameType(t, elementType)) {
            this.errors.report({
              type: SemanticErrorType.TYPE_MISMATCH,
              message: `Array elements must be of same type`,
              line: (el as any).line || 0,
              column: (el as any).column || 0
            })
          }
        }
        return { kind: "array", elementType }

      case "Object":
        const properties = new Map<string, Type>()
        for (const prop of expr.properties || []) {
          const t = prop.value ? this.checkExpression(prop.value) : { kind: "unknown" }
          properties.set(prop.key as string, t)
        }
        return { kind: "object", properties }

      case "Conditional":
        this.checkExpression(expr.condition)
        const consequentType = this.checkExpression(expr.consequent)
        const alternateType = this.checkExpression(expr.alternate)
        if (!isSameType(consequentType, alternateType)) {
          this.errors.report({
            type: SemanticErrorType.TYPE_MISMATCH,
            message: `Ternary branches must have same type`,
            line: (expr as any).line || 0,
            column: (expr as any).column || 0
          })
        }
        return consequentType

      case "Member":
        return this.checkMemberExpression(expr)

      case "Index":
        return this.checkIndexExpression(expr)

      default:
        return { kind: "unknown" }
    }
  }

  private getLiteralType(expr: LiteralExpr): Type {
    const value = expr.value
    if (value === null) return "null"
    if (typeof value === "number") {
      return Number.isInteger(value) ? "int" : "float"
    }
    if (typeof value === "boolean") return "bool"
    if (typeof value === "string") return "string"
    return { kind: "unknown" }
  }

  private resolveIdentifier(expr: IdentifierExpr): Type {
    const name = expr.name.value as string
    const symbol = this.scopeManager.resolve(name)

    if (!symbol) {
      this.errors.report({
        type: SemanticErrorType.UNDEFINED_VARIABLE,
        message: `Variable '${name}' is not defined`,
        line: expr.name.line,
        column: expr.name.column,
        node: expr
      })
      return { kind: "unknown" }
    }

    return symbol.type
  }

  private checkBinaryExpression(expr: BinaryExpr): Type {
    const leftType = this.checkExpression(expr.left)
    const rightType = this.checkExpression(expr.right)
    const operator = expr.operator.value as string

    if (["+", "-", "*", "/", "%"].includes(operator)) {
      if (!isSameType(leftType, rightType)) {
        this.errors.report({
          type: SemanticErrorType.TYPE_MISMATCH,
          message: `Operator '${operator}' requires same types`,
          line: expr.operator.line,
          column: expr.operator.column,
          node: expr
        })
      }
      // For arithmetic, return int if both operands are int, float otherwise
      return (leftType === "int" && rightType === "int") ? "int" : "float"
    }

    if (["==", "!=", ">", "<", ">=", "<="].includes(operator)) {
      return "bool"
    }

    if (["&&", "||"].includes(operator)) {
      if (leftType !== "bool" || rightType !== "bool") {
        this.errors.report({
          type: SemanticErrorType.TYPE_MISMATCH,
          message: `Logical operators require boolean operands`,
          line: expr.operator.line,
          column: expr.operator.column,
          node: expr
        })
      }
      return "bool"
    }

    return { kind: "unknown" }
  }

  private checkUnaryExpression(expr: UnaryExpr): Type {
    const rightType = this.checkExpression(expr.right)
    const operator = expr.operator.value as string

    if (operator === "-") {
      // Se operando é número, retorna int; caso contrário usa o tipo do operando
      if (rightType === "int" || rightType === "float") {
        return rightType
      }
      return rightType
    }
    if (operator === "!") return "bool"
    if (operator === "+") return rightType

    return { kind: "unknown" }
  }

  private checkCallExpression(expr: any): Type {
    return { kind: "unknown" }
  }

  private checkMemberExpression(expr: any): Type {
    const objectType = this.checkExpression(expr.object)
    if (objectType.kind === "object") {
      const prop = expr.property.name.value as string
      return objectType.properties.get(prop) || { kind: "unknown" }
    }
    return { kind: "unknown" }
  }

  private checkIndexExpression(expr: any): Type {
    const objectType = this.checkExpression(expr.object)
    if (objectType.kind === "array") {
      return objectType.elementType
    }
    return { kind: "unknown" }
  }

  private resolveTypeToken(token: any): Type {
    if (!token) return { kind: "unknown" }

    const typeValue = token.value as string
    const primitives: PrimitiveType[] = ["int", "float", "bool", "string", "void", "null"]
    if (primitives.includes(typeValue as PrimitiveType)) {
      return typeValue as PrimitiveType
    }

    if (token.type === TokenType.TYPE_INT) return "int"
    if (token.type === TokenType.TYPE_FLOAT) return "float"
    if (token.type === TokenType.TYPE_BOOL) return "bool"
    if (token.type === TokenType.TYPE_STRING) return "string"
    if (token.type === TokenType.TYPE_VOID) return "void"

    return { kind: "unknown" }
  }
}