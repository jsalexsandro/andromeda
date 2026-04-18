import { TokenType, Token } from './types'
import { KEYWORDS } from '../keywords'

// ============ OTIMIZAÇÕES: charCode constants ============
const CC_a = 97,  CC_z = 122
const CC_A = 65,  CC_Z = 90
const CC_0 = 48,  CC_9 = 57
const CC_UNDER = 95, CC_DOLLAR = 36
const CC_LT = 60,  CC_GT = 62
const CC_LBRACE = 123, CC_RBRACE = 125
const CC_QUOTE_D = 34, CC_QUOTE_S = 39
const CC_SLASH = 47, CC_NEWLINE = 10
const CC_DOT = 46
const CC_PLUS = 43, CC_MINUS = 45
const CC_STAR = 42, CC_SLASH_CHAR = 47
const CC_PERCENT = 37
const CC_EQUAL = 61
const CC_EXCL = 33
const CC_PIPE = 124
const CC_AMP = 38
const CC_QUESTION = 63
const CC_OPENPAREN = 40, CC_CLOSEPAREN = 41
const CC_COMMA = 44
const CC_LBRACKET = 91, CC_RBRACKET = 93
const CC_f = 102, CC_F = 70
const CC_7 = 55

// ============ OTIMIZAÇÕES: Set for O(1) lookup ============
const KEYWORDS_SET = new Set(KEYWORDS)

type LexerMode = 'NORMAL' | 'ANDROX_TAG' | 'ANDROX_CHILDREN' | 'ANDROX_EXPR'

export class Lexer {
  input: string
  position = 0
  readPosition = 0
  ch = ""
  previousCh = ""
  previousTokenType: TokenType | null = null
  line = 1
  column = 0
  templateMode: boolean = true

  private modeStack: LexerMode[] = ['NORMAL']
  private braceDepth: number = 0
  private currentTagName: string = ""
  private pendingAttrName: string | null = null
  private pendingAttrValue: Token | null = null
  private inTypeAnnotation = false
  private genericDepth = 0

  constructor(input: string, templateMode: boolean = true) {
    this.input = input
    this.templateMode = templateMode
    this.column = -1
    this.readChar()
  }

  private getMode(): LexerMode {
    return this.modeStack[this.modeStack.length - 1]
  }

  private pushMode(mode: LexerMode): void {
    this.modeStack.push(mode)
  }

  private popMode(): LexerMode {
    return this.modeStack.pop()!
  }

  readChar() {
    this.position = this.readPosition
    this.previousCh = this.ch
    this.ch = this.input[this.readPosition] || ""
    if (this.ch === '\n') {
      this.line++
      this.column = -1
    } else {
      this.column++
    }
    this.readPosition++
  }

  peek(): string {
    return this.input[this.readPosition] || ""
  }

  advance(): void {
    this.readChar()
  }

  consume(): string {
    const ch = this.ch
    this.readChar()
    return ch
  }

  skipWhitespace(): void {
    while (this.ch === ' ' || this.ch === '\t' || this.ch === '\n' || this.ch === '\r') {
      this.readChar()
    }
  }

