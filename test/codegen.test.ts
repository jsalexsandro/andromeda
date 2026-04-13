import { describe, test, expect } from "bun:test"
import { Lexer } from "../src/lexer/lexer"
import { Parser } from "../src/parser/parser"
import { Codegen } from "../src/codegen/Codegen"
import { CodegenContext } from "../src/codegen/CodegenContext"

function codegen(source: string): string {
  const lexer = new Lexer(source)
  const tokens = lexer.tokenize()
  const parser = new Parser(tokens, source)
  const ast = parser.parse()
  const ctx = new CodegenContext()
  const cg = new Codegen(ctx)
  return cg.generate(ast).trim()
}

describe("Codegen FASE 2 - Literais e Expressões Base", () => {
  test("NumberLiteral", () => {
    expect(codegen("123")).toBe("123")
  })

  test("StringLiteral", () => {
    expect(codegen('"hello"')).toBe('"hello"')
  })

  test("BooleanLiteral true", () => {
    expect(codegen("true")).toBe("true")
  })

  test("BooleanLiteral false", () => {
    expect(codegen("false")).toBe("false")
  })

  test("NullLiteral", () => {
    expect(codegen("null")).toBe("null")
  })

  test("Identifier", () => {
    expect(codegen("x")).toBe("x")
  })

  test("Unary -x", () => {
    expect(codegen("-x")).toBe("-x")
  })

  test("Unary !flag", () => {
    expect(codegen("!flag")).toBe("!flag")
  })

  test("BinaryExpression a + b", () => {
    expect(codegen("a + b")).toBe("a + b")
  })

  test("BinaryExpression x * y", () => {
    expect(codegen("x * y")).toBe("x * y")
  })

  test("Complex expression", () => {
    expect(codegen("a + b * c")).toBe("a + b * c")
  })
})
