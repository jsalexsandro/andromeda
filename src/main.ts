import * as fs from 'fs'
import { Lexer } from './lexer/lexer'
import { Parser } from './parser/parser'

function showHelp() {
  console.log(`Andromeda Language CLI v1.0.0`)
  console.log('Usage: andromeda <command> [options] <file>')
  console.log('')
  console.log('Commands:')
  console.log('  run <file>      Run an andromeda file (currently syntatic validation)')
  console.log('  tokens <file>   Print the token stream of a file')
  console.log('  help            Show this help message')
  console.log('  version         Show the version')
}

export function main() {
  const args = Bun.argv.slice(2)
  
  if (args.length === 0) {
    showHelp()
    process.exit(1)
  }

  const command = args[0]

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp()
    process.exit(0)
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    console.log(`v1.0.0`)
    process.exit(0)
  }

  let filename = args[1]
  let isRun = command === 'run'
  let isTokens = command === 'tokens'

  // Alias bare minimal execution like `andromeda my_file.med` to `tokens` for now
  if (!isRun && !isTokens) {
    if (fs.existsSync(command)) {
      filename = command
      isTokens = true
    } else {
      console.error(`Error: Unknown command '{command}'`)
      showHelp()
      process.exit(1)
    }
  }

  if (!filename) {
    console.error(`Error: Please specify an input file for the command.`)
    process.exit(1)
  }

  if (!fs.existsSync(filename)) {
    console.error(`Error: File not found: ${filename}`)
    process.exit(1)
  }

  const input = fs.readFileSync(filename, 'utf-8')
  const lexer = new Lexer(input)
  const tokens = lexer.tokenize ? lexer.tokenize() : []

  if (isRun) {
    console.log(`[Andromeda] Executing ${filename}...`)
    const parser = new Parser(tokens, input)
    const ast = parser.parse()

    if (parser.errors.hasErrors()) {
      parser.errors.renderAll()
      process.exit(1)
    }

    console.log(`> Syntax pass completed: AST generated with ${ast.length} statements.`)
    console.log(JSON.stringify(ast, null, 2))
    console.log(`> Evaluator is not initialized yet. Skipping execution.`)
  } else {
    console.log(`Tokens (${tokens.length}):\n`)
    for (const token of tokens) {
      if (token && token.type) {
        console.log(`${token.type.toString().padEnd(22)} | ${JSON.stringify(token.value)}`)
      }
    }
  }
}

if (import.meta.main || require.main === module) {
  main()
}