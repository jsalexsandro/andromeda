import { Lexer } from './src/lexer/lexer'
import { Parser, Precedence } from './src/parser/parser'

const input = '[1, 2]'
console.log('Testing:', input)
const lexer = new Lexer(input)
const tokens = lexer.tokenize()
const parser = new Parser(tokens, input)
try {
  const result = parser.parse()
  console.log('OK:', JSON.stringify(result, null, 2).slice(0, 300))
} catch (e: any) {
  console.log('FAIL:', e.message)
}
//'