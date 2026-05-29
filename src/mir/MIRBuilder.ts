import { Stmt, Expr, TypeNode } from "../ast"
import { VariableStmt, FunctionStmt, ReturnStmt, ExpressionStmt, BlockStmt, IfStmt, WhileStmt } from "../ast"
import { LiteralExpr, UnaryExpr, IdentifierExpr, BinaryExpr, GroupExpr, ConditionalExpr, NullishCoalescingExpr, AssignExpr } from "../ast"
import { IRGenerator } from "./IRGenerator"
import { MIRProgram, MIRFunction, MIRInstruction, IRValue, BinaryOp, UnaryOp } from "./types"

export class MIRBuilder extends IRGenerator {
  private program: Stmt[]
  private resolvedTypes: Map<Expr, TypeNode>
  private ssaVersions = new Map<string, number>()
  private ssaMax = new Map<string, number>()

  constructor(program: Stmt[], resolvedTypes?: Map<Expr, TypeNode>) {
    super()
    this.program = program
    this.resolvedTypes = resolvedTypes ?? new Map()
  }

  // ─── SSA helpers ─────────────────────────────────────────

  private ssaName(name: string, ver: number): string {
    return `${name}_${ver}`
  }

  private resolveSSA(name: string): string {
    const ver = this.ssaVersions.get(name)
    return ver !== undefined ? this.ssaName(name, ver) : name
  }

  private defineSSA(name: string): string {
    const cur = this.ssaVersions.get(name) ?? -1
    const max = this.ssaMax.get(name) ?? -1
    const ver = Math.max(cur, max) + 1
    this.ssaVersions.set(name, ver)
    this.ssaMax.set(name, ver)
    return this.ssaName(name, ver)
  }

  private saveSSA(): Map<string, number> {
    return new Map(this.ssaVersions)
  }

  private restoreSSA(state: Map<string, number>): void {
    this.ssaVersions = state
  }

  // ─── Entry point ──────────────────────────────────────────

  build(): MIRProgram {
    const globals: MIRInstruction[] = []
    const mirFunctions: MIRFunction[] = []

    for (const stmt of this.program) {
      if (stmt.kind === "FunctionStmt") {
        const fn = this.emitFunction(stmt)
        mirFunctions.push(fn)
      } else {
        this.emitStmt(stmt)
        globals.push(...this.instructions)
        this.instructions = []
      }
    }

    return {
      functions: mirFunctions,
      globals,
      structs: [],
    }
  }

  // ─── Statement lowering ───────────────────────────────────

