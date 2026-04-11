import { TokenType, Token } from './types'
import { KEYWORDS } from '../keywords'

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
    let numStr = ''
    const startColumn = this.column

    while (this.ch >= '0' && this.ch <= '9') {
      numStr += this.ch
      this.readChar()
    }

    if (this.ch === '.') {
      numStr += this.ch
      this.readChar()

      if (this.ch < '0' || this.ch > '9') {
        return { type: TokenType.ERROR, value: 'invalid number', line: this.line, column: startColumn }
      }

      while (this.ch >= '0' && this.ch <= '9') {
        numStr += this.ch
        this.readChar()
      }

      if (this.ch === '.') {
        return { type: TokenType.ERROR, value: 'invalid number', line: this.line, column: startColumn }
      }

      return { type: TokenType.NUMBER, value: parseFloat(numStr), line: this.line, column: startColumn }
    }

    return { type: TokenType.NUMBER, value: parseInt(numStr, 10), line: this.line, column: startColumn }
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

    while (this.isLetter(this.ch) || this.isDigit(this.ch) || this.ch === '-' || this.ch === '_' || this.ch === ':') {
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

    while (this.isLetter(this.ch) || this.isDigit(this.ch) || this.ch === '-' || this.ch === '_' || this.ch === ':') {
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
    let text = ''

    while (this.ch !== '<' && this.ch !== '{' && this.ch !== '' && this.ch !== '\n') {
      text += this.ch
      this.readChar()
    }

    return { type: TokenType.ANDROX_TEXT, value: text, line: this.line, column: startColumn }
  }

  escapeSequence(quote: string): string | null {
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
      default:
        return null
    }
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

    if (this.ch === '$' && this.peek() === '`') {
      const result = this.readTemplateString()
      return result[0] ?? { type: TokenType.EOF, value: null, line: this.line, column: this.column }
    }

    if (this.ch === '`') {
      const result = this.readTemplateString()
      return result[0] ?? { type: TokenType.EOF, value: null, line: this.line, column: this.column }
    }

    if (this.isLetter(this.ch)) {
      return this.readIdentifier()
    }

    if (this.ch >= '0' && this.ch <= '9') {
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

    while (this.ch === ' ' || this.ch === '\t' || this.ch === '\n' || this.ch === '\r') {
      this.readChar()
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

    if (this.isLetter(this.ch)) {
      let attrName = ''
      while (this.isLetter(this.ch) || this.isDigit(this.ch) || this.ch === '-' || this.ch === '_') {
        attrName += this.ch
        this.readChar()
      }

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

    if (this.isLetter(this.ch)) {
      return this.readIdentifier()
    }

    if (this.ch >= '0' && this.ch <= '9') {
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
    let ident = ''
    const startColumn = this.column

    while (this.isLetter(this.ch) || this.isDigit(this.ch)) {
      ident += this.ch
      this.readChar()
    }

    if (ident === 'true') {
      return { type: TokenType.BOOLEAN, value: true, line: this.line, column: startColumn }
    }

    if (ident === 'false') {
      return { type: TokenType.BOOLEAN, value: false, line: this.line, column: startColumn }
    }

    if (ident === 'null') {
      return { type: TokenType.NULL, value: null, line: this.line, column: startColumn }
    }

    if (ident === 'int') {
      return { type: TokenType.TYPE_INT, value: 'int', line: this.line, column: startColumn }
    }

    if (ident === 'float') {
      return { type: TokenType.TYPE_FLOAT, value: 'float', line: this.line, column: startColumn }
    }

    if (ident === 'bool') {
      return { type: TokenType.TYPE_BOOL, value: 'bool', line: this.line, column: startColumn }
    }

    if (ident === 'string') {
      return { type: TokenType.TYPE_STRING, value: 'string', line: this.line, column: startColumn }
    }

    if (ident === 'void') {
      return { type: TokenType.TYPE_VOID, value: 'void', line: this.line, column: startColumn }
    }

    const isKeyword = KEYWORDS.includes(ident)
    const type = isKeyword ? TokenType.KEYWORD : TokenType.IDENTIFIER

    return { type, value: ident, line: this.line, column: startColumn }
  }

  isIdentifierChar(ch: string): boolean {
    return this.isLetter(ch) || this.isDigit(ch)
  }

  isLetter(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$'
  }

  isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9'
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
        return { type: TokenType.ASSIGN, value: '=', line: this.line, column: startColumn }
      
      case '+':
        this.readChar()
        return { type: TokenType.PLUS, value: '+', line: this.line, column: startColumn }
      
      case '-':
        this.readChar()
        return { type: TokenType.MINUS, value: '-', line: this.line, column: startColumn }
      
      case '*':
        this.readChar()
        return { type: TokenType.STAR, value: '*', line: this.line, column: startColumn }
      
      case '/':
        this.readChar()
        return { type: TokenType.SLASH, value: '/', line: this.line, column: startColumn }
      
      case '%':
        this.readChar()
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
        if (this.isLetter(this.ch) || this.ch === '_' || this.ch === '$') {
          return this.readAndroxOpenTag()
        }
        return { type: TokenType.LESS_THAN, value: '<', line: this.line, column: startColumn }
      
      case '>':
        this.readChar()
        if (this.ch === '=') {
          this.readChar()
          return { type: TokenType.GREATER_EQUAL, value: '>=', line: this.line, column: startColumn }
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
        return { type: TokenType.OPERATOR, value: '|', line: this.line, column: startColumn }
      
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