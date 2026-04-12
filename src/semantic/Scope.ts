import { SemanticError } from "./SemanticError"

export type ScopeKind = "global" | "function" | "block" | "class"

export class Scope {
  kind: ScopeKind
  parent: Scope | null
  symbols: Map<string, { symbol: import("./types").Symbol; line: number; column: number }>

  constructor(kind: ScopeKind, parent: Scope | null = null) {
    this.kind = kind
    this.parent = parent
    this.symbols = new Map()
  }

  define(symbol: import("./types").SymbolDefinition): void {
    const existing = this.symbols.get(symbol.name)
    if (existing) {
      throw new SemanticError(
        `Symbol '${symbol.name}' is already defined in this scope`,
        symbol.line,
        symbol.column
      )
    }
    this.symbols.set(symbol.name, {
      symbol,
      line: symbol.line,
      column: symbol.column,
    })
  }

  lookup(name: string): import("./types").SymbolDefinition | null {
    const entry = this.symbols.get(name)
    if (entry) return entry.symbol
    if (this.parent) return this.parent.lookup(name)
    return null
  }

  lookupLocal(name: string): import("./types").SymbolDefinition | null {
    const entry = this.symbols.get(name)
    return entry ? entry.symbol : null
  }

  exists(name: string): boolean {
    return this.symbols.has(name) || (this.parent ? this.parent.exists(name) : false)
  }

  getSymbols(): import("./types").SymbolDefinition[] {
    return Array.from(this.symbols.values()).map((e) => e.symbol)
  }
}
