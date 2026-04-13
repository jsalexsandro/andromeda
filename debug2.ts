import { Lexer } from './src/lexer/lexer'
import { Parser } from './src/parser/parser'

const tests = [
  '[1 + 2]',
  '[1 + 2, 3]',
  '[1, 2 + 3]',
]

for (const input of tests) {
  console.log('Testing:', input)
  const lexer = new Lexer(input)
  const tokens = lexer.tokenize()
  const parser = new Parser(tokens, input)
  try {
    const result = parser.parse()
    if (parser.errors.hasErrors()) {
      console.log('FAIL: Parse errors')
      parser.errors.renderAll()
    } else {
      console.log('OK')
    }
  } catch (e: any) {
    console.log('FAIL:', e.message)
  }
  console.log('')
}