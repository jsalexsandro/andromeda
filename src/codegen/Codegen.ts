import { Stmt, Expr } from "../ast"
import { CodegenContext } from "./CodegenContext"

export class Codegen {
  protected ctx: CodegenContext

  constructor(ctx: CodegenContext) {
    this.ctx = ctx
  }

  generate(statements: Stmt[]): string {
    this.ctx.reset()
    for (let i = 0; i < statements.length; i++) {
      if (i > 0) {
        this.ctx.writer.writeBlankLine()
      }
      this.visit(statements[i])
    }
    return this.ctx.writer.getOutput().trim()
  }

  visit(node: Stmt | Expr): void {
    switch (node.kind) {
      case "ExpressionStmt":
        return this.visitExpressionStmt(node)
      case "BlockStmt":
        return this.visitBlockStmt(node)
      case "VariableStmt":
        return this.visitVariableStmt(node)
      case "Assign":
        return this.visitAssign(node)
      case "Literal":
        return this.visitLiteral(node)
      case "Identifier":
        return this.visitIdentifier(node)
      case "Binary":
        return this.visitBinary(node)
      case "Unary":
        return this.visitUnary(node)
      case "Array":
        return this.visitArray(node)
      case "Object":
        return this.visitObject(node)
      case "IfStmt":
        return this.visitIfStmt(node)
      case "WhileStmt":
        return this.visitWhileStmt(node)
      case "BreakStmt":
        return this.visitBreakStmt(node)
      case "ContinueStmt":
        return this.visitContinueStmt(node)
      case "Group":
        return this.visitGroup(node)
      case "Member":
        return this.visitMember(node)
      case "Index":
        return this.visitIndex(node)
      case "Call":
        return this.visitCall(node)
      case "FunctionStmt":
        return this.visitFunctionStmt(node)
      case "ReturnStmt":
        return this.visitReturnStmt(node)
      case "Conditional":
        return this.visitConditional(node)
      case "NullishCoalescing":
        return this.visitNullishCoalescing(node)
      case "ArrowFunction":
        return this.visitArrowFunction(node)

      default:
        throw new Error(`Codegen: unsupported node kind '${node.kind}'`)
    }
  }

  visitVariableStmt(node: Stmt & { kind: "VariableStmt"; declarationType: "var" | "val" | "const"; name: any; initializer?: Expr }): void {
    const keyword = node.declarationType === "val" ? "let" : node.declarationType
    const name = node.name.value as string
    
    this.ctx.writer.write(`${keyword} ${name}`)
    
    if (node.initializer) {
      this.ctx.writer.write(" = ")
      this.visit(node.initializer)
    }
    
    this.ctx.writer.writeLine(";")
  }

  visitAssign(node: Expr & { kind: "Assign"; name: Expr; value: Expr; operator?: any }): void {
    this.visit(node.name)
    
    if (node.operator) {
      this.ctx.writer.write(` ${node.operator.value} `)
    } else {
      this.ctx.writer.write(" = ")
    }
    
    this.visit(node.value)
  }

  visitExpressionStmt(node: Stmt & { kind: "ExpressionStmt"; expression: Expr }): void {
    this.visit(node.expression)
    this.ctx.writer.writeLine(";")
  }