  skipComment(): Token | null {
    const startColumn = this.column
    
    if (this.ch === '/' && this.peek() === '/') {
      while (this.ch !== '\n' && this.ch !== '') {
        this.readChar()
      }
      return null
    }

    if (this.ch === '/' && this.peek() === '*') {
      this.readChar()
      this.readChar()
      while (true) {
        if (this.ch === '') {
          return { type: TokenType.ERROR, value: 'unclosed comment', line: this.line, column: startColumn }
        }
        if (this.ch === '*' && this.peek() === '/') {
          this.readChar()
          this.readChar()
          break
        }
        this.readChar()
      }
      return null
    }

    return null
  }

readNumber(): Token {
    const startColumn = this.column
    const start = this.position

    // Check for hex literal (0x or 0X)
    if (this.ch === '0' && (this.peek() === 'x' || this.peek() === 'X')) {
      const startHex = this.position
      this.readChar() // consume '0'
      this.readChar() // consume 'x' or 'X'
      
      let hexValue = ''
      let hasValidDigit = false
      
      while (this.isHexDigit(this.ch)) {
        hexValue += this.ch
        hasValidDigit = true
        this.readChar()
      }
      
      // Check for identifier immediately after hex (like 0xABCDEFgh)
      if (this.isLetter() || this.ch === '_' || this.ch === '$') {
        // Consume the rest as identifier - this is a syntax error case
        while (this.isLetter() || this.isDigit() || this.ch === '_' || this.ch === '$') {
          this.readChar()
        }
        const ident = this.input.slice(startHex, this.position)
        return { type: TokenType.ERROR, value: `invalid hex literal: ${ident}`, line: this.line, column: startColumn }
      }
      
      if (!hasValidDigit) {
        return { type: TokenType.ERROR, value: 'hexadecimal digit expected', line: this.line, column: startColumn }
      }
      
      const numValue = parseInt(hexValue, 16)
      return { type: TokenType.NUMBER, value: numValue, line: this.line, column: startColumn }
    }

    // Check for binary literal (0b or 0B)
    if (this.ch === '0' && (this.peek() === 'b' || this.peek() === 'B')) {
      const startBin = this.position
      this.readChar() // consume '0'
      this.readChar() // consume 'b' or 'B'
      
      let binValue = ''
      let hasValidDigit = false
      
      while (this.ch === '0' || this.ch === '1') {
        binValue += this.ch
        hasValidDigit = true
        this.readChar()
      }
      
      // Check for invalid digits (like 0b123)
      if ((this.isDigit() && this.ch !== '0' && this.ch !== '1') || this.isLetter() || this.ch === '_' || this.ch === '$') {
        while (this.isLetter() || this.isDigit() || this.ch === '_' || this.ch === '$') {
          this.readChar()
        }
        const ident = this.input.slice(startBin, this.position)
        return { type: TokenType.ERROR, value: `invalid binary literal: ${ident}`, line: this.line, column: startColumn }
      }
      
      if (!hasValidDigit) {
        return { type: TokenType.ERROR, value: 'binary digit expected', line: this.line, column: startColumn }
      }
      
      const numValue = parseInt(binValue, 2)
      return { type: TokenType.NUMBER, value: numValue, line: this.line, column: startColumn }
    }

    // Check for octal literal (0o or 0O)
    if (this.ch === '0' && (this.peek() === 'o' || this.peek() === 'O')) {
      const startOct = this.position
      this.readChar() // consume '0'
      this.readChar() // consume 'o' or 'O'
      
      let octValue = ''
      let hasValidDigit = false
      
      while (this.isOctalDigit(this.ch)) {
        octValue += this.ch
        hasValidDigit = true
        this.readChar()
      }
      
      // Check for invalid digits
      if ((this.isDigit() && !this.isOctalDigit(this.ch)) || this.isLetter() || this.ch === '_' || this.ch === '$') {
        while (this.isLetter() || this.isDigit() || this.ch === '_' || this.ch === '$') {
          this.readChar()
        }
        const ident = this.input.slice(startOct, this.position)
        return { type: TokenType.ERROR, value: `invalid octal literal: ${ident}`, line: this.line, column: startColumn }
      }
      
      if (!hasValidDigit) {
        return { type: TokenType.ERROR, value: 'octal digit expected', line: this.line, column: startColumn }
      }
      
      const numValue = parseInt(octValue, 8)
      return { type: TokenType.NUMBER, value: numValue, line: this.line, column: startColumn }
    }

    // Regular decimal number
    while (this.isDigit()) {
      this.readChar()
    }

    // Check for decimal point - but only if followed by a digit (without consuming)
    if (this.ch === '.') {
      const nextChar = this.input[this.position + 1]
      const nextCharIsDigit = nextChar && nextChar >= '0' && nextChar <= '9'

      if (!nextCharIsDigit) {
        // It's a separate DOT token, not part of a float - leave it for the DOT handler
      } else {
        // It's a decimal point of a float
        this.readChar() // consume '.'
        while (this.isDigit()) {
          this.readChar()
        }
        
        // Check for exponential notation
        if (this.ch === 'e' || this.ch === 'E') {
          this.readChar()
          if (this.ch === '+' || this.ch === '-') {
            this.readChar()
          }
          if (!this.isDigit()) {
            return { type: TokenType.ERROR, value: 'digit expected in exponent', line: this.line, column: startColumn }
          }
          while (this.isDigit()) {
            this.readChar()
          }
        }
        
        const numStr = this.input.slice(start, this.position)
        return { type: TokenType.NUMBER, value: parseFloat(numStr), line: this.line, column: startColumn }
      }
    }

    // Check for exponential notation without decimal
    if (this.ch === 'e' || this.ch === 'E') {
      this.readChar()
      if (this.ch === '+' || this.ch === '-') {
        this.readChar()
      }
      if (!this.isDigit()) {
        return { type: TokenType.ERROR, value: 'digit expected in exponent', line: this.line, column: startColumn }
      }
      while (this.isDigit()) {
        this.readChar()
      }
      const numStr = this.input.slice(start, this.position)
      return { type: TokenType.NUMBER, value: parseFloat(numStr), line: this.line, column: startColumn }
    }

    // Check for leading zeros (like 007 or 0123) - potential octal without prefix
    if (this.position - start > 1 && this.input[start] === '0') {
      const numStr = this.input.slice(start, this.position)
      // Emit warning but still parse as decimal
      return { type: TokenType.ERROR, value: `invalid number: leading zeros not allowed (${numStr})`, line: this.line, column: startColumn }
    }

    const numStr = this.input.slice(start, this.position)
    return { type: TokenType.NUMBER, value: parseFloat(numStr), line: this.line, column: startColumn }
  }

