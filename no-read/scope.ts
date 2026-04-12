import { Type } from "./types"

export interface Symbol {
  name: string
  type: Type
  declarationType: "var" | "val" | "const"
  initializerNode?: any
  scope: Scope
}

export class Scope {
  private symbols: Map<string, Symbol> = new Map()
  
  constructor(
    public name: string = "global",
    public parent: Scope | null = null
  ) {}

  define(symbol: Symbol): void {
    if (this.symbols.has(symbol.name)) {
      throw new Error(`Symbol '${symbol.name}' already defined in scope '${this.name}'`)
    }
    this.symbols.set(symbol.name, symbol)
  }

  resolve(name: string): Symbol | null {
    const symbol = this.symbols.get(name)
    if (symbol) return symbol
    if (this.parent) return this.parent.resolve(name)
    return null
  }

  has(name: string): boolean {
    return this.symbols.has(name)
  }

  getAllSymbols(): Symbol[] {
    return Array.from(this.symbols.values())
  }

  getOwnSymbols(): Symbol[] {
    return Array.from(this.symbols.values())
  }
}

export class ScopeManager {
  private scopes: Scope[] = []
  private globalScope: Scope

  constructor() {
    this.globalScope = new Scope("global")
    this.scopes.push(this.globalScope)
  }

  get currentScope(): Scope {
    return this.scopes[this.scopes.length - 1]
  }

  getGlobalScope(): Scope {
    return this.globalScope
  }

  pushScope(name: string): Scope {
    const scope = new Scope(name, this.currentScope)
    this.scopes.push(scope)
    return scope
  }

  popScope(): Scope | null {
    if (this.scopes.length > 1) {
      return this.scopes.pop() || null
    }
    return null
  }

  define(symbol: Symbol): void {
    this.currentScope.define(symbol)
  }

  resolve(name: string): Symbol | null {
    return this.currentScope.resolve(name)
  }

  has(name: string): boolean {
    return this.currentScope.has(name)
  }
}