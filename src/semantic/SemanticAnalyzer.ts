import { SymbolKind, SymbolDefinition, AndroType } from "./types"
import { TypeChecker } from "./TypeChecker"
import { ScopeStack } from "./ScopeStack"
import { SymbolTable } from "./SymbolTable"
import { SemanticErrorHandler } from "./SemanticError"

export class SemanticAnalyzer {
  scopeStack: ScopeStack
  symbolTable: SymbolTable
  errors: SemanticErrorHandler

  constructor() {
    this.scopeStack = new ScopeStack()
    this.symbolTable = new SymbolTable()
    this.errors = new SemanticErrorHandler()
  }

  enterGlobalScope(): void {
    this.scopeStack.enter("global")
  }

  exitGlobalScope(): void {
    this.scopeStack.exit()
  }

  enterScope(kind: "function" | "block" | "class"): void {
    this.scopeStack.enter(kind)
  }

  exitScope(): void {
    this.scopeStack.exit()
  }

  lookup(name: string): SymbolDefinition | null {
    return this.scopeStack.lookup(name)
  }

  defineSymbol(
    name: string,
    type: AndroType,
    kind: SymbolKind,
    mutable: boolean,
    ast: SymbolDefinition["ast"],
    line: number = 0,
    column: number = 0
  ): SymbolDefinition {
    const symbol: SymbolDefinition = {
      name,
      type,
      kind,
      mutable,
      ast,
      line,
      column,
    }

    try {
      this.scopeStack.current.define(symbol)
      this.symbolTable.register(symbol)
    } catch (e) {
      if (e instanceof Error) {
        this.errors.report(e.message, line, column)
      }
    }

    return symbol
  }

  findEnclosingScope(kind: "function" | "block" | "class"): import("./Scope").Scope | null {
    let scope = this.scopeStack.current
    while (scope) {
      if (scope.kind === kind) return scope
      scope = scope.parent
    }
    return null
  }

  hasErrors(): boolean {
    return this.errors.hasErrors()
  }

  printErrors(source: string): void {
    this.errors.printErrors(source)
  }

  getErrors(): import("./SemanticError").SemanticError[] {
    return this.errors.getErrors()
  }

  isUnknown = TypeChecker.isUnknown
  isAssignableTo = TypeChecker.isAssignableTo
  isSameType = TypeChecker.isSameType
  typeToString = TypeChecker.toString
}
