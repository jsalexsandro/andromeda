import { Expr, Stmt } from "../../ast"
import { AndroType } from "../types"

export interface AnalyzerContext {
  inLoop: boolean
  inFunction: boolean
  canReturn: boolean
}

export function createContext(): AnalyzerContext {
  return {
    inLoop: false,
    inFunction: false,
    canReturn: false,
  }
}

export class AnalyzerError {
  constructor(
    public message: string,
    public line: number,
    public column: number,
    public code: string
  ) {}
}