  readString(quote: string): Token {
    const startColumn = this.column
    let str = ''
    this.readChar()

    while (this.ch !== quote && this.ch !== '') {
      if (this.ch === '\n' && quote !== '`') {
        this.readChar()
        return { type: TokenType.ERROR, value: 'unclosed string', line: this.line, column: startColumn }
      }

      if (this.ch === '\\') {
        this.readChar()
        const escaped = this.escapeSequence(quote)
        if (escaped === null) {
          return { type: TokenType.ERROR, value: 'invalid escape sequence', line: this.line, column: startColumn }
        }
        str += escaped
        continue
      }

      str += this.ch
      this.readChar()
    }

    if (this.ch === '') {
      return { type: TokenType.ERROR, value: 'unclosed string', line: this.line, column: startColumn }
    }

    this.readChar()
    return { type: TokenType.STRING, value: str, line: this.line, column: startColumn }
  }

  readAndroxOpenTag(): Token {
    const startColumn = this.column
    let tagName = ''

    while (this.isLetter() || this.isDigit() || this.ch === '-' || this.ch === '_' || this.ch === ':') {
      tagName += this.ch
      this.readChar()
    }

    this.currentTagName = tagName
    this.pushMode('ANDROX_TAG')
    return { type: TokenType.ANDROX_TAG_NAME, value: tagName, line: this.line, column: startColumn }
  }

  readAndroxCloseTag(): Token {
    const startColumn = this.column
    let tagName = ''

    while (this.isLetter() || this.isDigit() || this.ch === '-' || this.ch === '_' || this.ch === ':') {
      tagName += this.ch
      this.readChar()
    }

    while (this.ch === ' ' || this.ch === '\t' || this.ch === '\n' || this.ch === '\r') {
      this.readChar()
    }

    if (this.ch === '>') {
      this.readChar()
      this.popMode()
      return { type: TokenType.ANDROX_CLOSE_END, value: tagName, line: this.line, column: startColumn }
    }

    return { type: TokenType.ANDROX_CLOSE_TAG_NAME, value: tagName, line: this.line, column: startColumn }
  }

  readAndroxAttributeValue(): Token {
    const startColumn = this.column
    let str = ''
    const quote = this.ch

    this.readChar()
    while (this.ch !== quote && this.ch !== '') {
      if (this.ch === '\n') {
        return { type: TokenType.ERROR, value: 'unclosed string', line: this.line, column: startColumn }
      }
      if (this.ch === '\\') {
        this.readChar()
        const escaped = this.escapeSequence(quote)
        if (escaped === null) {
          return { type: TokenType.ERROR, value: 'invalid escape sequence', line: this.line, column: startColumn }
        }
        str += escaped
        continue
      }
      str += this.ch
      this.readChar()
    }

    if (this.ch === '') {
      return { type: TokenType.ERROR, value: 'unclosed string', line: this.line, column: startColumn }
    }

    this.readChar()
    return { type: TokenType.ANDROX_ATTR_STR, value: str, line: this.line, column: startColumn }
  }

  readAndroxExpression(): Token {
    const startColumn = this.column

    this.braceDepth = 1
    this.readChar()

    while (this.ch !== '' && this.ch !== '\n') {
      if (this.ch === '{') {
        this.braceDepth++
      } else if (this.ch === '}') {
        this.braceDepth--
        if (this.braceDepth === 0) {
          this.readChar()
          return { type: TokenType.ANDROX_EXPR_CLOSE, value: '', line: this.line, column: startColumn }
        }
      } else if (this.ch === '"' || this.ch === "'") {
        this.readAndroxAttributeValue()
        continue
      }
      this.readChar()
    }

    return { type: TokenType.ERROR, value: 'unclosed expression', line: this.line, column: startColumn }
  }

  readAndroxText(): Token {
    const startColumn = this.column
    const start = this.position  // OTIMIZAÇÃO: guarda posição inicial

    while (this.ch !== '<' && this.ch !== '{' && this.ch !== '' && this.ch !== '\n') {
      this.readChar()
    }

    const text = this.input.slice(start, this.position)  // OTIMIZAÇÃO: slice único
    return { type: TokenType.ANDROX_TEXT, value: text, line: this.line, column: startColumn }
  }

  escapeSequence(quote: string): string | null {
    const startColumn = this.column
    
    switch (this.ch) {
      case '"':
        this.readChar()
        return '"'
      case "'":
        this.readChar()
        return "'"
      case '\\':
        this.readChar()
        return '\\'
      case 'n':
        this.readChar()
        return '\n'
      case 't':
        this.readChar()
        return '\t'
      case 'r':
        this.readChar()
        return '\r'
      case '`':
        this.readChar()
        return '`'
      case '$':
        this.readChar()
        return '$'
      case '{':
        this.readChar()
        return '{'
      case '}':
        this.readChar()
        return '}'
      case 'b':
        this.readChar()
        return '\b'
      case 'f':
        this.readChar()
        return '\f'
      case 'v':
        this.readChar()
        return '\v'
      case '0':
        this.readChar()
        return '\0'
      case 'x':
        this.readChar()
        return this.readHexEscape(2, startColumn)
      case 'u':
        this.readChar()
        return this.readUnicodeEscape(startColumn)
      default:
        return null
    }
  }

