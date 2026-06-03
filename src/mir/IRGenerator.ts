import { MIRInstruction, IRValue, BinaryOp, UnaryOp } from "./types"

// ════════════════════════════════════════════════════════════════
// IRGenerator — Gerador de temporários, labels e helpers
//
// Uso:
//   O builder MIR herda ou compõe IRGenerator para obter
//   nomes únicos de temporários e labels.
// ════════════════════════════════════════════════════════════════

export class IRGenerator {
  protected tempCount = 0
  protected labelCount = 0
  protected instructions: MIRInstruction[] = []

  // ─── Helpers de nomeação ──────────────────────────────────

  protected freshTemp(): string {
    return `t${this.tempCount++}`
  }

  protected freshLabel(hint: string): string {
    return `${hint}_${this.labelCount++}`
  }

  // ─── Helpers de criação de instruções ──────────────────────

  protected emit(inst: MIRInstruction): void {
    this.instructions.push(inst)
  }

  protected insertAt(index: number, inst: MIRInstruction): void {
    this.instructions.splice(index, 0, inst)
  }

  protected emitConst(dest: string, value: IRValue): void {
    this.emit({ op: "const", dest, value })
  }

  protected emitCopy(dest: string, src: string): void {
    for (let i = this.instructions.length - 1; i >= 0; i--) {
      const inst = this.instructions[i]
      if (inst.op === "phi" && inst.dest === src) {
        inst.dest = dest
        return
      }
      if (inst.op === "block") break
    }
    const last = this.instructions[this.instructions.length - 1]
    if (last?.op === "const" && last.dest === src) {
      last.dest = dest
      return
    }
    this.emit({ op: "copy", dest, src })
  }

  protected emitBinary(dest: string, left: string, operator: BinaryOp, right: string): void {
    this.emit({ op: "binary", dest, left, operator, right })
  }

  protected emitUnary(dest: string, operator: UnaryOp, operand: string): void {
    this.emit({ op: "unary", dest, operator, operand })
  }

  protected emitBlock(name: string): void {
    this.emit({ op: "block", name })
  }

  protected emitJump(label: string): void {
    this.emit({ op: "jump", label })
  }

  protected emitJumpIf(cond: string, thenLabel: string, elseLabel: string): void {
    this.emit({ op: "jumpIf", cond, then: thenLabel, else: elseLabel })
  }

  protected emitReturn(value: string | IRValue | null): void {
    if (typeof value === "string") {
      const last = this.instructions[this.instructions.length - 1]
      if (last?.op === "const" && last.dest === value && last.value !== undefined) {
        this.instructions.pop()
        value = last.value
      }
    }
    this.emit({ op: "return", value })
  }

  protected emitPhi(dest: string, pairs: { block: string; value: string }[]): void {
    this.emit({ op: "phi", dest, pairs })
  }

  protected emitNotNull(dest: string, src: string): void {
    this.emit({ op: "notNull", dest, src })
  }

  protected emitCall(dest: string, callee: string, args: string[]): void {
    this.emit({ op: "call", dest, callee, args })
  }

  protected emitCallNamed(dest: string, callee: string, args: { name: string; value: string }[]): void {
    this.emit({ op: "callNamed", dest, callee, args })
  }

  protected emitAlloc(dest: string, structName: string): void {
    this.emit({ op: "alloc", dest, structName })
  }

  protected emitGetField(dest: string, object: string, field: string): void {
    this.emit({ op: "getField", dest, object, field })
  }

  protected emitSetField(object: string, field: string, value: string): void {
    this.emit({ op: "setField", object, field, value })
  }

  protected emitArray(dest: string, elements: string[]): void {
    this.emit({ op: "array", dest, elements })
  }

  protected emitGetIndex(dest: string, object: string, index: string): void {
    this.emit({ op: "getIndex", dest, object, index })
  }

  protected emitSetIndex(object: string, index: string, value: string): void {
    this.emit({ op: "setIndex", object, index, value })
  }

  protected emitSpread(dest: string, src: string): void {
    this.emit({ op: "spread", dest, src })
  }

  protected emitCellAlloc(dest: string): void {
    this.emit({ op: "cellAlloc", dest })
  }

  protected emitCellLoad(dest: string, src: string): void {
    this.emit({ op: "cellLoad", dest, src })
  }

  protected emitCellStore(cell: string, value: string): void {
    this.emit({ op: "cellStore", cell, value })
  }
}
