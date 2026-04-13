import { Stmt, Expr } from "../ast"
import { CodegenContext } from "./CodegenContext"

export class Codegen {
  protected ctx: CodegenContext

  constructor(ctx: CodegenContext) {
    this.ctx = ctx
  }

  generate(statements: Stmt[]): string {
    this.ctx.reset()
    for (const stmt of statements) {
      this.visit(stmt)
      this.ctx.writer.writeBlankLine()
    }
    return this.ctx.writer.getOutput()
  }

  visit(node: Stmt | Expr): void {
    switch (node.kind) {
      case "ExpressionStmt":
        return this.visitExpressionStmt(node)
      case "BlockStmt":
        return this.visitBlockStmt(node)
      case "Literal":
        return this.visitLiteral(node)
      case "Identifier":
        return this.visitIdentifier(node)
      case "Binary":
        return this.visitBinary(node)
      case "Unary":
        return this.visitUnary(node)

      default:
        this.ctx.writer.write(`/* TODO: ${node.kind} */`)
    }
  }

  visitExpressionStmt(node: Stmt & { kind: "ExpressionStmt"; expression: Expr }): void {
    this.visit(node.expression)
    this.ctx.writer.writeLine(";")
  }

  visitBlockStmt(node: Stmt & { kind: "BlockStmt"; statements: Stmt[] }): void {
    this.ctx.writer.writeLine("{")
    this.ctx.writer.indent()
    for (let i = 0; i < node.statements.length; i++) {
      if (i > 0) {
        this.ctx.writer.writeBlankLine()
      }
      this.visit(node.statements[i])
    }
    this.ctx.writer.dedent()
    this.ctx.writer.writeLine("}")
  }

  visitLiteral(node: Expr & { kind: "Literal"; value: any }): void {
    if (node.value === null) {
      this.ctx.writer.write("null")
    } else if (typeof node.value === "string") {
      this.ctx.writer.write(JSON.stringify(node.value))
    } else if (typeof node.value === "boolean") {
      this.ctx.writer.write(node.value ? "true" : "false")
    } else {
      this.ctx.writer.write(String(node.value))
    }
  }

  visitIdentifier(node: Expr & { kind: "Identifier"; name: any }): void {
    this.ctx.writer.write(node.name.value as string)
  }

  visitBinary(node: Expr & { kind: "Binary"; left: Expr; operator: any; right: Expr }): void {
    this.visit(node.left)
    this.ctx.writer.write(` ${node.operator.value} `)
    this.visit(node.right)
  }

  visitUnary(node: Expr & { kind: "Unary"; operator: any; right: Expr }): void {
    this.ctx.writer.write(node.operator.value)
    this.visit(node.right)
  }
}