  private readHexEscape(length: number, startColumn: number): string | null {
    let hex = ''
    for (let i = 0; i < length; i++) {
      if (this.isHexDigit(this.ch)) {
        hex += this.ch
        this.readChar()
      } else {
        return null // Invalid hex escape
      }
    }
    return String.fromCharCode(parseInt(hex, 16))
  }

  private readUnicodeEscape(startColumn: number): string | null {
    // Check for { } Unicode escape (modern syntax)
    if (this.ch === '{') {
      this.readChar()
      let hex = ''
      while (this.ch !== '}' && this.ch !== '') {
        if (this.isHexDigit(this.ch)) {
          hex += this.ch
          this.readChar()
        } else {
          return null
        }
      }
      if (this.ch !== '}') {
        return null
      }
      this.readChar()
      const codePoint = parseInt(hex, 16)
      if (codePoint > 0x10FFFF) return null // Invalid code point
      return String.fromCodePoint(codePoint)
    }
    
    // Check for 4-digit Unicode escape
    return this.readHexEscape(4, startColumn)
  }

  readTemplateString(): Token[] {
    const startColumn = this.column
    const startLine = this.line
    const hasInterpolation = this.ch === '$'
    
    if (this.ch === '$') {
      this.readChar()
    }
    this.readChar()
    
    const tokens: Token[] = []
    let currentText = ''
    let isEscaped = false
    let braceDepth = 0

    const addTextToken = () => {
      if (currentText !== '') {
        tokens.push({ type: TokenType.STRING, value: currentText, line: startLine, column: startColumn })
        currentText = ''
      }
    }

    while (true) {
      if (this.ch === '') {
        tokens.push({ type: TokenType.ERROR, value: 'unclosed template string', line: startLine, column: startColumn })
        break
      }

      if (isEscaped) {
        isEscaped = false
        currentText += this.ch
        this.readChar()
        continue
      }

      if (this.ch === '\\') {
        isEscaped = true
        this.readChar()
        continue
      }

      if (this.ch === '$' && this.peek() === '{') {
        addTextToken()
        this.readChar()
        this.readChar()
        tokens.push({ type: TokenType.LBRACE, value: '${', line: startLine, column: startColumn })
        braceDepth = 1
        
        while (braceDepth > 0 && this.ch !== '' && this.ch !== '\n') {
          if (this.ch === '{') braceDepth++
          if (this.ch === '}') braceDepth--
          if (braceDepth > 0) {
            currentText += this.ch
          }
          this.readChar()
        }
        
        if (currentText !== '') {
          tokens.push({ type: TokenType.TEMPLATE_MIDDLE, value: currentText, line: startLine, column: startColumn })
          currentText = ''
        }
        tokens.push({ type: TokenType.RBRACE, value: '}', line: startLine, column: startColumn })
        continue
      }

      if (hasInterpolation && this.ch === '{') {
        addTextToken()
        this.readChar()
        tokens.push({ type: TokenType.LBRACE, value: '{', line: startLine, column: startColumn })
        braceDepth = 1
        
        while (braceDepth > 0 && this.ch !== '' && this.ch !== '\n') {
          if (this.ch === '{') braceDepth++
          if (this.ch === '}') braceDepth--
          if (braceDepth > 0) {
            currentText += this.ch
          }
          this.readChar()
        }
        
        if (currentText !== '') {
          tokens.push({ type: TokenType.TEMPLATE_MIDDLE, value: currentText, line: startLine, column: startColumn })
          currentText = ''
        }
        tokens.push({ type: TokenType.RBRACE, value: '}', line: startLine, column: startColumn })
        continue
      }

      if (this.ch === '`') {
        addTextToken()
        this.readChar()
        tokens.push({ type: TokenType.EOF, value: null, line: startLine, column: startColumn })
        break
      }

      currentText += this.ch
      this.readChar()
    }
    
    return tokens
  }

  private _nextToken(): Token {
    const mode = this.getMode()

    if (mode === 'ANDROX_TAG') {
      return this.readAndroxTagMode()
    }

    if (mode === 'ANDROX_CHILDREN') {
      return this.readAndroxChildrenMode()
    }

    if (mode === 'ANDROX_EXPR') {
      return this.readAndroxExprMode()
    }

    this.skipWhitespace()

    if (this.ch === '') {
      return { type: TokenType.EOF, value: null, line: this.line, column: this.column }
    }

    // Check for invalid/unknown characters
    const charCode = this.input.charCodeAt(this.position)
    if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
      // Skip invalid control characters but report error
      const invalidChar = this.ch
      this.readChar()
      return { type: TokenType.ERROR, value: `invalid character: ${invalidChar.charCodeAt(0).toString(16)}`, line: this.line, column: this.column - 1 }
    }

