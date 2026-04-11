import { Stmt } from "../ast"
import { ScopeManager } from "./scope"
import { TypeChecker } from "./checker"
import { SemanticErrorReporter, SemanticError } from "./error"

export interface SemanticResult {
  errors: SemanticError[]
  hasErrors: boolean
}

export class SemanticAnalyzer {
  private scopeManager: ScopeManager
  private errors: SemanticErrorReporter

  constructor() {
    this.scopeManager = new ScopeManager()
    this.errors = new SemanticErrorReporter()
  }

  analyze(stmts: Stmt[]): SemanticResult {
    this.errors.clear()

    const typeChecker = new TypeChecker(this.scopeManager, this.errors)
    typeChecker.check(stmts)

    return {
      errors: [...this.errors.errors],
      hasErrors: this.errors.hasErrors()
    }
  }
}