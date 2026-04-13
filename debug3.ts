import { Lexer } from './src/lexer/lexer'
import { Parser, Precedence } from './src/parser/parser'

const tests = [
  { input: '[1 + 2]', p: Precedence.LOWEST },
  { input: '[1 + 2]', p: Precedence.CALL },
  { input: '[1 + 2]', p: Precedence.INDEX },
]

for (const t of tests) {
  console.log('Testing:', t.input, 'with', Precedence[t.p])
  const lexer = new Lexer(t.input)
  const tokens = lexer.tokenize()
  const parser = new Parser(tokens, t.input)
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
  console.log('')
}