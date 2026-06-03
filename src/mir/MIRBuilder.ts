import { Stmt, Expr, TypeNode } from "../ast"
import { VariableStmt, FunctionStmt, ReturnStmt, ExpressionStmt, BlockStmt, IfStmt, WhileStmt, ForStmt, BreakStmt, ContinueStmt } from "../ast"
import { LiteralExpr, UnaryExpr, IdentifierExpr, BinaryExpr, GroupExpr, ConditionalExpr, NullishCoalescingExpr, AssignExpr, CallExpr, NamedArgumentExpr } from "../ast"
import { IRGenerator } from "./IRGenerator"
import { MIRProgram, MIRFunction, MIRInstruction, IRValue, BinaryOp, UnaryOp } from "./types"

export class MIRBuilder extends IRGenerator {
  private program: Stmt[]
  private resolvedTypes: Map<Expr, TypeNode>
  private ssaVersions = new Map<string, number>()
  private ssaMax = new Map<string, number>()
  private knownConstants = new Map<string, IRValue>()
  private tempConstants = new Map<string, IRValue>()
  private loopStack: { breakTarget: string; continueTarget: string }[] = []
  private mirFunctions: MIRFunction[] = []
  private paramNames = new Map<string, string[]>()
  private capturedVars = new Map<string, Set<string>>()
  private cellForVar = new Map<string, string>()
  private currentCapturedVars = new Set<string>()

  constructor(program: Stmt[], resolvedTypes?: Map<Expr, TypeNode>) {
    super()
    this.program = program
    this.resolvedTypes = resolvedTypes ?? new Map()
  }

  // ─── Override emit helpers (constant propagation via temps) ─

  protected emitConst(dest: string, value: IRValue): void {
    this.tempConstants.set(dest, value)
    super.emitConst(dest, value)
  }

  protected emitCopy(dest: string, src: string): void {
    const srcVal = this.tempConstants.get(src)
    if (srcVal) {
      this.tempConstants.set(dest, srcVal)
    }
    super.emitCopy(dest, src)
  }

  protected emitPhi(dest: string, pairs: { block: string; value: string }[]): void {
    const firstVal = this.tempConstants.get(pairs[0].value)
    const allSameConst = firstVal && pairs.every(p => {
      const v = this.tempConstants.get(p.value)
      return v && this.irValuesEqual(v, firstVal)
    })
    if (allSameConst) {
      this.tempConstants.set(dest, firstVal)
      return
    }
    this.tempConstants.delete(dest)
    super.emitPhi(dest, pairs)
  }

