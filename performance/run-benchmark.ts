import { Lexer } from '../src/lexer/lexer'
import { Parser } from '../src/parser/parser'
import { Analyzer } from '../src/semantic/analyzer/Analyzer'
import * as fs from 'fs'

interface BenchmarkResult {
  timestamp: string
  file: string
  statements: number
  lexerMs: number
  parserMs: number
  semanticMs: number
  totalMs: number
}

const BENCHMARK_FILE = 'performance/benchmark.med'
const RESULTS_FILE = 'performance/results.json'

function runBenchmark(): BenchmarkResult {
  const input = fs.readFileSync(BENCHMARK_FILE, 'utf-8')

  const lexerStart = performance.now()
  const lexer = new Lexer(input)
  const tokens = lexer.tokenize()
  const lexerEnd = performance.now()

  const parserStart = performance.now()
  const parser = new Parser(tokens, input)
  const ast = parser.parse()
  const parserEnd = performance.now()

  const semanticStart = performance.now()
  const analyzer = new Analyzer()
  analyzer.enterGlobalScope()
  analyzer.analyzeProgram(ast)
  analyzer.exitGlobalScope()
  const semanticEnd = performance.now()

  const result: BenchmarkResult = {
    timestamp: new Date().toISOString(),
    file: BENCHMARK_FILE,
    statements: ast.length,
    lexerMs: Number((lexerEnd - lexerStart).toFixed(2)),
    parserMs: Number((parserEnd - parserStart).toFixed(2)),
    semanticMs: Number((semanticEnd - semanticStart).toFixed(2)),
    totalMs: Number((semanticEnd - lexerStart).toFixed(2))
  }

  return result
}

function saveResult(result: BenchmarkResult): void {
  let results: BenchmarkResult[] = []

  if (fs.existsSync(RESULTS_FILE)) {
    const content = fs.readFileSync(RESULTS_FILE, 'utf-8')
    results = JSON.parse(content)
  }

  results.push(result)
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))
}

function main() {
  console.log('Running benchmark...')

  const result = runBenchmark()

  console.log(`Statements: ${result.statements}`)
  console.log(`Lexer: ${result.lexerMs}ms`)
  console.log(`Parser: ${result.parserMs}ms`)
  console.log(`Semantic: ${result.semanticMs}ms`)
  console.log(`Total: ${result.totalMs}ms`)

  saveResult(result)

  console.log(`\nResult saved to ${RESULTS_FILE}`)
}

main()