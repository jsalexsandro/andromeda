import { CodeWriter } from "./CodeWriter"

export interface CodegenOptions {
  sourceMap?: boolean
  minify?: boolean
}

export class CodegenContext {
  readonly sourceMap: boolean
  readonly minify: boolean
  private _tempVarCounter: number = 0
  writer: CodeWriter

  constructor(options: CodegenOptions = {}) {
    this.sourceMap = options.sourceMap ?? false
    this.minify = options.minify ?? false
    this.writer = new CodeWriter()
  }

  nextTempVar(): string {
    return `_t${this._tempVarCounter++}`
  }

  reset(): void {
    this._tempVarCounter = 0
    this.writer.clear()
  }
}