  private emitStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case "VariableStmt":
        return this.emitVariableStmt(stmt)
      case "ExpressionStmt":
        return this.emitExpressionStmt(stmt)
      case "ReturnStmt":
        return this.emitReturnStmt(stmt)
      case "BlockStmt":
        return this.emitBlockStmt(stmt)
      case "IfStmt":
        return this.emitIfStmt(stmt)
      case "WhileStmt":
        return this.emitWhileStmt(stmt)
      default:
        break
    }
  }

  // ─── VariableStmt (val / var) ─────────────────────────────

  private emitVariableStmt(stmt: VariableStmt): void {
    const name = stmt.name.value as string
    if (stmt.initializer) {
      const val = this.emitExpr(stmt.initializer)
      if (stmt.declarationType === "var") {
        const ssa = this.defineSSA(name)
        this.emitCopy(ssa, val)
      } else {
        this.emitCopy(name, val)
      }
    }
  }

  // ─── ExpressionStmt ───────────────────────────────────────

  private emitExpressionStmt(stmt: ExpressionStmt): void {
    if (stmt.expression.kind === "Assign") {
      this.emitAssignExpr(stmt.expression)
      return
    }
    this.emitExpr(stmt.expression)
  }

  // ─── AssignExpr (a = expr) ────────────────────────────────

  private emitAssignExpr(node: AssignExpr): string {
    if (node.name.kind !== "Identifier") {
      return this.emitUnknown(node)
    }
    const name = (node.name as IdentifierExpr).name.value as string
    const val = this.emitExpr(node.value)

    if (this.ssaVersions.has(name)) {
      const ssa = this.defineSSA(name)
      this.emitCopy(ssa, val)
      return ssa
    }

    return this.emitUnknown(node)
  }

  // ─── ReturnStmt ───────────────────────────────────────────

  private emitReturnStmt(stmt: ReturnStmt): void {
    if (stmt.value) {
      const val = this.emitExpr(stmt.value)
      this.emitReturn(val)
    } else {
      this.emitReturn(null)
    }
  }

  // ─── BlockStmt ────────────────────────────────────────────

  private emitBlockStmt(stmt: BlockStmt): void {
    for (const s of stmt.statements) {
      this.emitStmt(s)
    }
  }

  // ─── IfStmt (com SSA phi) ─────────────────────────────────

  private emitIfStmt(stmt: IfStmt): void {
    const preIf = this.saveSSA()

    const cond = this.emitExpr(stmt.condition)
    const thenBlock = this.freshLabel("then")
    const elseBlock = this.freshLabel("else")
    const endBlock = this.freshLabel("end")

    this.emitJumpIf(cond, thenBlock, elseBlock)

    this.emitBlock(thenBlock)
    this.emitStmt(stmt.thenBranch)
    const afterThen = this.saveSSA()
    this.emitJump(endBlock)

    this.restoreSSA(preIf)
    this.emitBlock(elseBlock)
    if (stmt.elseBranch) {
      this.emitStmt(stmt.elseBranch)
    }
    const afterElse = this.saveSSA()

    this.restoreSSA(preIf)
    this.emitBlock(endBlock)
    this.emitBlockPhi(preIf, afterThen, afterElse, thenBlock, elseBlock)
  }

  // ─── WhileStmt ────────────────────────────────────────────

  private emitWhileStmt(stmt: WhileStmt): void {
    const loopBlock = this.freshLabel("loop")
    const bodyBlock = this.freshLabel("body")
    const exitBlock = this.freshLabel("exit")

    this.emitBlock(loopBlock)
    const cond = this.emitExpr(stmt.condition)
    this.emitJumpIf(cond, bodyBlock, exitBlock)

    this.emitBlock(bodyBlock)
    this.emitStmt(stmt.body)
    this.emitJump(loopBlock)

    this.emitBlock(exitBlock)
  }

  // ─── FunctionStmt ─────────────────────────────────────────

  private emitFunction(stmt: FunctionStmt): MIRFunction {
    this.instructions = []
    this.tempCount = 0
    this.labelCount = 0
    this.ssaVersions = new Map()
    this.ssaMax = new Map()

    const name = stmt.name.value as string
    const params = stmt.params.map(p => ({
      name: p.name.value as string,
      type: p.type ? this.typeToString(p.type) : "unknown",
    }))
    const returnType = stmt.returnType
      ? this.typeToString(stmt.returnType)
      : "void"

    this.emitStmt(stmt.body)

    const fn: MIRFunction = {
      name,
      params,
      returnType,
      instructions: [...this.instructions],
      isArrow: false,
    }

    return fn
  }

  // ─── Helpers ──────────────────────────────────────────────

  private typeToString(type: TypeNode): string {
    switch (type.kind) {
      case "PrimitiveType": return type.name
      case "NamedType":     return type.name.value as string
      case "GenericType": {
        const name = type.name.value as string
        const args = type.args.map(a => this.typeToString(a)).join(", ")
        return `${name}<${args}>`
      }
      case "NullableType":  return `${this.typeToString(type.type)}?`
      case "ArrayType":     return `${this.typeToString(type.elementType)}[]`
      case "UnionType":     return type.types.map(t => this.typeToString(t)).join(" | ")
      default:              return "unknown"
    }
  }

  private getType(expr: Expr): TypeNode | undefined {
    return this.resolvedTypes.get(expr)
  }

  // ─── Phi join helper ──────────────────────────────────────

  private emitBlockPhi(
    pre: Map<string, number>,
    afterA: Map<string, number>,
    afterB: Map<string, number>,
    blockA: string,
    blockB: string,
  ): void {
    const allVars = new Set([...pre.keys(), ...afterA.keys(), ...afterB.keys()])

    for (const name of allVars) {
      const preVer = pre.get(name)
      const aVer = afterA.get(name)
      const bVer = afterB.get(name)

      if (preVer === undefined) {
        continue
      }

      if (aVer !== bVer) {
        const aVal = aVer !== undefined ? this.ssaName(name, aVer) : this.resolveSSA(name)
        const bVal = bVer !== undefined ? this.ssaName(name, bVer) : this.resolveSSA(name)
        const cur = this.ssaVersions.get(name) ?? -1
        const max = this.ssaMax.get(name) ?? -1
        const newVer = Math.max(cur, max) + 1
        const dest = this.ssaName(name, newVer)
        this.ssaVersions.set(name, newVer)
        this.ssaMax.set(name, newVer)
        this.emitPhi(dest, [
          { block: blockA, value: aVal },
          { block: blockB, value: bVal },
        ])
      } else if (aVer !== preVer && aVer !== undefined) {
        const cur = this.ssaVersions.get(name) ?? -1
        const max = this.ssaMax.get(name) ?? -1
        const newVer = Math.max(cur, max) + 1
        this.ssaVersions.set(name, newVer)
        this.ssaMax.set(name, newVer)
        this.emitCopy(this.ssaName(name, newVer), this.ssaName(name, aVer))
      }
    }
  }

  // ─── Expression lowering ──────────────────────────────────

  emitExpr(node: Expr): string {
    switch (node.kind) {
      case "Literal":    return this.emitLiteral(node)
      case "Identifier": return this.emitIdentifierExpr(node)
      case "Group":      return this.emitExpr(node.expression)
      case "Unary":     return this.emitUnaryExpr(node)
      case "Binary":     return this.emitBinaryExpr(node)
      case "Assign":     return this.emitAssignExpr(node)
      case "Conditional":     return this.emitConditional(node)
      case "NullishCoalescing": return this.emitNullishCoalescing(node)
      default:
        return this.emitUnknown(node)
    }
  }

  // ─── Literais ─────────────────────────────────────────────

  private emitLiteral(node: LiteralExpr): string {
    const dest = this.freshTemp()
    const value = this.toIRValue(node)
    this.emitConst(dest, value)
    return dest
  }

  private toIRValue(node: LiteralExpr): IRValue {
    if (node.value === null || node.value === undefined) {
      return { kind: "null" }
    }
    if (typeof node.value === "boolean") {
      return { kind: "bool", value: node.value }
    }
    if (typeof node.value === "string") {
      return { kind: "string", value: node.value }
    }
    if (typeof node.value === "number") {
      if (node.isFloat) {
        return { kind: "float", value: node.value }
      }
      return { kind: "int", value: node.value }
    }
    return { kind: "null" }
  }

  // ─── Identificadores (sem copy!) ──────────────────────────

  private emitIdentifierExpr(node: IdentifierExpr): string {
    const name = node.name.value as string
    return this.resolveSSA(name)
  }

  // ─── Unário ───────────────────────────────────────────────

  private emitUnaryExpr(node: UnaryExpr): string {
    const op = node.operator.value as string
    let unaryOp: UnaryOp

    if (op === "-")      unaryOp = "neg"
    else if (op === "!") unaryOp = "not"
    else if (op === "+") {
      return this.emitExpr(node.right)
    }
    else {
      return this.emitExpr(node.right)
    }

    const dest = this.freshTemp()
    const operand = this.emitExpr(node.right)
    this.emitUnary(dest, unaryOp, operand)
    return dest
  }

  // ─── Binária ──────────────────────────────────────────────

  private emitBinaryExpr(node: BinaryExpr): string {
    const left = this.emitExpr(node.left)
    const right = this.emitExpr(node.right)
    const op = node.operator.value as string

    const binaryOp = this.toBinaryOp(op)
    if (!binaryOp) {
      return left
    }

    const dest = this.freshTemp()
    this.emitBinary(dest, left, binaryOp, right)
    return dest
  }

  private toBinaryOp(op: string): BinaryOp | null {
    switch (op) {
      case "+":  return "add"
      case "-":  return "sub"
      case "*":  return "mul"
      case "/":  return "div"
      case "%":  return "mod"
      case "==": return "eq"
      case "!=": return "ne"
      case "<":  return "lt"
      case ">":  return "gt"
      case "<=": return "le"
      case ">=": return "ge"
      case "&&": return "and"
      case "||": return "or"
      default:   return null
    }
  }

  // ─── Ternário (com phi + block) ───────────────────────────

  private emitConditional(node: ConditionalExpr): string {
    const preCond = this.saveSSA()

    const cond = this.emitExpr(node.condition)
    const thenBlock = this.freshLabel("then")
    const elseBlock = this.freshLabel("else")
    const endBlock = this.freshLabel("end")

    this.emitJumpIf(cond, thenBlock, elseBlock)

    this.emitBlock(thenBlock)
    const consVal = this.emitExpr(node.consequent)
    const afterThen = this.saveSSA()
    const consTemp = this.freshTemp()
    this.emitCopy(consTemp, consVal)
    this.emitJump(endBlock)

    this.restoreSSA(preCond)
    this.emitBlock(elseBlock)
    const altVal = this.emitExpr(node.alternate)
    const afterElse = this.saveSSA()
    const altTemp = this.freshTemp()
    this.emitCopy(altTemp, altVal)

    this.restoreSSA(preCond)
    this.emitBlock(endBlock)
    this.emitBlockPhi(preCond, afterThen, afterElse, thenBlock, elseBlock)

    const result = this.freshTemp()
    this.emitPhi(result, [
      { block: thenBlock, value: consTemp },
      { block: elseBlock, value: altTemp },
    ])
    return result
  }

  // ─── Nullish Coalescing (com notNull) ─────────────────────

  private emitNullishCoalescing(node: NullishCoalescingExpr): string {
    const preCond = this.saveSSA()

    const left = this.emitExpr(node.left)
    const nnBlock = this.freshLabel("nn")
    const isNullBlock = this.freshLabel("isnull")
    const endBlock = this.freshLabel("end")

    const check = this.freshTemp()
    this.emitNotNull(check, left)

    this.emitJumpIf(check, nnBlock, isNullBlock)

    this.emitBlock(nnBlock)
    const leftTemp = this.freshTemp()
    this.emitCopy(leftTemp, left)
    const afterNn = this.saveSSA()
    this.emitJump(endBlock)

    this.restoreSSA(preCond)
    this.emitBlock(isNullBlock)
    const right = this.emitExpr(node.right)
    const afterIsNull = this.saveSSA()
    const rightTemp = this.freshTemp()
    this.emitCopy(rightTemp, right)

    this.restoreSSA(preCond)
    this.emitBlock(endBlock)
    this.emitBlockPhi(preCond, afterNn, afterIsNull, nnBlock, isNullBlock)

    const result = this.freshTemp()
    this.emitPhi(result, [
      { block: nnBlock, value: leftTemp },
      { block: isNullBlock, value: rightTemp },
    ])
    return result
  }

  // ─── Fallback ─────────────────────────────────────────────

  private emitUnknown(node: Expr): string {
    const dest = this.freshTemp()
    this.emitConst(dest, { kind: "null" })
    return dest
  }
}