    if (this.ch === '$' && this.peek() === '`') {
      const result = this.readTemplateString()
      return result[0] ?? { type: TokenType.EOF, value: null, line: this.line, column: this.column }
    }

    if (this.ch === '`') {
      const result = this.readTemplateString()
      return result[0] ?? { type: TokenType.EOF, value: null, line: this.line, column: this.column }
    }

    if (this.isLetter()) {
      return this.readIdentifier()
    }

    if (this.isDigit()) {
      return this.readNumber()
    }

    if (this.ch === '"' || this.ch === "'") {
      return this.readString(this.ch)
    }

    if (this.ch === '/') {
      const commentResult = this.skipComment()
      if (commentResult) {
        return commentResult
      }
      if (this.ch === '/') {
        return this.readOperator()
      }
      return this._nextToken()
    }

    return this.readOperator()
  }

  private readAndroxTagMode(): Token {
    const startColumn = this.column

    if (this.pendingAttrValue !== null) {
      const val = this.pendingAttrValue
      this.pendingAttrValue = null
      if (val.type === TokenType.ANDROX_EXPR_OPEN) {
        this.pushMode('ANDROX_EXPR')
      }
      return val
    }

    // Skip whitespace
    while (this.ch === ' ' || this.ch === '\t' || this.ch === '\n' || this.ch === '\r') {
      this.readChar()
    }

    // Check for HTML comment inside tag
    if (this.ch === '<' && this.peek() === '!') {
      this.readChar() // consume '<'
      this.readChar() // consume '!'
      if (this.ch === '-' && this.peek() === '-') {
        this.readChar() // consume '-'
        this.readChar() // consume '-'
        // Skip until -->
        while (this.ch !== '' && !(this.ch === '-' && this.peek() === '-')) {
          this.readChar()
        }
        if (this.ch === '-') {
          this.readChar()
          this.readChar()
        }
        return this.readAndroxTagMode() // Continue parsing
      }
    }

    if (this.ch === '>') {
      this.readChar()
      this.popMode()
      this.pushMode('ANDROX_CHILDREN')
      return { type: TokenType.ANDROX_TAG_END, value: this.currentTagName, line: this.line, column: startColumn }
    }

    if (this.ch === '/' && this.peek() === '>') {
      this.readChar()
      this.readChar()
      const tagName = this.currentTagName
      this.popMode()
      return { type: TokenType.ANDROX_SELF_CLOSE, value: tagName, line: this.line, column: startColumn }
    }

    // Handle spread operator {...props} in attributes
    if (this.ch === '.' && this.peek() === '.' && this.input[this.position + 2] === '.') {
      return this.readOperator() // Returns SPREAD token
    }

    // Handle opening brace for spread or expression in tag
    if (this.ch === '{') {
      const startPos = this.position
      this.readChar()
      // Check if it's a spread {...}
      if (this.ch === '.' && this.peek() === '.' && this.input[this.position + 2] === '.') {
        this.readChar()
        this.readChar()
        this.readChar()
        // Now we should have identifier after ...
        if (this.isLetter()) {
          const identStart = this.position
          let ident = ''
          while (this.isLetter() || this.isDigit() || this.ch === '_' || this.ch === '$') {
            ident += this.ch
            this.readChar()
          }
          // Check for closing brace
          if (this.ch === '}') {
            this.readChar()
            return { type: TokenType.ANDROX_SPREAD_ATTR, value: ident, line: this.line, column: startColumn }
          }
        }
        // Fall back to just returning spread
        this.position = startPos
        this.readChar()
      }
      // Not a spread, return expression open
      return { type: TokenType.ANDROX_EXPR_OPEN, value: '{', line: this.line, column: startColumn }
    }

    if (this.isLetter()) {
      let attrName = ''
      while (this.isLetter() || this.isDigit() || this.ch === '-' || this.ch === '_') {
        attrName += this.ch
        this.readChar()
      }

      // Skip whitespace after attribute name
      while (this.ch === ' ' || this.ch === '\t') {
        this.readChar()
      }

      if (this.ch === '=') {
        this.readChar()
        while (this.ch === ' ' || this.ch === '\t') {
          this.readChar()
        }

        if (this.ch === '"' || this.ch === "'") {
          const attrStr = { type: TokenType.ANDROX_ATTR_STR, value: this.readAndroxAttributeValue().value, line: this.line, column: startColumn }
          this.pendingAttrValue = attrStr
          return { type: TokenType.ANDROX_ATTR_NAME, value: attrName, line: this.line, column: startColumn }
        }

        if (this.ch === '{') {
          this.readChar()
          this.braceDepth = 1
          const exprOpen = { type: TokenType.ANDROX_EXPR_OPEN, value: '{', line: this.line, column: startColumn }
          this.pendingAttrValue = exprOpen
          return { type: TokenType.ANDROX_ATTR_NAME, value: attrName, line: this.line, column: startColumn }
        }

        this.pendingAttrValue = { type: TokenType.ANDROX_ATTR_TRUE, value: true, line: this.line, column: startColumn }
        return { type: TokenType.ANDROX_ATTR_NAME, value: attrName, line: this.line, column: startColumn }
      }

      return { type: TokenType.ANDROX_ATTR_NAME, value: attrName, line: this.line, column: startColumn }
    }

    this.readChar()
    return { type: TokenType.ERROR, value: 'unexpected in ANDROX_TAG', line: this.line, column: startColumn }
  }

  private readAndroxChildrenMode(): Token {
    const startColumn = this.column

    if (this.ch === '<') {
      this.readChar()
      if (this.ch === '/') {
        this.readChar()
        return this.readAndroxCloseTag()
      }
      return this.readAndroxOpenTag()
    }

    if (this.ch === '{') {
      this.readChar()
      this.pushMode('ANDROX_EXPR')
      this.braceDepth = 1
      return { type: TokenType.ANDROX_EXPR_OPEN, value: '{', line: this.line, column: startColumn }
    }

    return this.readAndroxText()
  }

  private readAndroxExprMode(): Token {
    const startColumn = this.column

    if (this.ch === '{') {
      this.braceDepth++
      this.readChar()
      return { type: TokenType.LBRACE, value: '{', line: this.line, column: startColumn }
    }

    if (this.ch === '}') {
      this.braceDepth--
      this.readChar()
      if (this.braceDepth === 0) {
        this.popMode()
        return { type: TokenType.ANDROX_EXPR_CLOSE, value: '}', line: this.line, column: startColumn }
      }
      return { type: TokenType.RBRACE, value: '}', line: this.line, column: startColumn }
    }

    if (this.ch === '"' || this.ch === "'") {
      return this.readAndroxAttributeValue()
    }

    if (this.isLetter()) {
      return this.readIdentifier()
    }

    if (this.isDigit()) {
      return this.readNumber()
    }

    if (this.ch === '(' || this.ch === ')') {
      const ch = this.ch
      this.readChar()
      return { type: TokenType.LPAREN, value: ch, line: this.line, column: startColumn }
    }

    if (this.ch === '[' || this.ch === ']') {
      const ch = this.ch
      this.readChar()
      return { type: TokenType.LBRACKET, value: ch, line: this.line, column: startColumn }
    }

    if (this.ch === '.') {
      const ch = this.ch
      this.readChar()
      return { type: TokenType.DOT, value: ch, line: this.line, column: startColumn }
    }

    if (this.ch === ',') {
      const ch = this.ch
      this.readChar()
      return { type: TokenType.COMMA, value: ch, line: this.line, column: startColumn }
    }

    if (this.ch === ':') {
      const ch = this.ch
      this.readChar()
      return { type: TokenType.COLON, value: ch, line: this.line, column: startColumn }
    }

    const opChars = '+-*/%<>=!&|?='
    if (opChars.includes(this.ch)) {
      let op = this.ch
      this.readChar()
      if ('<>=!&|'.includes(this.ch)) {
        op += this.ch
        this.readChar()
      }
      if (this.ch === '=') {
        op += this.ch
        this.readChar()
      }
      return { type: TokenType.OPERATOR, value: op, line: this.line, column: startColumn }
    }

    this.readChar()
    return { type: TokenType.ERROR, value: `unexpected in ANDROX_EXPR: ${this.ch}`, line: this.line, column: startColumn }
  }

  readIdentifier(): Token {
    const startColumn = this.column
    const start = this.position  // OTIMIZAÇÃO: guarda posição inicial

    while (this.isLetter() || this.isDigit()) {
      this.readChar()
    }

    const ident = this.input.slice(start, this.position)  // OTIMIZAÇÃO: slice único em vez de concatenação

    // ========================================
    // Boolean Literals
    // ========================================
    if (ident === 'true') {
      return { type: TokenType.BOOLEAN, value: true, line: this.line, column: startColumn }
    }

    if (ident === 'false') {
      return { type: TokenType.BOOLEAN, value: false, line: this.line, column: startColumn }
    }

    // ========================================
    // Null Literal
    // ========================================
    if (ident === 'null') {
      return { type: TokenType.NULL, value: null, line: this.line, column: startColumn }
    }

    // ========================================
    // Type Keywords - Primitive Types
    // ========================================
    if (ident === 'int') {
      return { type: TokenType.INT_TYPE, value: 'int', line: this.line, column: startColumn }
    }

    if (ident === 'float') {
      return { type: TokenType.FLOAT_TYPE, value: 'float', line: this.line, column: startColumn }
    }

    if (ident === 'string') {
      return { type: TokenType.STRING_TYPE, value: 'string', line: this.line, column: startColumn }
    }

    if (ident === 'bool') {
      return { type: TokenType.BOOLEAN_TYPE, value: 'bool', line: this.line, column: startColumn }
    }

    if (ident === 'undefined') {
      return { type: TokenType.UNDEFINED_TYPE, value: 'undefined', line: this.line, column: startColumn }
    }

    if (ident === 'null') {
      return { type: TokenType.NULL_TYPE, value: 'null', line: this.line, column: startColumn }
    }

    if (ident === 'void') {
      return { type: TokenType.VOID_TYPE, value: 'void', line: this.line, column: startColumn }
    }

    if (ident === 'any') {
      return { type: TokenType.ANY_TYPE, value: 'any', line: this.line, column: startColumn }
    }

    if (ident === 'unknown') {
      return { type: TokenType.UNKNOWN_TYPE, value: 'unknown', line: this.line, column: startColumn }
    }

    if (ident === 'object') {
      return { type: TokenType.OBJECT_TYPE, value: 'object', line: this.line, column: startColumn }
    }

    // ========================================
    // Type Operators
    // ========================================
    if (ident === 'keyof') {
      return { type: TokenType.KEYOF, value: 'keyof', line: this.line, column: startColumn }
    }

    if (ident === 'typeof') {
      return { type: TokenType.TYPEOF, value: 'typeof', line: this.line, column: startColumn }
    }

    if (ident === 'readonly') {
      return { type: TokenType.READONLY, value: 'readonly', line: this.line, column: startColumn }
    }

    // ========================================
    // Regular Keywords and Identifiers
    // ========================================
    // OTIMIZAÇÃO: Set.has() é O(1) vs Array.includes() que é O(n)
    const isKeyword = KEYWORDS_SET.has(ident)
    const type = isKeyword ? TokenType.KEYWORD : TokenType.IDENTIFIER

    return { type, value: ident, line: this.line, column: startColumn }
  }

  isIdentifierChar(ch: string): boolean {
    return this.isLetter() || this.isDigit()
  }

  // ============ OTIMIZAÇÕES: isLetter/isDigit using charCodeAt ============
  isLetter(): boolean {
    const c = this.input.charCodeAt(this.position)
    return (c >= CC_a && c <= CC_z) || (c >= CC_A && c <= CC_Z) || c === CC_UNDER || c === CC_DOLLAR
  }

  isDigit(): boolean {
    const c = this.input.charCodeAt(this.position)
    return c >= CC_0 && c <= CC_9
  }

  isHexDigit(ch: string): boolean {
    const c = ch.charCodeAt(0)
    return (c >= CC_0 && c <= CC_9) || 
           (c >= CC_a && c <= CC_f) || 
           (c >= CC_A && c <= CC_F)
  }

  isOctalDigit(ch: string): boolean {
    const c = ch.charCodeAt(0)
    return c >= CC_0 && c <= CC_7
  }

  isBinaryDigit(ch: string): boolean {
    return ch === '0' || ch === '1'
  }

  readOperator(): Token {
    const startColumn = this.column
    const ch = this.ch

    switch (ch) {
      case '=':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.EQUAL, value: '==', line: this.line, column: startColumn }
        }
        if (this.ch === '>' && this.previousTokenType !== TokenType.KEYWORD) {
          this.readChar()
          return { type: TokenType.ARROW, value: '=>', line: this.line, column: startColumn }
        }
        // Limpa modo tipo quando chega ao inicializador
        this.inTypeAnnotation = false
        this.genericDepth = 0
        return { type: TokenType.ASSIGN, value: '=', line: this.line, column: startColumn }
      
      case '+':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.PLUS_EQUAL, value: '+=', line: this.line, column: startColumn }
        }
        if (this.ch === '+') {
          this.readChar()
          return { type: TokenType.INCREMENT, value: '++', line: this.line, column: startColumn }
        }
        return { type: TokenType.PLUS, value: '+', line: this.line, column: startColumn }
      
      case '-':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.MINUS_EQUAL, value: '-=', line: this.line, column: startColumn }
        }
        if (this.ch === '-') {
          this.readChar()
          return { type: TokenType.DECREMENT, value: '--', line: this.line, column: startColumn }
        }
        return { type: TokenType.MINUS, value: '-', line: this.line, column: startColumn }
      
      case '*':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.STAR_EQUAL, value: '*=', line: this.line, column: startColumn }
        }
        return { type: TokenType.STAR, value: '*', line: this.line, column: startColumn }
      
      case '/':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.SLASH_EQUAL, value: '/=', line: this.line, column: startColumn }
        }
        return { type: TokenType.SLASH, value: '/', line: this.line, column: startColumn }
      
      case '%':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.MODULO_EQUAL, value: '%=', line: this.line, column: startColumn }
        }
        return { type: TokenType.MODULO, value: '%', line: this.line, column: startColumn }
      
      case '<':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.LESS_EQUAL, value: '<=', line: this.line, column: startColumn }
        }
        if (this.ch === '/') {
          this.readChar()
          return this.readAndroxCloseTag()
        }
        // Se estiver em type annotation, é generic, não ANDROX
        if (this.inTypeAnnotation && (this.isLetter() || this.ch === '_' || this.ch === '$')) {
          this.genericDepth++
          return { type: TokenType.LESS_THAN, value: '<', line: this.line, column: startColumn }
        }
        // Comportamento original: ANDROX
        if (this.isLetter() || this.ch === '_' || this.ch === '$') {
          return this.readAndroxOpenTag()
        }
        return { type: TokenType.LESS_THAN, value: '<', line: this.line, column: startColumn }
      
      case '>':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.GREATER_EQUAL, value: '>=', line: this.line, column: startColumn }
        }
        // Se estava em generic, fecha o generic e controle profundidade
        if (this.inTypeAnnotation && this.genericDepth > 0) {
          this.genericDepth--
          if (this.genericDepth === 0) {
            this.inTypeAnnotation = false
          }
          return { type: TokenType.GREATER_THAN, value: '>', line: this.line, column: startColumn }
        }
        return { type: TokenType.GREATER_THAN, value: '>', line: this.line, column: startColumn }
      
      case '!':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.NOT_EQUAL, value: '!=', line: this.line, column: startColumn }
        }
        return { type: TokenType.NOT, value: '!', line: this.line, column: startColumn }
      
      case '&':
        this.readChar()
        if (this.ch === '&') {
          this.readChar()
          return { type: TokenType.AND, value: '&&', line: this.line, column: startColumn }
        }
        return { type: TokenType.OPERATOR, value: '&', line: this.line, column: startColumn }
      
      case '|':
        this.readChar()
        if (this.ch === '|') {
          this.readChar()
          return { type: TokenType.OR, value: '||', line: this.line, column: startColumn }
        }
        return { type: TokenType.PIPE, value: '|', line: this.line, column: startColumn }
      
      case '(':
        this.readChar()
        return { type: TokenType.LPAREN, value: '(', line: this.line, column: startColumn }
      
      case ')':
        this.readChar()
        return { type: TokenType.RPAREN, value: ')', line: this.line, column: startColumn }
      
      case '{':
        this.readChar()
        return { type: TokenType.LBRACE, value: '{', line: this.line, column: startColumn }
      
      case '}':
        this.readChar()
        return { type: TokenType.RBRACE, value: '}', line: this.line, column: startColumn }
      
      case '[':
        this.readChar()
        return { type: TokenType.LBRACKET, value: '[', line: this.line, column: startColumn }
      
      case ']':
        this.readChar()
        return { type: TokenType.RBRACKET, value: ']', line: this.line, column: startColumn }
      
      case ',':
        this.readChar()
        return { type: TokenType.COMMA, value: ',', line: this.line, column: startColumn }
      
      case '.':
        this.readChar()
        if (this.ch === '.' && this.peek() === '.') {
          this.readChar()
          this.readChar()
          return { type: TokenType.SPREAD, value: '...', line: this.line, column: startColumn }
        }
        return { type: TokenType.DOT, value: '.', line: this.line, column: startColumn }
      
      case ';':
        this.readChar()
        return { type: TokenType.SEMICOLON, value: ';', line: this.line, column: startColumn }
      
      case ':':
        this.readChar()
        this.inTypeAnnotation = true
        this.genericDepth = 0
        return { type: TokenType.COLON, value: ':', line: this.line, column: startColumn }
      
      case '?':
        this.readChar()
        if (this.ch === '?') {
          this.readChar()
          return { type: TokenType.QUESTION_QUESTION, value: '??', line: this.line, column: startColumn }
        }
        return { type: TokenType.QUESTION, value: '?', line: this.line, column: startColumn }
      
      default:
        this.readChar()
        return { type: TokenType.ERROR, value: ch, line: this.line, column: startColumn }
    }
  }

  nextToken(): Token {
    const token = this._nextToken()
    this.previousTokenType = token.type
    return token
  }

  tokenize(): Token[] {
    const tokens: Token[] = []
    
    if (this.templateMode) {
      this._tokenizeTemplate(tokens)
    } else {
      let token = this.nextToken()
      
      while (token.type !== TokenType.EOF) {
        tokens.push(token)
        token = this.nextToken()
      }
    }
    
    tokens.push({ type: TokenType.EOF, value: null, line: 0, column: 0 })
    return tokens
  }

  private _tokenizeTemplate(tokens: Token[]): void {
    const pendingTokens: Token[] = []
    
    while (true) {
      let token: Token
      
      if (pendingTokens.length > 0) {
        token = pendingTokens.shift()!
      } else {
        this.skipWhitespace()
        
        if (this.ch === '') {
          break
        }
        
        if (this.ch === '$' && this.peek() === '`') {
          const templateTokens = this.readTemplateString()
          for (const t of templateTokens) {
            if (t.type !== TokenType.EOF) {
              pendingTokens.push(t)
            }
          }
          continue
        }
        
        if (this.ch === '`') {
          const templateTokens = this.readTemplateString()
          for (const t of templateTokens) {
            if (t.type !== TokenType.EOF) {
              pendingTokens.push(t)
            }
          }
          continue
        }
        
        token = this.nextToken()
      }
      
      if (token.type === TokenType.EOF) {
        break
      }
      
      tokens.push(token)
    }
  }
}