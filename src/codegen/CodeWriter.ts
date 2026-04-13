export class CodeWriter {
  private lines: string[] = []
  private currentLine: string = ""
  private indentLevel: number = 0
  private indentStr: string = "  "

  write(str: string): void {
    this.currentLine += str
  }

  writeLine(str: string = ""): void {
    this.lines.push(this.getIndent() + this.currentLine + str)
    this.currentLine = ""
  }

  writeBlankLine(): void {
    this.lines.push("")
  }

  indent(): void {
    this.indentLevel++
  }

  dedent(): void {
    this.indentLevel--
  }

  getOutput(): string {
    if (this.currentLine.length > 0) {
      this.lines.push(this.currentLine)
    }
    return this.lines.join("\n")
  }

  private getIndent(): string {
    return this.indentStr.repeat(this.indentLevel)
  }

  clear(): void {
    this.lines = []
    this.currentLine = ""
    this.indentLevel = 0
  }
}
