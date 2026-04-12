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
  private sourceCode: string

  constructor(sourceCode: string = "") {
    this.sourceCode = sourceCode
  }

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
      const line = error.line > 0 ? error.line : 1
      const column = error.column > 0 ? error.column : 1

      // Adjust column for pointer (point TO the token where error is)
      const errorColumn = column
      const lineStr = String(line)

      const lines = this.sourceCode.split('\n')
      const targetLine = lines[line - 1] || ''

      const linePrefix = `${lineStr} | `
      const spacePrefix = ' '.repeat(lineStr.length) + ' | '
      const padding = ' '.repeat(Math.max(0, errorColumn - 1))
      const pointer = spacePrefix + padding + '^'

      output += `[Semantic Error]: ${error.message}\n`
      output += `At line ${line}, column ${column}:\n\n`
      output += `${linePrefix}${targetLine}\n`
      output += `${pointer}\n\n`
    }
    return output
  }
}