  visitBlockStmt(node: Stmt & { kind: "BlockStmt"; statements: Stmt[] }): void {
    this.ctx.writer.writeLine("{")
    this.ctx.writer.indent()
    for (const stmt of node.statements) {
      this.visit(stmt)
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

  visitArray(node: Expr & { kind: "Array"; elements: Expr[] }): void {
    this.ctx.writer.write("[")
    for (let i = 0; i < node.elements.length; i++) {
      if (i > 0) {
        this.ctx.writer.write(", ")
      }
      this.visit(node.elements[i])
    }
    this.ctx.writer.write("]")
  }

  visitObject(node: Expr & { kind: "Object"; properties: { key: string | null; value: Expr }[] }): void {
    this.ctx.writer.write("{")
    for (let i = 0; i < node.properties.length; i++) {
      if (i > 0) {
        this.ctx.writer.write(", ")
      }
      const prop = node.properties[i]
      if (prop.key === null) {
        this.ctx.writer.write("...")
        this.visit(prop.value)
      } else {
        this.ctx.writer.write(prop.key)
        this.ctx.writer.write(": ")
        this.visit(prop.value)
      }
    }
    this.ctx.writer.write("}")
  }

  visitIfStmt(node: Stmt & { kind: "IfStmt"; condition: Expr; thenBranch: Stmt; elseBranch?: Stmt }): void {
    this.ctx.writer.write("if (")
    this.visit(node.condition)
    this.ctx.writer.write(") ")

    this.visit(node.thenBranch)

    if (node.elseBranch) {
      if (node.elseBranch.kind === "IfStmt") {
        this.ctx.writer.write(" else ")
        this.visit(node.elseBranch)
      } else {
        this.ctx.writer.write(" else ")
        this.visit(node.elseBranch)
      }
    }
  }

  visitWhileStmt(node: Stmt & { kind: "WhileStmt"; condition: Expr; body: Stmt }): void {
    this.ctx.writer.write("while (")
    this.visit(node.condition)
    this.ctx.writer.write(") ")
    this.visit(node.body)
  }

  visitBreakStmt(_node: Stmt & { kind: "BreakStmt" }): void {
    this.ctx.writer.writeLine("break;")
  }

  visitContinueStmt(_node: Stmt & { kind: "ContinueStmt" }): void {
    this.ctx.writer.writeLine("continue;")
  }

  visitGroup(node: Expr & { kind: "Group"; expression: Expr }): void {
    this.ctx.writer.write("(")
    this.visit(node.expression)
    this.ctx.writer.write(")")
  }

  visitMember(node: Expr & { kind: "Member"; object: Expr; property: any }): void {
    this.visit(node.object)
    this.ctx.writer.write(".")
    this.ctx.writer.write(node.property.name.value as string)
  }

  visitIndex(node: Expr & { kind: "Index"; object: Expr; index: Expr }): void {
    this.visit(node.object)
    this.ctx.writer.write("[")
    this.visit(node.index)
    this.ctx.writer.write("]")
  }

  visitCall(node: Expr & { kind: "Call"; callee: Expr; args: Expr[] }): void {
    this.visit(node.callee)
    this.ctx.writer.write("(")
    for (let i = 0; i < node.args.length; i++) {
      if (i > 0) {
        this.ctx.writer.write(", ")
      }
      this.visit(node.args[i])
    }
    this.ctx.writer.write(")")
  }

  visitFunctionStmt(node: Stmt & { kind: "FunctionStmt"; name: any; params: any[]; returnType?: any; body: Stmt }): void {
    this.ctx.writer.write("function ")
    this.ctx.writer.write(node.name.value as string)
    this.ctx.writer.write("(")
    
    for (let i = 0; i < node.params.length; i++) {
      if (i > 0) {
        this.ctx.writer.write(", ")
      }
      this.ctx.writer.write(node.params[i].name.value as string)
    }
    
    this.ctx.writer.write(") ")
    this.visit(node.body)
  }

  visitReturnStmt(node: Stmt & { kind: "ReturnStmt"; value?: Expr }): void {
    this.ctx.writer.write("return")
    if (node.value) {
      this.ctx.writer.write(" ")
      this.visit(node.value)
    }
    this.ctx.writer.writeLine(";")
  }

  visitConditional(node: Expr & { kind: "Conditional"; condition: Expr; consequent: Expr; alternate: Expr }): void {
    this.visit(node.condition)
    this.ctx.writer.write(" ? ")
    this.visit(node.consequent)
    this.ctx.writer.write(" : ")
    this.visit(node.alternate)
  }

  visitNullishCoalescing(node: Expr & { kind: "NullishCoalescing"; left: Expr; right: Expr }): void {
    this.visit(node.left)
    this.ctx.writer.write(" ?? ")
    this.visit(node.right)
  }

  visitArrowFunction(node: Expr & { kind: "ArrowFunction"; params: any[]; body: Expr | Stmt }): void {
    this.ctx.writer.write("(")
    for (let i = 0; i < node.params.length; i++) {
      if (i > 0) {
        this.ctx.writer.write(", ")
      }
      this.ctx.writer.write(node.params[i].name.value as string)
    }
    this.ctx.writer.write(") => ")
    
    if (node.body.kind === "BlockStmt") {
      this.ctx.writer.write("{ ")
      for (const stmt of node.body.statements) {
        if (stmt.kind === "ReturnStmt") {
          this.ctx.writer.write("return")
          if (stmt.value) {
            this.ctx.writer.write(" ")
            this.visit(stmt.value)
          }
        } else {
          this.visit(stmt)
        }
      }
      this.ctx.writer.write(" }")
    } else {
      this.visit(node.body)
    }
  }
}
