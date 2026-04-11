import { Token } from "../lexer/types"

export enum SemanticErrorType {
  UNDEFINED_VARIABLE = "UNDEFINED_VARIABLE",
  ALREADY_DECLARED = "ALREADY_DECLARED",
  TYPE_MISMATCH = "TYPE_MISMATCH",
  INVALID_OPERATION = "INVALID_OPERATION",
  VAL_REQUIRES_TYPE = "VAL_REQUIRES_TYPE",
  READ_ONLY = "READ_ONLY",
  CANNOT_ASSIGN = "CANNOT_ASSIGN",
  INVALID_BREAK = "INVALID_BREAK",
}

export interface SemanticError {
  type: SemanticErrorType
  message: string
  line: number
  column: number
  node?: any
}

export class SemanticErrorReporter {
  errors: SemanticError[] = []

  report(error: SemanticError): void {
    this.errors.push(error)
  }

  hasErrors(): boolean {
    return this.errors.length > 0
  }

  clear(): void {
    this.errors = []
  }

  render(): string {
    if (this.errors.length === 0) return ""

    let output = ""
    for (const error of this.errors) {
      output += `[Semantic Error]: ${error.message}\n`
      output += `At line ${error.line}, column ${error.column}\n\n`
    }
    return output
  }
}