export interface SemanticError {
  message: string
  line: number
  column: number
  snippet?: string
}

export class SemanticErrorHandler {
  errors: SemanticError[] = []

  report(message: string, line: number, column: number, snippet?: string): void {
    const alreadyReported = this.errors.some(
      (e) => e.line === line && e.column === column && e.message === message
    )
    if (!alreadyReported) {
      this.errors.push({ message, line, column, snippet })
    }
  }

  hasErrors(): boolean {
    return this.errors.length > 0
  }

  getErrors(): SemanticError[] {
    return [...this.errors]
  }

  clear(): void {
    this.errors = []
  }

  printErrors(source: string): void {
    if (this.errors.length === 0) return

    const lines = source.split("\n")
    console.error(`\nSemantic errors (${this.errors.length}):\n`)

    for (const error of this.errors) {
      console.error(`  line ${error.line}, col ${error.column}: ${error.message}`)
      if (error.line > 0 && error.line <= lines.length) {
        const lineContent = lines[error.line - 1]
        const pointer = " ".repeat(Math.max(0, error.column - 1)) + "^"
        console.error(`    ${lineContent}`)
        console.error(`    ${pointer}`)
      }
    }
    console.error()
  }
}

export class SemanticError extends Error {
  line: number
  column: number

  constructor(message: string, line: number, column: number) {
    super(message)
    this.name = "SemanticError"
    this.line = line
    this.column = column
  }
}
