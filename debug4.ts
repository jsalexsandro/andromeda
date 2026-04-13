import { Lexer } from './src/lexer/lexer'
import { Parser } from './src/parser/parser'

const tests = [
  '[1, 2 + 3]',
]

for (const input of tests) {
  console.log('Testing:', input)
  const lexer = new Lexer(input)
  const tokens = lexer.tokenize()
  console.log('Tokens:', tokens.map(t => t.type + ':' + t.value).join(', '))
  
  const parser = new Parser(tokens, input)
  try {
    const result = parser.parse()
    if (parser.errors.hasErrors()) {
      console.log('FAIL')
      parser.errors.renderAll()
    } else {
      console.log('OK')
    }
  } catch (e: any) {
    console.log('FAIL:', e.message)
  }
}