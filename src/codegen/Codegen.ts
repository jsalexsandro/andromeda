import { Stmt, Expr, Token } from "../ast"
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
      // Statements
      case "ExpressionStmt":
        return this.visitExpressionStmt(node)
      case "BlockStmt":
        return this.visitBlockStmt(node)
      case "VariableStmt":
        return this.visitVariableStmt(node)
      case "IfStmt":
        return this.visitIfStmt(node)
      case "WhileStmt":
        return this.visitWhileStmt(node)
      case "ForStmt":
        return this.visitForStmt(node)
      case "FunctionStmt":
        return this.visitFunctionStmt(node)
      case "ReturnStmt":
        return this.visitReturnStmt(node)
      case "BreakStmt":
        return this.visitBreakStmt(node)
      case "ContinueStmt":
        return this.visitContinueStmt(node)

      // Expressions
      case "Literal":
        return this.visitLiteral(node)
      case "Identifier":
        return this.visitIdentifier(node)
      case "Binary":
      case "Logical":
        return this.visitBinary(node)
      case "Unary":
        return this.visitUnary(node)
      case "Group":
        return this.visitGroup(node)
      case "Call":
        return this.visitCall(node)
      case "Member":
        return this.visitMember(node)
      case "Assign":
        return this.visitAssign(node)
      case "Index":
        return this.visitIndex(node)
      case "Array":
        return this.visitArray(node)
      case "Object":
        return this.visitObject(node)
      case "Conditional":
        return this.visitConditional(node)
      case "NullishCoalescing":
        return this.visitNullishCoalescing(node)
      case "Spread":
        return this.visitSpread(node)
      case "ArrowFunction":
        return this.visitArrowFunction(node)

      default:
        this.ctx.writer.write(`/* TODO: ${node.kind} */`)
    }
  }

  visitEach(nodes: (Stmt | Expr)[]): void {
    for (const node of nodes) {
      this.visit(node)
    }
  }

  visitExpressionStmt(node: Expr & { kind: "ExpressionStmt" }): void {
    this.visit(node.expression)
    this.ctx.writer.writeLine(";")
  }

  visitBlockStmt(node: Stmt & { kind: "BlockStmt" }): void {
    this.ctx.writer.writeLine("{")
    this.ctx.writer.indent()
    for (let i = 0; i < node.statements.length; i++) {
      const stmt = node.statements[i]
      this.visit(stmt)
      if (i < node.statements.length - 1) {
        this.ctx.writer.writeLine("")
      }
    }
    this.ctx.writer.dedent()
    this.ctx.writer.writeLine("}")
  }

  visitVariableStmt(node: any): void {
    const keyword = node.declarationType
    const name = node.name.value as string
    this.ctx.writer.write(`${keyword} ${name}`)

    if (node.typeAnnotation) {
      this.ctx.writer.write(`: ${this.typeAnnotationToString(node.typeAnnotation)}`)
    }

    if (node.initializer) {
      this.ctx.writer.write(" = ")
      this.visit(node.initializer)
    }

    this.ctx.writer.writeLine(";")
  }

  visitIfStmt(node: any): void {
    this.ctx.writer.write("if (")
    this.visit(node.condition)
    this.ctx.writer.write(")")

    if (node.thenBranch.kind === "BlockStmt") {
      this.ctx.writer.write(" ")
      this.visit(node.thenBranch)
    } else {
      this.ctx.writer.writeLine("")
      this.ctx.writer.indent()
      this.visit(node.thenBranch)
      this.ctx.writer.dedent()
    }

    if (node.elseBranch) {
      if (node.elseBranch.kind === "IfStmt") {
        this.ctx.writer.write(" else ")
        this.visit(node.elseBranch)
      } else if (node.elseBranch.kind === "BlockStmt") {
        this.ctx.writer.write(" else ")
        this.visit(node.elseBranch)
      } else {
        this.ctx.writer.writeLine(" else")
        this.ctx.writer.indent()
        this.visit(node.elseBranch)
        this.ctx.writer.dedent()
      }
    }
  }

  visitWhileStmt(node: any): void {
    this.ctx.writer.write("while (")
    this.visit(node.condition)
    this.ctx.writer.write(") ")
    this.visit(node.body)
  }

  visitForStmt(node: any): void {
    this.ctx.writer.write("for (")
    if (node.initializer) {
      this.visit(node.initializer)
    }
    this.ctx.writer.write("; ")
    this.visit(node.condition)
    this.ctx.writer.write("; ")
    this.visit(node.update)
    this.ctx.writer.write(") ")
    this.visit(node.body)
  }

  visitFunctionStmt(node: any): void {
    const name = node.name.value as string
    const params = node.params.map((p: any) => {
      let paramStr = p.name.value as string
      if (p.type) {
        paramStr += `: ${this.typeAnnotationToString(p.type)}`
      }
      if (p.isRest) {
        paramStr = "..." + paramStr
      }
      return paramStr
    }).join(", ")

    this.ctx.writer.write(`function ${name}(${params}) `)
    this.visit(node.body)
  }

  visitReturnStmt(node: any): void {
    this.ctx.writer.write("return")
    if (node.value) {
      this.ctx.writer.write(" ")
      this.visit(node.value)
    }
    this.ctx.writer.writeLine(";")
  }

  visitBreakStmt(_node: any): void {
    this.ctx.writer.writeLine("break;")
  }

  visitContinueStmt(_node: any): void {
    this.ctx.writer.writeLine("continue;")
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

  visitIdentifier(node: Expr & { kind: "Identifier"; name: Token }): void {
    this.ctx.writer.write(node.name.value as string)
  }

  visitAssign(node: any): void {
    this.visit(node.name)
    this.ctx.writer.write(" = ")
    this.visit(node.value)
  }

  visitBinary(node: any): void {
    this.visit(node.left)
    this.ctx.writer.write(` ${node.operator.value} `)
    this.visit(node.right)
  }

  visitUnary(node: any): void {
    this.ctx.writer.write(node.operator.value)
    this.visit(node.right)
  }

  visitGroup(node: any): void {
    this.ctx.writer.write("(")
    this.visit(node.expression)
    this.ctx.writer.write(")")
  }

  visitCall(node: any): void {
    this.visit(node.callee)
    this.ctx.writer.write("(")
    const args = node.args || []
    for (let i = 0; i < args.length; i++) {
      if (i > 0) this.ctx.writer.write(", ")
      this.visit(args[i])
    }
    this.ctx.writer.write(")")
  }

  visitMember(node: any): void {
    this.visit(node.object)
    this.ctx.writer.write(".")
    this.ctx.writer.write(node.property.name.value as string)
  }

  visitIndex(node: any): void {
    this.visit(node.object)
    this.ctx.writer.write("[")
    this.visit(node.index)
    this.ctx.writer.write("]")
  }

  visitArray(node: any): void {
    this.ctx.writer.write("[")
    const elements = node.elements || []
    for (let i = 0; i < elements.length; i++) {
      if (i > 0) this.ctx.writer.write(", ")
      this.visit(elements[i])
    }
    this.ctx.writer.write("]")
  }

  visitObject(node: any): void {
    this.ctx.writer.write("{")
    const properties = node.properties || []
    for (let i = 0; i < properties.length; i++) {
      if (i > 0) this.ctx.writer.write(", ")
      const prop = properties[i]
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

  visitConditional(node: any): void {
    this.visit(node.condition)
    this.ctx.writer.write(" ? ")
    this.visit(node.consequent)
    this.ctx.writer.write(" : ")
    this.visit(node.alternate)
  }

  visitNullishCoalescing(node: any): void {
    this.visit(node.left)
    this.ctx.writer.write(" ?? ")
    this.visit(node.right)
  }

  visitSpread(node: any): void {
    this.ctx.writer.write("...")
    this.visit(node.argument)
  }

  visitArrowFunction(node: any): void {
    const params = node.params.map((p: any) => {
      let paramStr = p.name.value as string
      if (p.type) {
        paramStr += `: ${this.typeAnnotationToString(p.type)}`
      }
      if (p.isRest) {
        paramStr = "..." + paramStr
      }
      return paramStr
    }).join(", ")

    this.ctx.writer.write(`(${params})`)

    if (node.returnType) {
      this.ctx.writer.write(`: ${this.typeAnnotationToString(node.returnType)}`)
    }

    this.ctx.writer.write(" => ")

    if (node.body.kind === "BlockStmt") {
      this.visit(node.body)
    } else {
      this.visit(node.body)
    }
  }

  private typeAnnotationToString(annotation: any): string {
    if (!annotation) return ""

    if (typeof annotation === "string") {
      return annotation
    }

    if (annotation.base) {
      let result = annotation.base.value as string
      for (let i = 0; i < (annotation.dimensions || 0); i++) {
        result += "[]"
      }
      return result
    }

    if (annotation.value) {
      return annotation.value as string
    }

    return "any"
  }
}