  private irValuesEqual(a: IRValue, b: IRValue): boolean {
    if (a.kind !== b.kind) return false
    switch (a.kind) {
      case "int":    return a.value === (b as typeof a).value
      case "float":  return a.value === (b as typeof a).value
      case "string": return a.value === (b as typeof a).value
      case "bool":   return a.value === (b as typeof a).value
      case "null":   return true
    }
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

  private saveFuncState() {
    return {
      instructions: [...this.instructions],
      tempCount: this.tempCount,
      labelCount: this.labelCount,
      ssaVersions: new Map(this.ssaVersions),
      ssaMax: new Map(this.ssaMax),
      knownConstants: new Map(this.knownConstants),
      tempConstants: new Map(this.tempConstants),
      loopStack: [...this.loopStack],
    }
  }

  private restoreFuncState(state: ReturnType<typeof this.saveFuncState>): void {
    this.instructions = state.instructions
    this.tempCount = state.tempCount
    this.labelCount = state.labelCount
    this.ssaVersions = state.ssaVersions
    this.ssaMax = state.ssaMax
    this.knownConstants = state.knownConstants
    this.tempConstants = state.tempConstants
    this.loopStack = state.loopStack
  }

  // ─── Entry point ──────────────────────────────────────────

  build(): MIRProgram {
    const globals: MIRInstruction[] = []
    this.mirFunctions = []
    this.paramNames = this.buildParamNames()
    this.initCaptureAnalysis()

    for (const stmt of this.program) {
      if (stmt.kind === "FunctionStmt") {
        const state = this.saveFuncState()
        const fn = this.emitFunction(stmt)
        this.mirFunctions.push(fn)
        this.restoreFuncState(state)
      } else {
        this.emitStmt(stmt)
        globals.push(...this.instructions)
        this.instructions = []
      }
    }

    const globalsPreserved = new Set<string>()
    for (const [, vars] of this.capturedVars) {
      for (const v of vars) {
        const c = this.cellForVar.get(v)
        if (c) globalsPreserved.add(c)
      }
    }
    this.eliminateDeadCode(globals, globalsPreserved)

    for (const fn of this.mirFunctions) {
      const fnPreserved = new Set<string>()
      const cap = this.capturedVars.get(fn.name)
      if (cap) {
        for (const v of cap) {
          const c = this.cellForVar.get(v)
          if (c) fnPreserved.add(c)
        }
      }
      this.eliminateDeadCode(fn.instructions, fnPreserved)
    }

    return {
      functions: this.mirFunctions,
      globals,
      structs: [],
    }
  }

  private buildParamNames(): Map<string, string[]> {
    const map = new Map<string, string[]>()
    for (const stmt of this.program) {
      if (stmt.kind === "FunctionStmt") {
        const name = (stmt as FunctionStmt).name.value as string
        const params = (stmt as FunctionStmt).params.map(p => p.name.value as string)
        map.set(name, params)
      }
    }
    return map
  }

  private initCaptureAnalysis(): void {
    this.capturedVars.clear()
    this.cellForVar.clear()
    const globalVars = new Set<string>()
    this.collectCaptures(this.program, globalVars)
    for (const [, vars] of this.capturedVars) {
      for (const v of vars) {
        if (!this.cellForVar.has(v)) {
          this.cellForVar.set(v, `${v}_cell`)
        }
      }
    }
  }

  private collectCaptures(stmts: Stmt[], scope: Set<string>): void {
    for (const stmt of stmts) {
      if (stmt.kind === "VariableStmt") {
        scope.add(stmt.name.value as string)
      } else if (stmt.kind === "FunctionStmt") {
        const fnName = stmt.name.value as string
        const refs = new Set<string>()
        this.gatherRefsInStmt(stmt.body, refs)
        const localVars = new Set<string>()
        for (const p of stmt.params) localVars.add(p.name.value as string)
        this.gatherVarDecls(stmt.body, localVars)
        const captured = new Set([...refs].filter(r => scope.has(r) && !localVars.has(r)))
        if (captured.size > 0) {
          this.capturedVars.set(fnName, captured)
        }
        const innerScope = new Set(scope)
        for (const p of stmt.params) innerScope.add(p.name.value as string)
        this.gatherVarDecls(stmt.body, innerScope)
        this.collectCaptures(stmt.body.statements, innerScope)
      } else if (stmt.kind === "BlockStmt") {
        const blockScope = new Set(scope)
        this.collectCaptures(stmt.statements, blockScope)
      } else if (stmt.kind === "IfStmt") {
        this.collectCaptures(
          stmt.thenBranch.kind === "BlockStmt" ? stmt.thenBranch.statements : [stmt.thenBranch],
          scope,
        )
        if (stmt.elseBranch) {
          this.collectCaptures(
            stmt.elseBranch.kind === "BlockStmt" ? stmt.elseBranch.statements : [stmt.elseBranch],
            scope,
          )
        }
      } else if (stmt.kind === "WhileStmt") {
        this.collectCaptures(
          stmt.body.kind === "BlockStmt" ? stmt.body.statements : [stmt.body],
          scope,
        )
      } else if (stmt.kind === "ForStmt") {
        this.collectCaptures(
          stmt.body.kind === "BlockStmt" ? stmt.body.statements : [stmt.body],
          scope,
        )
      }
    }
  }

  private gatherRefsInStmt(stmt: Stmt, refs: Set<string>): void {
    if (stmt.kind === "BlockStmt") {
      for (const s of stmt.statements) this.gatherRefsInStmt(s, refs)
    } else if (stmt.kind === "ExpressionStmt") {
      this.gatherRefsInExpr(stmt.expression, refs)
    } else if (stmt.kind === "VariableStmt") {
      if (stmt.initializer) this.gatherRefsInExpr(stmt.initializer, refs)
    } else if (stmt.kind === "ReturnStmt") {
      if (stmt.value) this.gatherRefsInExpr(stmt.value, refs)
    } else if (stmt.kind === "IfStmt") {
      this.gatherRefsInExpr(stmt.condition, refs)
      this.gatherRefsInStmt(stmt.thenBranch, refs)
      if (stmt.elseBranch) this.gatherRefsInStmt(stmt.elseBranch, refs)
    } else if (stmt.kind === "WhileStmt") {
      this.gatherRefsInExpr(stmt.condition, refs)
      this.gatherRefsInStmt(stmt.body, refs)
    } else if (stmt.kind === "ForStmt") {
      if (stmt.condition) this.gatherRefsInExpr(stmt.condition, refs)
      this.gatherRefsInStmt(stmt.body, refs)
    } else if (stmt.kind === "FunctionStmt") {
      this.gatherRefsInStmt(stmt.body, refs)
    }
  }

  private gatherRefsInExpr(expr: Expr, refs: Set<string>): void {
    if (expr.kind === "Identifier") {
      refs.add((expr as IdentifierExpr).name.value as string)
    } else if (expr.kind === "Group") {
      this.gatherRefsInExpr((expr as any).expression, refs)
    } else if (expr.kind === "Unary") {
      this.gatherRefsInExpr((expr as any).right, refs)
    } else if (expr.kind === "Binary") {
      this.gatherRefsInExpr((expr as any).left, refs)
      this.gatherRefsInExpr((expr as any).right, refs)
    } else if (expr.kind === "Assign") {
      this.gatherRefsInExpr((expr as any).name, refs)
      this.gatherRefsInExpr((expr as any).value, refs)
    } else if (expr.kind === "Conditional") {
      this.gatherRefsInExpr((expr as any).condition, refs)
      this.gatherRefsInExpr((expr as any).consequent, refs)
      this.gatherRefsInExpr((expr as any).alternate, refs)
    } else if (expr.kind === "NullishCoalescing") {
      this.gatherRefsInExpr((expr as any).left, refs)
      this.gatherRefsInExpr((expr as any).right, refs)
    } else if (expr.kind === "Call") {
      this.gatherRefsInExpr((expr as any).callee, refs)
      for (const a of (expr as any).args) this.gatherRefsInExpr(a, refs)
    } else if (expr.kind === "NamedArgument") {
      this.gatherRefsInExpr((expr as any).value, refs)
    }
  }

  private gatherVarDecls(stmt: Stmt, acc: Set<string>): void {
    if (stmt.kind === "BlockStmt") {
      for (const s of stmt.statements) this.gatherVarDecls(s, acc)
    } else if (stmt.kind === "VariableStmt") {
      acc.add((stmt as VariableStmt).name.value as string)
    } else if (stmt.kind === "IfStmt") {
      this.gatherVarDecls(stmt.thenBranch, acc)
      if (stmt.elseBranch) this.gatherVarDecls(stmt.elseBranch, acc)
    } else if (stmt.kind === "WhileStmt") {
      this.gatherVarDecls(stmt.body, acc)
    } else if (stmt.kind === "ForStmt") {
      if ((stmt as any).initializer) this.gatherVarDecls((stmt as any).initializer, acc)
      this.gatherVarDecls(stmt.body, acc)
    } else if (stmt.kind === "FunctionStmt") {
      for (const p of stmt.params) acc.add(p.name.value as string)
      this.gatherVarDecls(stmt.body, acc)
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
      case "ForStmt":
        return this.emitForStmt(stmt)
      case "BreakStmt":
        return this.emitBreakStmt(stmt)
      case "ContinueStmt":
        return this.emitContinueStmt(stmt)
      case "FunctionStmt": {
        const state = this.saveFuncState()
        const fn = this.emitFunction(stmt)
        this.mirFunctions.push(fn)
        this.restoreFuncState(state)
        return
      }
      default:
        break
    }
  }

  // ─── VariableStmt (val / var) ─────────────────────────────

  private emitVariableStmt(stmt: VariableStmt): void {
    const name = stmt.name.value as string
    if (stmt.initializer) {
      const val = this.emitExpr(stmt.initializer)
      if (this.cellForVar.has(name)) {
        const cell = this.cellForVar.get(name)!
        this.emitCellAlloc(cell)
        this.emitCellStore(cell, val)
      } else if (stmt.declarationType === "var") {
        const ssa = this.defineSSA(name)
        this.emitCopy(ssa, val)
      } else {
        this.emitCopy(name, val)
        const folded = this.resolveConstant(stmt.initializer)
        if (folded) {
          this.knownConstants.set(name, folded)
        }
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
    const op = node.operator?.value as string | undefined

    this.knownConstants.delete(name)

    let val: string

    if (op && op !== "=") {
      const left = this.currentCapturedVars.has(name)
        ? this.emitIdentifierExpr(node.name as IdentifierExpr)
        : this.resolveSSA(name)
      const right = this.emitExpr(node.value)
      const binOp = this.toBinaryOp(op[0])
      if (binOp) {
        val = this.freshTemp()
        this.emitBinary(val, left, binOp, right)
      } else {
        val = right
      }
    } else {
      if (node.value.kind === "Literal") {
        const irVal = this.toIRValue(node.value as LiteralExpr)
        if (this.currentCapturedVars.has(name)) {
          const cell = this.cellForVar.get(name)!
          const tmp = this.freshTemp()
          this.emitConst(tmp, irVal)
          this.emitCellStore(cell, tmp)
          return tmp
        }
        const ssa = this.defineSSA(name)
        this.emitConst(ssa, irVal)
        return ssa
      }
      val = this.emitExpr(node.value)
    }

    if (this.currentCapturedVars.has(name)) {
      const cell = this.cellForVar.get(name)!
      this.emitCellStore(cell, val)
      return val
    }

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
      if (stmt.value.kind === "Literal") {
        this.emitReturn(this.toIRValue(stmt.value as LiteralExpr))
        return
      }
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
    const condVal = this.resolveConstant(stmt.condition)
    if (condVal?.kind === "bool") {
      if (condVal.value) {
        this.emitStmt(stmt.thenBranch)
      } else if (stmt.elseBranch) {
        this.emitStmt(stmt.elseBranch)
      }
      return
    }

    const preIf = this.saveSSA()
    const thenBlock = this.freshLabel("then")
    const endBlock = this.freshLabel("end")

    if (stmt.elseBranch) {
      const elseBlock = this.freshLabel("else")

      const cond = this.emitExpr(stmt.condition)
      this.emitJumpIf(cond, thenBlock, elseBlock)

      this.emitBlock(thenBlock)
      this.emitStmt(stmt.thenBranch)
      const afterThen = this.saveSSA()
      const lastThen = this.instructions[this.instructions.length - 1]
      if (lastThen?.op !== "return" && lastThen?.op !== "jump") {
        this.emitJump(endBlock)
      }

      this.restoreSSA(preIf)
      this.emitBlock(elseBlock)
      this.emitStmt(stmt.elseBranch)
      const afterElse = this.saveSSA()
      const lastElse = this.instructions[this.instructions.length - 1]
      if (lastElse?.op !== "return" && lastElse?.op !== "jump") {
        this.emitJump(endBlock)
      }

      this.restoreSSA(preIf)
      this.emitBlock(endBlock)
      this.emitBlockPhi(preIf, afterThen, afterElse, thenBlock, elseBlock)
    } else {
      const entryBlock = this.freshLabel("entry")
      this.emitBlock(entryBlock)

      const cond = this.emitExpr(stmt.condition)
      this.emitJumpIf(cond, thenBlock, endBlock)

      this.emitBlock(thenBlock)
      this.emitStmt(stmt.thenBranch)
      const afterThen = this.saveSSA()
      const lastThen = this.instructions[this.instructions.length - 1]
      if (lastThen?.op !== "return" && lastThen?.op !== "jump") {
        this.emitJump(endBlock)
      }

      this.restoreSSA(preIf)
      const afterElse = this.saveSSA()
      this.emitBlock(endBlock)
      this.emitBlockPhi(preIf, afterThen, afterElse, thenBlock, entryBlock)
    }
  }

  // ─── WhileStmt (com loop header phi + break/continue) ────

  private emitWhileStmt(stmt: WhileStmt): void {
    const condVal = this.resolveConstant(stmt.condition)
    if (condVal?.kind === "bool" && !condVal.value) {
      return
    }

    const modifiedVars = new Set<string>()
    this.findModifiedVars(stmt.body, modifiedVars)

    const loopCarried = this.prepareLoopCarried(modifiedVars)

    const loopBlock = this.freshLabel("loop")
    const bodyBlock = this.freshLabel("body")
    const exitBlock = this.freshLabel("exit")

    this.loopStack.push({ breakTarget: exitBlock, continueTarget: loopBlock })

    this.emitBlock(loopBlock)
    const phiInsertIdx = this.instructions.length

    const cond = this.emitExpr(stmt.condition)
    this.emitJumpIf(cond, bodyBlock, exitBlock)

    this.emitBlock(bodyBlock)
    this.emitStmt(stmt.body)
    this.emitJump(loopBlock)

    this.finishLoopPhi(loopCarried, phiInsertIdx, loopBlock, bodyBlock, exitBlock)

    this.loopStack.pop()
    this.emitBlock(exitBlock)
  }

  // ─── ForStmt (direct emit, com loop header phi + break/continue) ─

  private emitForStmt(stmt: ForStmt): void {
    if (stmt.initializer) this.emitStmt(stmt.initializer)

    const modifiedVars = new Set<string>()
    this.findModifiedVars(stmt.body, modifiedVars)
    this.findModifiedVarsFromExpr(stmt.update, modifiedVars)

    const loopCarried = this.prepareLoopCarried(modifiedVars)

    const startBlock = this.freshLabel("for_start")
    const bodyBlock = this.freshLabel("for_body")
    const updateBlock = this.freshLabel("for_update")
    const exitBlock = this.freshLabel("for_end")

    this.loopStack.push({ breakTarget: exitBlock, continueTarget: updateBlock })

    this.emitBlock(startBlock)
    const phiInsertIdx = this.instructions.length

    const cond = this.emitExpr(stmt.condition)
    this.emitJumpIf(cond, bodyBlock, exitBlock)

    this.emitBlock(bodyBlock)
    this.emitStmt(stmt.body)
    this.emitJump(updateBlock)

    this.emitBlock(updateBlock)
    this.emitExpr(stmt.update)
    this.emitJump(startBlock)

    this.finishLoopPhi(loopCarried, phiInsertIdx, startBlock, updateBlock, exitBlock)

    this.loopStack.pop()
    this.emitBlock(exitBlock)
  }

  // ─── Break / Continue ────────────────────────────────────

  private emitBreakStmt(_stmt: BreakStmt): void {
    const ctx = this.loopStack[this.loopStack.length - 1]
    if (ctx) this.emitJump(ctx.breakTarget)
  }

  private emitContinueStmt(_stmt: ContinueStmt): void {
    const ctx = this.loopStack[this.loopStack.length - 1]
    if (ctx) this.emitJump(ctx.continueTarget)
  }

  // ─── Helpers: loop phi ───────────────────────────────────

  private prepareLoopCarried(modifiedVars: Set<string>): { name: string; prePhiVer: number; phiVer: number }[] {
    const result: { name: string; prePhiVer: number; phiVer: number }[] = []
    for (const name of modifiedVars) {
      const curVer = this.ssaVersions.get(name)
      if (curVer !== undefined) {
        const maxVer = this.ssaMax.get(name) ?? -1
        const phiVer = Math.max(curVer, maxVer) + 1
        this.ssaVersions.set(name, phiVer)
        this.ssaMax.set(name, phiVer)
        result.push({ name, prePhiVer: curVer, phiVer })
      }
    }
    return result
  }

  private finishLoopPhi(
    loopCarried: { name: string; prePhiVer: number; phiVer: number }[],
    phiInsertIdx: number,
    headerBlock: string,
    backEdgeBlock: string,
    exitBlock: string,
  ): void {
    const afterBody = this.saveSSA()
    let phiOffset = 0
    for (const { name, prePhiVer, phiVer } of loopCarried) {
      const preVal = this.ssaName(name, prePhiVer)
      const bodyVer = afterBody.get(name)
      const bodyVal = bodyVer !== undefined ? this.ssaName(name, bodyVer) : preVal
      this.insertAt(phiInsertIdx + phiOffset, {
        op: "phi",
        dest: this.ssaName(name, phiVer),
        pairs: [{ block: headerBlock, value: preVal }, { block: backEdgeBlock, value: bodyVal }],
      })
      phiOffset++
    }
    for (const { name, phiVer } of loopCarried) {
      this.ssaVersions.set(name, phiVer)
    }
  }

  // ─── findModifiedVars — pre-scan para loop-carried vars ──

  private findModifiedVars(stmt: Stmt, acc: Set<string>): void {
    switch (stmt.kind) {
      case "Assign": {
        if (stmt.name.kind === "Identifier") {
          acc.add((stmt.name as IdentifierExpr).name.value as string)
        }
        break
      }
      case "ExpressionStmt": {
        if (stmt.expression.kind === "Assign") {
          const a = stmt.expression as AssignExpr
          if (a.name.kind === "Identifier") {
            acc.add((a.name as IdentifierExpr).name.value as string)
          }
        }
        break
      }
      case "BlockStmt":
        for (const s of stmt.statements) this.findModifiedVars(s, acc)
        break
      case "IfStmt":
        this.findModifiedVars(stmt.thenBranch, acc)
        if (stmt.elseBranch) this.findModifiedVars(stmt.elseBranch, acc)
        break
      case "WhileStmt":
      case "ForStmt":
        break
    }
  }

  private findModifiedVarsFromExpr(expr: Expr, acc: Set<string>): void {
    if (expr.kind === "Assign" && expr.name.kind === "Identifier") {
      acc.add((expr.name as IdentifierExpr).name.value as string)
    }
  }

  // ─── FunctionStmt ─────────────────────────────────────────

  private emitFunction(stmt: FunctionStmt): MIRFunction {
    this.instructions = []
    this.tempCount = 0
    this.labelCount = 0
    this.ssaVersions = new Map()
    this.ssaMax = new Map()
    this.knownConstants = new Map()
    this.tempConstants = new Map()

    const name = stmt.name.value as string
    const params = stmt.params.map(p => ({
      name: p.name.value as string,
      type: p.type ? this.typeToString(p.type) : "unknown",
    }))
    const returnType = stmt.returnType
      ? this.typeToString(stmt.returnType)
      : "void"

    for (const p of params) {
      this.ssaVersions.set(p.name, 0)
      this.ssaMax.set(p.name, 0)
    }

    this.currentCapturedVars = this.capturedVars.get(name) ?? new Set()
    for (const cv of this.currentCapturedVars) {
      const cell = this.cellForVar.get(cv)!
      params.push({ name: cell, type: "cell" })
    }

    this.emitStmt(stmt.body)

    this.currentCapturedVars = new Set()

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

  // ─── Constant folding helpers ─────────────────────────────

  private resolveConstant(expr: Expr): IRValue | null {
    switch (expr.kind) {
      case "Literal":
        return this.toIRValue(expr)
      case "Identifier": {
        const name = expr.name.value as string
        const known = this.knownConstants.get(name)
        if (known) return known
        const ssaName = this.resolveSSA(name)
        return this.tempConstants.get(ssaName) ?? null
      }
      case "Group":
        return this.resolveConstant(expr.expression)
      case "Unary": {
        const operand = this.resolveConstant(expr.right)
        if (!operand) return null
        const op = expr.operator.value as string
        if (op === "-")  return this.foldUnary("neg", operand)
        if (op === "!")  return this.foldUnary("not", operand)
        if (op === "+")  return operand
        return null
      }
      case "Binary": {
        const left = this.resolveConstant(expr.left)
        const right = this.resolveConstant(expr.right)
        if (!left || !right) return null
        const op = this.toBinaryOp(expr.operator.value as string)
        if (!op) return null
        return this.foldBinary(left, op, right)
      }
      default:
        return null
    }
  }



  private foldBinary(left: IRValue, op: BinaryOp, right: IRValue): IRValue | null {
    switch (op) {
      case "add": {
        if (left.kind === "int" && right.kind === "int")
          return { kind: "int", value: left.value + right.value }
        if (left.kind === "float" && right.kind === "float")
          return { kind: "float", value: left.value + right.value }
        if (left.kind === "string" && right.kind === "string")
          return { kind: "string", value: left.value + right.value }
        return null
      }
      case "sub": {
        if (left.kind === "int" && right.kind === "int")
          return { kind: "int", value: left.value - right.value }
        if (left.kind === "float" && right.kind === "float")
          return { kind: "float", value: left.value - right.value }
        return null
      }
      case "mul": {
        if (left.kind === "int" && right.kind === "int")
          return { kind: "int", value: left.value * right.value }
        if (left.kind === "float" && right.kind === "float")
          return { kind: "float", value: left.value * right.value }
        return null
      }
      case "div": {
        if (left.kind === "int" && right.kind === "int" && right.value !== 0)
          return { kind: "int", value: Math.floor(left.value / right.value) }
        if (left.kind === "float" && right.kind === "float" && right.value !== 0)
          return { kind: "float", value: left.value / right.value }
        return null
      }
      case "mod": {
        if (left.kind === "int" && right.kind === "int" && right.value !== 0)
          return { kind: "int", value: left.value % right.value }
        return null
      }
      case "eq": {
        if (left.kind === "int" && right.kind === "int")
          return { kind: "bool", value: left.value === right.value }
        if (left.kind === "float" && right.kind === "float")
          return { kind: "bool", value: left.value === right.value }
        if (left.kind === "string" && right.kind === "string")
          return { kind: "bool", value: left.value === right.value }
        if (left.kind === "bool" && right.kind === "bool")
          return { kind: "bool", value: left.value === right.value }
        if (left.kind === "null" && right.kind === "null")
          return { kind: "bool", value: true }
        return null
      }
      case "ne": {
        const eq = this.foldBinary(left, "eq", right)
        if (eq && eq.kind === "bool") return { kind: "bool", value: !eq.value }
        return null
      }
      case "lt": {
        if (left.kind === "int" && right.kind === "int")
          return { kind: "bool", value: left.value < right.value }
        if (left.kind === "float" && right.kind === "float")
          return { kind: "bool", value: left.value < right.value }
        return null
      }
      case "gt": {
        if (left.kind === "int" && right.kind === "int")
          return { kind: "bool", value: left.value > right.value }
        if (left.kind === "float" && right.kind === "float")
          return { kind: "bool", value: left.value > right.value }
        return null
      }
      case "le": {
        if (left.kind === "int" && right.kind === "int")
          return { kind: "bool", value: left.value <= right.value }
        if (left.kind === "float" && right.kind === "float")
          return { kind: "bool", value: left.value <= right.value }
        return null
      }
      case "ge": {
        if (left.kind === "int" && right.kind === "int")
          return { kind: "bool", value: left.value >= right.value }
        if (left.kind === "float" && right.kind === "float")
          return { kind: "bool", value: left.value >= right.value }
        return null
      }
      case "and": {
        if (left.kind === "bool" && right.kind === "bool")
          return { kind: "bool", value: left.value && right.value }
        return null
      }
      case "or": {
        if (left.kind === "bool" && right.kind === "bool")
          return { kind: "bool", value: left.value || right.value }
        return null
      }
    }
  }

  private foldUnary(op: UnaryOp, operand: IRValue): IRValue | null {
    switch (op) {
      case "neg": {
        if (operand.kind === "int")   return { kind: "int", value: -operand.value }
        if (operand.kind === "float") return { kind: "float", value: -operand.value }
        return null
      }
      case "not": {
        if (operand.kind === "bool")  return { kind: "bool", value: !operand.value }
        return null
      }
    }
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
      case "Call":       return this.emitCallExpr(node)
      case "NamedArgument":
        return this.emitExpr((node as NamedArgumentExpr).value)
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
    if (this.currentCapturedVars.has(name)) {
      const cell = this.cellForVar.get(name)!
      const dest = this.freshTemp()
      this.emitCellLoad(dest, cell)
      return dest
    }
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

    const operandVal = this.resolveConstant(node.right)
    if (operandVal) {
      const folded = this.foldUnary(unaryOp, operandVal)
      if (folded) {
        const dest = this.freshTemp()
        this.emitConst(dest, folded)
        return dest
      }
    }

    const dest = this.freshTemp()
    const operand = this.emitExpr(node.right)
    this.emitUnary(dest, unaryOp, operand)
    return dest
  }

  // ─── Binária ──────────────────────────────────────────────

  private emitBinaryExpr(node: BinaryExpr): string {
    const op = node.operator.value as string
    const binaryOp = this.toBinaryOp(op)
    if (!binaryOp) {
      const left = this.emitExpr(node.left)
      const right = this.emitExpr(node.right)
      return left || right
    }

    const leftVal = this.resolveConstant(node.left)
    const rightVal = this.resolveConstant(node.right)
    if (leftVal && rightVal) {
      const folded = this.foldBinary(leftVal, binaryOp, rightVal)
      if (folded) {
        const dest = this.freshTemp()
        this.emitConst(dest, folded)
        return dest
      }
    }

    const left = this.emitExpr(node.left)
    const right = this.emitExpr(node.right)
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

  // ─── CallExpression ────────────────────────────────────────

  private emitCallExpr(node: CallExpr): string {
    const callee = node.callee.kind === "Identifier"
      ? (node.callee as IdentifierExpr).name.value as string
      : this.emitUnknown(node)

    const baseArgs: string[] = []
    const namedArgs: { name: string; value: string }[] = []
    const hasNamed = node.args.some(a => a.kind === "NamedArgument")

    if (hasNamed) {
      const paramList = this.paramNames.get(callee) ?? []
      const N = node.args.length
      const argToParam: string[] = new Array(N)
      const filled = new Set<number>()
      for (let i = 0; i < N; i++) {
        const arg = node.args[i]
        if (arg.kind === "NamedArgument") {
          const key = (arg as NamedArgumentExpr).key
          argToParam[i] = key
          const idx = paramList.indexOf(key)
          if (idx >= 0) filled.add(idx)
        }
      }
      let posIdx = 0
      for (let i = 0; i < N; i++) {
        if (node.args[i].kind !== "NamedArgument") {
          while (posIdx < paramList.length && filled.has(posIdx)) posIdx++
          argToParam[i] = posIdx < paramList.length ? paramList[posIdx] : `_p${posIdx}`
          if (posIdx < paramList.length) filled.add(posIdx)
          posIdx++
        }
      }
      for (let i = 0; i < N; i++) {
        const arg = node.args[i]
        const value = arg.kind === "NamedArgument"
          ? this.emitExpr((arg as NamedArgumentExpr).value)
          : this.emitExpr(arg)
        namedArgs.push({ name: argToParam[i], value })
      }
    } else {
      for (const arg of node.args) {
        baseArgs.push(this.emitExpr(arg))
      }
    }

    const captured = this.capturedVars.get(callee)
    if (captured) {
      for (const cv of captured) {
        const cell = this.cellForVar.get(cv)!
        if (hasNamed) {
          namedArgs.push({ name: cell, value: cell })
        } else {
          baseArgs.push(cell)
        }
      }
    }

    const dest = this.freshTemp()
    if (hasNamed) {
      this.emitCallNamed(dest, callee, namedArgs)
    } else {
      this.emitCall(dest, callee, baseArgs)
    }
    return dest
  }

  // ─── Ternário (com phi + block) ───────────────────────────

  private emitConditional(node: ConditionalExpr): string {
    const condVal = this.resolveConstant(node.condition)
    if (condVal?.kind === "bool") {
      const branch = condVal.value ? node.consequent : node.alternate
      return this.emitExpr(branch)
    }

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
    const leftVal = this.resolveConstant(node.left)
    if (leftVal && leftVal.kind !== "null") {
      return this.emitExpr(node.left)
    }
    if (leftVal?.kind === "null") {
      return this.emitExpr(node.right)
    }

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

  // ─── Dead code elimination ─────────────────────────────

  private eliminateDeadCode(insts: MIRInstruction[], preserved?: Set<string>): void {
    let changed = true
    while (changed) {
      changed = false
      const referenced = new Set<string>()
      for (const inst of insts) {
        switch (inst.op) {
          case "copy":   referenced.add(inst.src); break
          case "binary":  referenced.add(inst.left); referenced.add(inst.right); break
          case "unary":   referenced.add(inst.operand); break
          case "phi":     for (const p of inst.pairs) referenced.add(p.value); break
          case "notNull": referenced.add(inst.src); break
          case "jumpIf":  referenced.add(inst.cond); break
          case "return":  if (typeof inst.value === "string") referenced.add(inst.value); break
          case "call":    for (const a of inst.args) referenced.add(a); break
          case "callNamed": for (const a of inst.args) referenced.add(a.value); break
          case "getField": referenced.add(inst.object); break
          case "setField": referenced.add(inst.object); referenced.add(inst.value); break
          case "array":   for (const e of inst.elements) referenced.add(e); break
          case "getIndex": referenced.add(inst.object); referenced.add(inst.index); break
          case "setIndex": referenced.add(inst.object); referenced.add(inst.index); referenced.add(inst.value); break
          case "spread":  referenced.add(inst.src); break
          case "cellLoad": referenced.add(inst.src); break
          case "cellStore": referenced.add(inst.cell); referenced.add(inst.value); break
        }
      }

      for (let i = insts.length - 1; i >= 0; i--) {
        const inst = insts[i]
        if (inst.op === "call" || inst.op === "callNamed") continue
        const dest = (inst as any).dest
        if (dest !== undefined && !referenced.has(dest)) {
          if (preserved?.has(dest)) continue
          insts.splice(i, 1)
          changed = true
        }
      }
    }
  }
}
