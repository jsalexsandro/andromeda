import { SymbolDefinition } from "./types"

export class SymbolTable {
  private table: Map<string, SymbolDefinition[]> = new Map()

  register(symbol: SymbolDefinition): void {
    const existing = this.table.get(symbol.name)
    if (existing) {
      existing.push(symbol)
    } else {
      this.table.set(symbol.name, [symbol])
    }
  }

  find(name: string): SymbolDefinition[] {
    return this.table.get(name) || []
  }

  findFirst(name: string): SymbolDefinition | null {
    const symbols = this.table.get(name)
    return symbols && symbols.length > 0 ? symbols[0] : null
  }

  findAll(): SymbolDefinition[] {
    const all: SymbolDefinition[] = []
    for (const symbols of this.table.values()) {
      all.push(...symbols)
    }
    return all
  }

  findByKind(kind: SymbolDefinition["kind"]): SymbolDefinition[] {
    const all: SymbolDefinition[] = []
    for (const symbols of this.table.values()) {
      for (const sym of symbols) {
        if (sym.kind === kind) {
          all.push(sym)
        }
      }
    }
    return all
  }

  clear(): void {
    this.table.clear()
  }

  get size(): number {
    return this.table.size
  }
}
