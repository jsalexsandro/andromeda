import { Scope, ScopeKind } from "./Scope"

export class ScopeStack {
  private _scopes: Scope[]

  constructor() {
    this._scopes = []
  }

  get scopes(): Scope[] {
    return this._scopes
  }

  get current(): Scope {
    if (this._scopes.length === 0) {
      throw new Error("ScopeStack: no current scope (stack is empty)")
    }
    return this._scopes[this._scopes.length - 1]
  }

  get root(): Scope {
    if (this._scopes.length === 0) {
      throw new Error("ScopeStack: no root scope (stack is empty)")
    }
    return this._scopes[0]
  }

  enter(kind: ScopeKind): Scope {
    const scope = new Scope(kind, this._scopes.length > 0 ? this.current : null)
    this._scopes.push(scope)
    return scope
  }

  exit(): Scope {
    if (this._scopes.length === 0) {
      throw new Error("ScopeStack: cannot exit, stack is empty")
    }
    return this._scopes.pop()!
  }

  lookup(name: string): import("./types").SymbolDefinition | null {
    return this.current.lookup(name)
  }

  lookupAll(name: string): import("./types").SymbolDefinition | null {
    if (this._scopes.length === 0) return null
    return this.root.lookup(name)
  }
}
