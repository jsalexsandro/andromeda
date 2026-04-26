import * as fs from 'fs'
import { Lexer } from './lexer/lexer'
import { Parser } from './parser/parser'
import { analyze } from './semantic/TypeChecker'

function showHelp() {
  console.log(`Andromeda Language CLI v1.0.0`)
  console.log('Usage: andromeda <command> [options] <file>')
  console.log('')
  console.log('Commands:')
  console.log('  run <file>          Run an andromeda file (syntax + semantic)')
  console.log('    --gen, -g         Also generate JavaScript output')
  console.log('  compile <file>      Compile (lexer + parser + semantic)')
  console.log('  tokens <file>       Print the token stream of a file')
  console.log('  ast <file>          Print AST of a file')
  console.log('  help                Show this help message')
  console.log('  version             Show the version')
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
  let isCompile = command === 'compile'
  let isTokens = command === 'tokens'
  let isAst = command === 'ast' || command === 'parse'
  let genJs = false

  if (isRun || isCompile) {
    const extraArgs = args.slice(2)
    genJs = extraArgs.includes('--gen') || extraArgs.includes('-g')
    if (extraArgs.length > 0 && !genJs) {
      console.error(`Error: Unknown option '${extraArgs[0]}'`)
      showHelp()
      process.exit(1)
    }
  }

  if (!isRun && !isCompile && !isTokens && !isAst) {
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

  console.time("lexer")
  const lexer = new Lexer(input)
  const tokens = lexer.tokenize ? lexer.tokenize() : []
  console.timeEnd("lexer")

  if (isRun) {
    console.log(`[Andromeda] Executing ${filename}...`)

    console.time("parser")
    const parser = new Parser(tokens, input)
    const ast = parser.parse()
    console.timeEnd("parser")

    if (parser.errors.hasErrors()) {
      parser.errors.renderAll()
      process.exit(1)
    }

  } else if (isCompile) {
    console.log(`[Andromeda] Compiling ${filename}...`)

    console.time("parser")
    const parser = new Parser(tokens, input)
    const ast = parser.parse()
    console.timeEnd("parser")

    if (parser.errors.hasErrors()) {
      parser.errors.renderAll()
      process.exit(1)
    }

    console.time("semantic")
    const { errors, symbolCount } = analyze(ast)
    console.timeEnd("semantic")

    if (errors.length > 0) {
      console.log(`\n[Semantic Errors] (${errors.length}):\n`)
      for (const error of errors) {
        console.log(`  ${error.render()}`)
      }
      process.exit(1)
    }

    console.log(`[Compilation successful!]`)
    console.log(`  Symbols registered: ${symbolCount}`)

  } else if (isAst) {
    console.log(`[Andromeda] Parsing ${filename}...`)

    console.time("parser")
    const parser = new Parser(tokens, input)
    const ast = parser.parse()
    console.timeEnd("parser")

    if (parser.errors.hasErrors()) {
      parser.errors.renderAll()
      process.exit(1)
    }

    console.log(`\nTokens (${tokens.length}):\n`)
    for (const token of tokens) {
      if (token && token.type) {
        console.log(`${token.type.toString().padEnd(22)} | ${JSON.stringify(token.value)}`)
      }
    }

    console.log(`\n---\n`)
    console.log(`AST (${ast.length} statements):\n`)
    console.log(JSON.stringify(ast, null, 2))

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