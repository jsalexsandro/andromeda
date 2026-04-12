import { Token, TokenType } from '../lexer/types'

export class ParserError extends Error {
  constructor(
    public message: string,
    public token: Token,
    public sourceCode: string
  ) {
    super(message)
    this.name = 'ParserError'
  }

  public renderStr(): string {
    const lines = this.sourceCode.split('\n')
    
    // Use the token's line, default to 1 if invalid
    const line = this.token.line > 0 ? this.token.line : 1
    const targetLine = lines[line - 1] || ''
    const lineStr = String(line)
    
    const linePrefix = `${lineStr} | `
    const spacePrefix = ' '.repeat(lineStr.length) + ' | '
    
    let tokenLength = 1
    if (this.token.type === TokenType.EOF) {
      tokenLength = 3 // "EOF"
    } else if (this.token.value !== null && this.token.value !== undefined) {
      tokenLength = String(this.token.value).length
    }

    const column = this.token.column > 0 ? this.token.column : 1
    // Adjust column to point AFTER the token (where the error actually is)
    const errorColumn = column + 1
    const padding = ' '.repeat(Math.max(0, errorColumn - 1))
    const pointer = spacePrefix + padding + '^'.repeat(Math.max(1, tokenLength))

    return `[Parse Error]: ${this.message}\n` +
           `At line ${line}, column ${column}:\n\n` +
           `${linePrefix}${targetLine}\n` +
           `${pointer}\n`
  }
}

export class ErrorHandler {
  public errors: ParserError[] = []
  private sourceCode: string
  private lastErrorToken: { line: number; column: number; message: string } | null = null

  constructor(sourceCode: string) {
    this.sourceCode = sourceCode
  }

  public report(message: string, token: Token): void {
    // Avoid duplicate error messages for same token and message
    if (this.lastErrorToken && 
        this.lastErrorToken.line === token.line && 
        this.lastErrorToken.column === token.column &&
        this.lastErrorToken.message === message) {
      return
    }
    
    const err = new ParserError(message, token, this.sourceCode)
    this.errors.push(err)
    this.lastErrorToken = { line: token.line, column: token.column, message }
  }

  public hasErrors(): boolean {
    return this.errors.length > 0
  }

  public renderAll(): void {
    for (const error of this.errors) {
      console.error(error.renderStr())
    }
  }
}
