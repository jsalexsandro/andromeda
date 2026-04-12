import { Expr, Stmt, LiteralExpr, IdentifierExpr, UnaryExpr, BinaryExpr, GroupExpr } from "../../ast"
import { AndroType, Primitive, TypeKind } from "../types"
import { TypeChecker } from "../TypeChecker"
import { AnalyzerContext, AnalyzerError, createContext } from "./types"
import { SemanticErrorHandler } from "../SemanticError"

export class Analyzer {
  private errors: SemanticErrorHandler
  private context: AnalyzerContext
  private inLoop: boolean = false
  private inFunction: boolean = false

  constructor(errors?: SemanticErrorHandler) {
    this.errors = errors || new SemanticErrorHandler()
    this.context = createContext()
  }

  private report(code: string, message: string, line: number, column: number) {
    this.errors.report(`[${code}] ${message}`, line, column)
  }

  private getLineColumn(node: { line?: number; column?: number }): [number, number] {
    return [node.line ?? 0, node.column ?? 0]
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
        for (const s of stmt.statements) {
          this.analyzeStatement(s)
        }
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

      case "Group":
        return this.analyzeExpression(expr.expression)

      case "Unary":
        return this.visitUnary(expr)

      case "Binary":
      case "Logical":
        return this.visitBinary(expr as BinaryExpr)

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
    return Primitive.unknown()
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

  analyzeVariable(stmt: any): void {
    if (stmt.initializer) {
      this.analyzeExpression(stmt.initializer)
    }
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
