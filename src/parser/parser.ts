import { Token, TokenType } from '../lexer/types'
import { ErrorHandler } from './error'
import { Expr, Stmt, TypeNode } from '../ast'
import { Precedence, getPrecedence } from './precedence'

type PrefixParselet = () => Expr | null;
type InfixParselet = (left: Expr) => Expr | null;

export class Parser {
  private tokens: Token[]
  private current = 0
  public errors: ErrorHandler
  private sourceCode: string

  private prefixParselets: Map<TokenType, PrefixParselet> = new Map()
  private infixParselets: Map<TokenType, InfixParselet> = new Map()

  constructor(tokens: Token[], sourceCode: string) {
    this.tokens = tokens
    this.sourceCode = sourceCode
    this.errors = new ErrorHandler(sourceCode)

    this.registerParselets()
  }

  private registerParselets() {
    this.prefixParselets.set(TokenType.IDENTIFIER, this.parseIdentifier.bind(this))
    this.prefixParselets.set(TokenType.NUMBER, this.parseNumber.bind(this))
    this.prefixParselets.set(TokenType.STRING, this.parseString.bind(this))
    this.prefixParselets.set(TokenType.BOOLEAN, this.parseBoolean.bind(this))
    this.prefixParselets.set(TokenType.NULL, this.parseNull.bind(this))
    this.prefixParselets.set(TokenType.LPAREN, this.parseGroup.bind(this))

    this.prefixParselets.set(TokenType.MINUS, this.parseUnary.bind(this))
    this.prefixParselets.set(TokenType.PLUS, this.parseUnary.bind(this))
    this.prefixParselets.set(TokenType.NOT, this.parseUnary.bind(this))

    this.prefixParselets.set(TokenType.LPAREN, this.parseArrowOrGroup.bind(this))

    this.prefixParselets.set(TokenType.LBRACKET, this.parseArrayLiteral.bind(this))

    this.prefixParselets.set(TokenType.SPREAD, this.parseSpread.bind(this))

    this.infixParselets.set(TokenType.ASSIGN, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.PLUS_EQUAL, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.MINUS_EQUAL, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.STAR_EQUAL, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.SLASH_EQUAL, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.MODULO_EQUAL, this.parseAssignment.bind(this))

    this.infixParselets.set(TokenType.PLUS, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.MINUS, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.STAR, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.SLASH, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.MODULO, this.parseBinary.bind(this))

    this.infixParselets.set(TokenType.EQUAL, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.NOT_EQUAL, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.LESS_THAN, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.GREATER_THAN, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.LESS_EQUAL, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.GREATER_EQUAL, this.parseBinary.bind(this))

    this.infixParselets.set(TokenType.AND, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.OR, this.parseBinary.bind(this))

    this.infixParselets.set(TokenType.QUESTION, this.parseTernary.bind(this))

    this.infixParselets.set(TokenType.QUESTION_QUESTION, this.parseNullish.bind(this))

    this.infixParselets.set(TokenType.LPAREN, this.parseCall.bind(this))

    this.infixParselets.set(TokenType.DOT, this.parseMember.bind(this))

    this.infixParselets.set(TokenType.LBRACKET, this.parseIndex.bind(this))

    this.prefixParselets.set(TokenType.LBRACE, this.parseObjectLiteral.bind(this))

    this.infixParselets.set(TokenType.INCREMENT, this.parsePostfixIncrement.bind(this))
    this.infixParselets.set(TokenType.DECREMENT, this.parsePostfixDecrement.bind(this))
  }

  private parseIdentifier(): Expr {
    const name = this.previous()

    if (this.check(TokenType.ARROW)) {
      this.advance()
      const params = [{ name }]
      return this.parseArrowBody(params)
    }

    return { kind: "Identifier", name }
  }

  private parseNumber(): Expr {
    return { kind: "Literal", value: this.previous().value }
  }

  private parseString(): Expr {
    return { kind: "Literal", value: this.previous().value }
  }

  private parseBoolean(): Expr {
    return { kind: "Literal", value: this.previous().value }
  }

  private parseNull(): Expr {
    return { kind: "Literal", value: null }
  }

  private parseGroup(): Expr {
    const lparen = this.previous()
    const expr = this.parseExpression(Precedence.LOWEST)
    if (this.check(TokenType.RPAREN)) {
      this.advance()
    } else {
      this.error(`Expected ')' to close group starting at line ${lparen.line}`, lparen)
    }
    return { kind: "Group", expression: expr }
  }

  private parseArrayLiteral(): Expr {
    const bracket = this.previous().type === TokenType.LBRACKET 
      ? this.previous() 
      : this.peek()
    
    if (this.previous().type !== TokenType.LBRACKET) {
      this.advance()
    }

    const elements: Expr[] = []
    let foundClosingBracket = false

    if (this.check(TokenType.RBRACKET)) {
      this.advance()
      foundClosingBracket = true
      return { kind: "Array", elements }
    }

    while (!this.isAtEnd()) {
      const elem = this.parseExpression(Precedence.LOWEST)
      if (elem) {
        elements.push(elem)
      }

      if (this.check(TokenType.RBRACKET)) {
        this.advance()
        foundClosingBracket = true
        break
      }

      if (this.check(TokenType.COMMA)) {
        this.advance()
        if (this.check(TokenType.RBRACKET)) {
          this.advance()
          foundClosingBracket = true
          break
        }
      } else {
        if (!this.isAtEnd()) {
          this.error("Expected ',' or ']' after array element", this.peek())
        }
        break
      }
    }

    if (!foundClosingBracket && !this.isAtEnd()) {
      this.error("Expected ']' to close array literal", bracket)
    }

    return { kind: "Array", elements }
  }

  private parseObjectLiteral(): Expr {
    const brace = this.peek()
    const properties: { key: string | null; value: Expr }[] = []

    const isAtBrace = this.check(TokenType.LBRACE)
    if (isAtBrace) {
      this.advance()
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance()
      return { kind: "Object", properties }
    }

    while (!this.isAtEnd() && !this.check(TokenType.RBRACE)) {
      let key: string | null = null
      let value: Expr | null = null

      if (this.check(TokenType.SPREAD)) {
        this.advance()
        const spreadArg = this.parseExpression(Precedence.LOWEST)
        if (spreadArg) {
          properties.push({ key: null, value: { kind: "Spread", argument: spreadArg } })
        }
      } else if (this.check(TokenType.IDENTIFIER) || 
          this.check(TokenType.KEYWORD) || 
          this.check(TokenType.BOOLEAN) ||
          this.check(TokenType.NULL)) {
        key = this.advance().value as string

        if (this.check(TokenType.COLON)) {
          this.advance()
          value = this.parseExpression(Precedence.LOWEST)
        } else {
          value = { kind: "Identifier", name: { type: TokenType.IDENTIFIER, value: key, line: brace.line, column: brace.column } }
        }
      } else if (this.check(TokenType.STRING)) {
        key = this.advance().value as string
        if (this.check(TokenType.COLON)) {
          this.advance()
          value = this.parseExpression(Precedence.LOWEST)
        }
      } else if (this.check(TokenType.NUMBER)) {
        const numToken = this.advance()
        const numValue = numToken.value as number
        key = String(numValue)

        if (this.check(TokenType.COLON)) {
          this.advance()
          value = this.parseExpression(Precedence.LOWEST)
        } else {
          value = { kind: "Identifier", name: { type: TokenType.IDENTIFIER, value: key, line: brace.line, column: brace.column } }
        }
      } else {
        this.error("Expected property name", this.peek())
        break
      }

      if (value) {
        properties.push({ key, value })
      }

      if (this.check(TokenType.RBRACE)) break

      if (!this.check(TokenType.COMMA)) {
        this.error("Expected ',' or '}' in object literal", this.peek())
        break
      }
      this.advance()
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance()
    } else {
      this.error("Expected '}' to close object literal", this.peek())
    }

    return { kind: "Object", properties }
  }

  private parseSpread(): Expr {
    const spread = this.previous()
    const arg = this.parseExpression(Precedence.LOWEST)
    if (!arg) {
      this.error("Expected expression after '...'", spread)
      return { kind: "Identifier", name: { type: TokenType.IDENTIFIER, value: "error", line: spread.line, column: spread.column } }
    }
    return { kind: "Spread", argument: arg }
  }

  private parseArrowOrGroup(): Expr {
    const startPos = this.current

    const arrow = this.tryParseArrowFunction()
    if (arrow) {
      return arrow
    }

    this.current = startPos
    return this.parseGroup()
  }

  private tryParseArrowFunction(): Expr | null {
    const params: { name: Token; isRest?: boolean }[] = []

    if (this.check(TokenType.RPAREN)) {
      this.advance()
      
      if (!this.check(TokenType.ARROW)) {
        return null
      }
      this.advance()
      return this.parseArrowBody(params)
    }

    while (!this.isAtEnd() && !this.check(TokenType.RPAREN)) {
      let isRest = false
      if (this.check(TokenType.SPREAD)) {
        this.advance()
        isRest = true
      }

      if (this.peek().type !== TokenType.IDENTIFIER) {
        return null
      }

      const paramName = this.advance()
      params.push({ name: paramName, isRest })

      if (this.check(TokenType.COMMA)) {
        this.advance()
      }
    }

    if (!this.check(TokenType.RPAREN)) {
      return null
    }
    this.advance()

    if (!this.check(TokenType.ARROW)) {
      return null
    }
    this.advance()

    return this.parseArrowBody(params)
  }

  private isObjectTypeAnnotation(lbracePos: number): boolean {
    return false
  }

  private looksLikeBlockStatement(): boolean {
    let i = this.current + 1
    const token = this.tokens[i]
    if (!token) return false
    
    if (token.type === TokenType.RBRACE) return false
    
    if (token.type === TokenType.KEYWORD) {
      const keywords = ['if', 'while', 'for', 'return', 'var', 'val', 'const', 'func', 'break', 'continue']
      if (keywords.includes(token.value as string)) return true
    }
    
    if (token.type === TokenType.IDENTIFIER) {
      i++
      const nextToken = this.tokens[i]
      if (nextToken && nextToken.type === TokenType.LPAREN) return true
      if (nextToken && nextToken.type === TokenType.LBRACE) return true
      if (nextToken && nextToken.type === TokenType.COLON) return false
      if (nextToken && nextToken.type === TokenType.COMMA) return true
      if (nextToken && nextToken.type === TokenType.ASSIGN) return true
    }
    
    if (token.type === TokenType.NUMBER || token.type === TokenType.STRING || 
        token.type === TokenType.BOOLEAN || token.type === TokenType.NULL) {
      i++
      const nextToken = this.tokens[i]
      if (nextToken && nextToken.type === TokenType.SEMICOLON) return true
      if (nextToken && nextToken.type === TokenType.RBRACE) return true
    }
    
    return false
  }

private parseArrowBody(params: { name: Token; isRest?: boolean }[]): Expr {
    if (this.check(TokenType.LBRACE)) {
      if (this.looksLikeBlockStatement()) {
        const body = this.parseBlockStatement()
        return {
          kind: "ArrowFunction",
          params,
          body
        }
      }
      
      const savedPos = this.current
      const savedErrorsLength = this.errors.errors.length
      try {
        const objLiteral = this.parseObjectLiteral()
        return {
          kind: "ArrowFunction",
          params,
          body: objLiteral
        }
      } catch (e) {
        this.current = savedPos
        this.errors.errors = this.errors.errors.slice(0, savedErrorsLength)
        const body = this.parseBlockStatement()
        return {
          kind: "ArrowFunction",
          params,
          body
        }
      }
    } else {
      const body = this.parseExpression(Precedence.LOWEST)
      if (!body) {
        this.error("Expected expression after '=>'", this.peek())
        return { kind: "Literal", value: null }
      }
      return {
        kind: "ArrowFunction",
        params,
        body
      }
    }
  }

private parseAssignment(left: Expr): Expr | null {
    const operator = this.previous()
    const value = this.parseExpression(Precedence.LOWEST)
    if (!value) {
      this.error(`Expected expression after '${operator.value}'`, operator)
      return null
    }
    return { kind: "Assign", name: left, value, operator }
  }

  private parseUnary(): Expr {
    const operator = this.previous()
    const right = this.parseExpression(Precedence.PREFIX)
    if (!right) {
      this.error(`Expected expression after '${operator.value}'`, operator)
      return { kind: "Literal", value: null }
    }
    return { kind: "Unary", operator, right }
  }

  private parsePostfixIncrement(left: Expr): Expr {
    const operator = this.previous()
    return { kind: "Unary", operator, right: left }
  }

  private parsePostfixDecrement(left: Expr): Expr {
    const operator = this.previous()
    return { kind: "Unary", operator, right: left }
  }

  private parseCall(left: Expr): Expr | null {
    const args: Expr[] = []

    if (this.check(TokenType.RPAREN)) {
      this.advance()
      return { kind: "Call", callee: left, args }
    }

    while (!this.isAtEnd()) {
      const arg = this.parseExpression(Precedence.LOWEST)
      if (arg) {
        args.push(arg)
      }

      if (this.check(TokenType.RPAREN)) {
        this.advance()
        break
      }

      if (!this.check(TokenType.COMMA)) {
        break
      }
      this.advance()

      if (this.isAtEnd()) {
        break
      }
    }

    return { kind: "Call", callee: left, args }
  }

  private parseMember(left: Expr): Expr | null {
    const property = this.peek()

    const validPropertyTypes = [
      TokenType.IDENTIFIER,
      TokenType.KEYWORD,
      TokenType.BOOLEAN,
      TokenType.NULL
    ]

    if (!validPropertyTypes.includes(property.type)) {
      this.errors.report("Expected property name after '.'", property)
      return null
    }

    this.advance()
    return {
      kind: "Member",
      object: left,
      property: { kind: "Identifier", name: this.previous() }
    }
  }

  private parseIndex(left: Expr): Expr | null {
    if (!left) {
      this.error("Expected expression before '['", this.peek())
      return null
    }

    const indexExpr = this.parseExpression(Precedence.LOWEST)

    if (!indexExpr) {
      this.error("Expected expression inside brackets", this.peek())
      return null
    }

    if (!this.check(TokenType.RBRACKET)) {
      this.error("Expected ']' after index expression", this.peek())
      return null
    }

    this.advance()
    return { kind: "Index", object: left, index: indexExpr }
  }

  private parseTernary(left: Expr): Expr | null {
    const consequent = this.parseExpression(Precedence.LOWEST)
    if (!consequent) {
      this.error("Expected expression after '?'", this.peek())
      return null
    }

    if (!this.check(TokenType.COLON)) {
      this.error("Expected ':' after '?' expression", this.peek())
      return null
    }
    this.advance()

    const alternate = this.parseExpression(Precedence.CONDITIONAL)
    if (!alternate) {
      this.error("Expected expression after ':'", this.peek())
      return null
    }

    return {
      kind: "Conditional",
      condition: left,
      consequent,
      alternate
    }
  }

  private parseNullish(left: Expr): Expr | null {
    const right = this.parseExpression(Precedence.NULLISH)
    if (!right) {
      this.error("Expected expression after '??'", this.peek())
      return null
    }

    return {
      kind: "NullishCoalescing",
      left,
      right
    }
  }

  private parseBinary(left: Expr): Expr | null {
    const operator = this.previous()
    const precedence = getPrecedence(operator.type)
    const right = this.parseExpression(precedence)
    if (!right) {
      this.error(`Expected expression after '${operator.value}'`, operator)
      return null
    }
    return {
      kind: "Binary",
      left,
      operator,
      right
    }
  }

  public parse(): Stmt[] {
    this.errors.errors = []
    const statements: Stmt[] = []
    while (!this.isAtEnd()) {
      try {
        const stmt = this.parseStatement()
        if (stmt) statements.push(stmt)
      } catch (e: any) {
        this.synchronize()
      }
    }
    return statements
  }

  private parseStatement(): Stmt | null {
    const token = this.peek()

    if (token?.type === TokenType.LBRACE) {
      if (this.looksLikeObjectLiteral()) {
        const expr = this.parseObjectLiteral()
        return { kind: "ExpressionStmt", expression: expr }
      }
      return this.parseBlockStatement()
    }

    if (token?.type === TokenType.LBRACKET) {
      if (this.looksLikeArrayLiteral()) {
        this.advance()
        const expr = this.parseArrayLiteral()
        return { kind: "ExpressionStmt", expression: expr }
      }
    }

    if (token?.type === TokenType.KEYWORD) {
      const keyword = token.value as string
      if (keyword === 'var' || keyword === 'val' || keyword === 'const') {
        return this.parseVariableDeclaration()
      }
      if (keyword === 'if') {
        return this.parseIfStatement()
      }
      if (keyword === 'while') {
        return this.parseWhileStatement()
      }
      if (keyword === 'break') {
        this.advance()
        return { kind: "BreakStmt" }
      }
      if (keyword === 'continue') {
        this.advance()
        return { kind: "ContinueStmt" }
      }
      if (keyword === 'func') {
        return this.parseFunctionStatement()
      }
      if (keyword === 'return') {
        return this.parseReturnStatement()
      }
    }

    const expr = this.parseExpression(Precedence.LOWEST)
    if (!expr) {
       this.advance()
       return null
    }
    return { kind: "ExpressionStmt", expression: expr }
  }

  private looksLikeObjectLiteral(): boolean {
    let i = this.current + 1
    if (this.tokens[i]?.type === TokenType.RBRACE) {
      return true
    }
    if (this.tokens[i]?.type === TokenType.SPREAD) {
      return true
    }
    if (this.tokens[i]?.type === TokenType.IDENTIFIER) {
      i++
      if (this.tokens[i]?.type === TokenType.COLON) {
        return true
      }
      if (this.tokens[i]?.type === TokenType.COMMA) {
        return true
      }
      if (this.tokens[i]?.type === TokenType.RBRACE) {
        return true
      }
    }
    if (this.tokens[i]?.type === TokenType.KEYWORD || 
        this.tokens[i]?.type === TokenType.BOOLEAN ||
        this.tokens[i]?.type === TokenType.NULL) {
      i++
      if (this.tokens[i]?.type === TokenType.COLON) {
        return true
      }
    }
    if (this.tokens[i]?.type === TokenType.STRING) {
      i++
      if (this.tokens[i]?.type === TokenType.COLON) {
        return true
      }
      if (this.tokens[i]?.type === TokenType.COMMA) {
        return true
      }
      if (this.tokens[i]?.type === TokenType.RBRACE) {
        return true
      }
    }
    if (this.tokens[i]?.type === TokenType.RBRACE) {
      return true
    }
    return false
  }

  private looksLikeArrayLiteral(): boolean {
    let i = this.current + 1
    if (this.tokens[i]?.type === TokenType.RBRACKET) {
      return true
    }
    if (this.tokens[i]?.type === TokenType.SPREAD) {
      return true
    }
    if (this.tokens[i]?.type === TokenType.NUMBER ||
        this.tokens[i]?.type === TokenType.STRING ||
        this.tokens[i]?.type === TokenType.BOOLEAN ||
        this.tokens[i]?.type === TokenType.NULL ||
        this.tokens[i]?.type === TokenType.LBRACKET ||
        this.tokens[i]?.type === TokenType.LBRACE ||
        this.tokens[i]?.type === TokenType.IDENTIFIER ||
        this.tokens[i]?.type === TokenType.MINUS ||
        this.tokens[i]?.type === TokenType.PLUS ||
        this.tokens[i]?.type === TokenType.NOT ||
        this.tokens[i]?.type === TokenType.LPAREN) {
      return true
    }
    return false
  }

  private parseBlockStatement(): Stmt {
    const lbrace = this.previous()
    this.advance()
    const statements: Stmt[] = []

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const stmt = this.parseStatement()
      if (stmt) statements.push(stmt)
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance()
    } else {
      this.error("Expected '}' to close block", lbrace)
    }

    return { kind: "BlockStmt", statements }
  }

  private parseVariableDeclaration(): Stmt | null {
    const keywordToken = this.advance()
    const keyword = keywordToken.value as string
    
    const nameToken = this.advance()
    if (nameToken.type !== TokenType.IDENTIFIER) {
      this.error(`Expected variable name after '${keyword}'`, nameToken)
      this.advance()
      return null
    }
    
    // Parse type annotation (ex: : string)
    const typeAnnotation = this.parseTypeAnnotation()
    if (typeAnnotation) {
      console.log('[TypeDebug] Variable type annotation:', JSON.stringify(typeAnnotation))
    }
    
    let initializer: Expr | undefined
    if (this.peek().type === TokenType.ASSIGN) {
      this.advance()
      initializer = this.parseExpression(Precedence.LOWEST)
    }
    
    return {
      kind: "VariableStmt",
      declarationType: keyword as "var" | "val" | "const",
      name: nameToken,
      type: typeAnnotation,
      initializer
    }
  }

  private parseIfStatement(): Stmt {
    this.advance()

    if (this.peek().type !== TokenType.LPAREN) {
      this.error("Expected '(' after 'if'", this.peek())
      this.synchronize()
      return { kind: "BlockStmt", statements: [] }
    }
    this.advance()
    const condition = this.parseExpression(Precedence.LOWEST)
    if (this.check(TokenType.RPAREN)) {
      this.advance()
    } else {
      this.error("Expected ')' after condition", this.peek())
      this.synchronize()
      return { kind: "BlockStmt", statements: [] }
    }

    let thenBranch: Stmt
    if (this.peek().type === TokenType.LBRACE) {
      thenBranch = this.parseBlockStatement()
    } else {
      thenBranch = this.parseStatement() || { kind: "BlockStmt", statements: [] }
    }

    let elseBranch: Stmt | undefined
    if (this.peek().type === TokenType.KEYWORD && this.peek().value === 'else') {
      this.advance()

      if (this.peek().type === TokenType.KEYWORD && this.peek().value === 'if') {
        elseBranch = this.parseIfStatement()
      } else if (this.peek().type === TokenType.LBRACE) {
        elseBranch = this.parseBlockStatement()
      } else {
        elseBranch = this.parseStatement() || { kind: "BlockStmt", statements: [] }
      }
    }

    return {
      kind: "IfStmt",
      condition,
      thenBranch,
      elseBranch
    }
  }

  private parseWhileStatement(): Stmt {
    this.advance()

    if (this.peek().type !== TokenType.LPAREN) {
      this.error("Expected '(' after 'while'", this.peek())
      this.synchronize()
      return { kind: "BlockStmt", statements: [] }
    }
    this.advance()
    const condition = this.parseExpression(Precedence.LOWEST)
    if (this.check(TokenType.RPAREN)) {
      this.advance()
    } else {
      this.error("Expected ')' after condition", this.peek())
      this.synchronize()
      return { kind: "BlockStmt", statements: [] }
    }

    let body: Stmt
    if (this.peek().type === TokenType.LBRACE) {
      body = this.parseBlockStatement()
    } else {
      body = this.parseStatement() || { kind: "BlockStmt", statements: [] }
    }

    return {
      kind: "WhileStmt",
      condition,
      body
    }
  }

  private parseFunctionStatement(): Stmt {
    this.advance()

    const nameToken = this.advance()
    if (nameToken.type !== TokenType.IDENTIFIER) {
      this.error("Expected function name after 'func'", nameToken)
      return { kind: "ExpressionStmt", expression: { kind: "Literal", value: null } }
    }

    if (!this.check(TokenType.LPAREN)) {
      this.error("Expected '(' after function name", this.peek())
    }
    this.advance()

    const params: { name: Token; isRest?: boolean }[] = []
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      let isRest = false
      if (this.check(TokenType.SPREAD)) {
        this.advance()
        isRest = true
      }

      const paramName = this.advance()
      if (paramName.type !== TokenType.IDENTIFIER) {
        this.error("Expected parameter name", paramName)
        break
      }

      params.push({ name: paramName, isRest })

      if (this.check(TokenType.COMMA)) {
        this.advance()
      }
    }

    if (this.check(TokenType.RPAREN)) {
      this.advance()
    } else {
      this.error("Expected ')' after parameters", this.peek())
    }

    let body: any
    if (this.check(TokenType.LBRACE)) {
      body = this.parseBlockStatement()
    } else {
      this.error("Expected '{' before function body", this.peek())
      body = { kind: "BlockStmt", statements: [] }
    }

    return {
      kind: "FunctionStmt",
      name: nameToken,
      params,
      body
    }
  }

  private parseReturnStatement(): Stmt {
    const keyword = this.advance()

    if (this.check(TokenType.RBRACE) || this.isAtEnd()) {
      return { kind: "ReturnStmt" }
    }

    const value = this.parseExpression(Precedence.LOWEST)
    if (!value) {
      return { kind: "ReturnStmt" }
    }

    return {
      kind: "ReturnStmt",
      value
    }
  }

  public parseExpression(precedence: Precedence): Expr | null {
    if (this.isAtEnd()) return null

    let token = this.advance()
    let prefix = this.prefixParselets.get(token.type)

    if (!prefix) {
      this.error(`Unexpected token '${token.value ?? token.type}', expected expression.`, token)
      throw new Error('ParseError') 
    }

    let left = prefix()
    if (!left) return null

    while (!this.isAtEnd() && precedence < getPrecedence(this.peek().type)) {
      if (this.peek().type === TokenType.LBRACKET && left) {
        const isLiteralLeft = left.kind === 'Array' || left.kind === 'Object' || left.kind === 'Literal'
        if (isLiteralLeft && this.looksLikeArrayLiteral()) {
          return left
        }
      }

      const infix = this.infixParselets.get(this.peek().type)
      if (!infix) {
        return left
      }
      this.advance()
      left = infix(left)
      if (!left) break
    }

    return left
  }

  public peek(): Token {
    return this.tokens[this.current]
  }

  public peekNext(): Token | undefined {
    return this.tokens[this.current + 1]
  }

  public previous(): Token {
    return this.tokens[this.current - 1]
  }

  public isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF
  }

  public advance(): Token {
    if (!this.isAtEnd()) this.current++
    return this.previous()
  }

  public check(type: TokenType): boolean {
    if (this.isAtEnd()) return false
    return this.peek().type === type
  }

  public match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance()
        return true
      }
    }
    return false
  }

  public consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()
    this.error(message, this.peek())
    throw new Error('ParseError')
  }

  public error(message: string, token: Token) {
    this.errors.report(message, token)
  }

  public synchronize() {
    while (!this.isAtEnd()) {
      const currentType = this.peek()?.type

      if (currentType === TokenType.SEMICOLON) {
        this.advance()
        return
      }

      if (currentType === TokenType.KEYWORD) {
        const val = this.peek().value
        if (['func', 'val', 'const', 'var', 'if', 'for', 'while', 'return', 'class'].includes(val as string)) {
          return
        }
      }

      if ([TokenType.IDENTIFIER, TokenType.NUMBER, TokenType.STRING, TokenType.BOOLEAN, TokenType.NULL, TokenType.LPAREN, TokenType.LBRACE].includes(currentType)) {
        return
      }

      this.advance()
    }
  }

  // ========================================
  // Type Annotation Parser
  // ========================================

  private parseTypeAnnotation(): TypeNode | undefined {
    if (!this.check(TokenType.COLON)) {
      return undefined
    }

    const colonToken = this.previous()
    this.advance()

    // Verificar se após o ":" existe um tipo válido
    const nextToken = this.peek()
    const isValidTypeStart =
      this.check(TokenType.INT_TYPE) ||
      this.check(TokenType.FLOAT_TYPE) ||
      this.check(TokenType.STRING_TYPE) ||
      this.check(TokenType.BOOLEAN_TYPE) ||
      this.check(TokenType.ANY_TYPE) ||
      this.check(TokenType.VOID_TYPE) ||
      this.check(TokenType.UNKNOWN_TYPE) ||
      this.check(TokenType.UNDEFINED_TYPE) ||
      this.check(TokenType.NULL_TYPE) ||
      this.check(TokenType.NULL) ||  // 'null' literal também é tipo
      this.check(TokenType.OBJECT_TYPE) ||
      this.check(TokenType.IDENTIFIER) ||
      this.check(TokenType.LPAREN) ||
      this.check(TokenType.LBRACE) ||
      this.check(TokenType.LBRACKET)

    if (!isValidTypeStart) {
      this.error(`Expected type after ':'`, nextToken)
      return undefined
    }

    return this.parseType()
  }

  private parseType(): TypeNode {
    return this.parseTypeChain()
  }

  private parseTypeChain(): TypeNode {
    let type = this.parseSingleType()
    if (!type) {
      this.error(`Expected type, got '${this.peek().value}'`, this.peek())
      return { kind: "AnyType" }
    }

    // Parse union and intersection with left-to-right
    // Use a flat list approach for cleaner handling
    const types: TypeNode[] = [type]
    const ops: string[] = []

    while (this.check(TokenType.PIPE) || this.check(TokenType.AMPERSAND)) {
      ops.push(this.check(TokenType.PIPE) ? '|' : '&')
      this.advance()

      const next = this.parseSingleType()
      if (!next) {
        this.error(`Expected type after '${ops[ops.length - 1]}'`, this.peek())
        break
      }
      types.push(next)
    }

    if (types.length === 1) {
      console.log(`[TypeDebug] SingleType: ${type.kind}`)
      return type
    }

    // Group by operator precedence: union (|) binds looser, intersection (&) binds tighter
    // So we group intersections first, then unions on top
    // This gives: A | B & C | D  =  (A) | ((B & C) | D)  =  (A) | (B & C | D)
    // Actually: A | B & C = A | (B & C) - intersection should be grouped first
    const grouped = this.groupTypeOps(types, ops)

    if (grouped.kind === 'UnionType') {
      console.log(`[TypeDebug] UnionType with ${grouped.types.length} types`)
    } else if (grouped.kind === 'IntersectionType') {
      console.log(`[TypeDebug] IntersectionType with ${grouped.types.length} types`)
    }

    return grouped
  }

private groupTypeOps(types: TypeNode[], ops: string[]): TypeNode {
    if (types.length === 1) return types[0]

    // Simple case: just check if all operators are the same
    const allUnion = ops.every(op => op === '|')
    const allIntersection = ops.every(op => op === '&')

    if (allUnion) {
      return { kind: "UnionType", types }
    }

    if (allIntersection) {
      return { kind: "IntersectionType", types }
    }

    // Mixed operators: union has lower precedence than intersection
    // So group intersections first
    const result: TypeNode[] = []
    let current: TypeNode[] = [types[0]]

    for (let i = 0; i < ops.length; i++) {
      if (ops[i] === '&') {
        // Keep adding to intersection
        current.push(types[i + 1])
      } else {
        // '|' - end current group
        if (current.length === 1) {
          result.push(current[0])
        } else {
          result.push({ kind: "IntersectionType", types: current })
        }
        current = [types[i + 1]]
      }
    }

    // Handle remaining
    if (current.length === 1) {
      result.push(current[0])
    } else {
      result.push({ kind: "IntersectionType", types: current })
    }

    if (result.length === 1) {
      return result[0]
    }

    return { kind: "UnionType", types: result }
  }

  // ========================================
  // Array Type Parser (degrees)
  // ========================================
  private parseArrayType(baseType: TypeNode): TypeNode {
    let degrees = 0

    while (this.check(TokenType.LBRACKET)) {
      this.advance()
      
      if (!this.check(TokenType.RBRACKET)) {
        this.error("Expected ']' in array type", this.peek())
        break
      }
      this.advance()
      
      degrees++
    }

    if (degrees > 0) {
      console.log(`[TypeDebug] ArrayType with degrees: ${degrees}`)
      return {
        kind: "ArrayType",
        elementType: baseType,
        degrees
      }
    }

    return baseType
  }

// ========================================
  private parseUnionType(firstType: TypeNode): TypeNode {
    const types: TypeNode[] = [firstType]

    while (this.check(TokenType.PIPE)) {
      this.advance()
      const nextType = this.parseSingleType()
      if (!nextType) {
        this.error("Expected type after '|'", this.peek())
        break
      }
      types.push(nextType)
    }

    if (types.length === 1) {
      return firstType
    }

    console.log(`[TypeDebug] UnionType with ${types.length} types`)
    return { kind: "UnionType", types }
  }

  // Parse a single type (without union)
  private parseSingleType(): TypeNode | null {
    const baseType = this.parseBaseType()
    if (!baseType) return null

    // Handle object literal types { name: type, age: int }
    if (this.check(TokenType.LBRACE)) {
      return this.parseObjectLiteralType()
    }

    return this.parseArrayType(baseType)
  }

  private parseObjectLiteralType(): TypeNode {
    this.advance() // consume {

    const members: { name: string; type: TypeNode; isOptional?: boolean; isReadonly?: boolean }[] = []

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {

      // 1. Modificador readonly
      let isReadonly = false
      if (this.check(TokenType.READONLY)) {
        isReadonly = true
        this.advance()
      }

      // 2. Nome da propriedade (identifier ou string)
      let name: string
      if (this.check(TokenType.IDENTIFIER)) {
        name = this.advance().value as string
      } else if (this.check(TokenType.STRING)) {
        name = this.advance().value as string
      } else {
        this.error("Expected property name", this.peek())
        break
      }

      // 3. Opcional (?) - verificar APÓS o nome
      let isOptional = false
      if (this.check(TokenType.QUESTION)) {
        isOptional = true
        this.advance()
      }

      // 4. Dois pontos obrigatório
      if (!this.check(TokenType.COLON)) {
        this.error("Expected ':' after property name", this.peek())
        break
      }
      this.advance()

      // 5. Tipo da propriedade (recursivo)
      const type = this.parseType()

      members.push({ name, type, isOptional, isReadonly })

      // 6. Separador: ; ou ,
      if (this.check(TokenType.SEMICOLON) || this.check(TokenType.COMMA)) {
        this.advance()
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}' to close object type")

    console.log(`[TypeDebug] ObjectLiteralType with ${members.length} members`)
    return { kind: "ObjectLiteralType", members }
  }

  // Parse a base type (the raw type without arrays)
  private parseBaseType(): TypeNode | null {
    const token = this.peek()

    // Handle object literal types { name: type, age: int }
    if (this.check(TokenType.LBRACE)) {
      return this.parseObjectLiteralType()
    }

    if (this.check(TokenType.INT_TYPE)) {
      this.advance()
      return { kind: "IntType" }
    }

    if (this.check(TokenType.FLOAT_TYPE)) {
      this.advance()
      return { kind: "FloatType" }
    }

    if (this.check(TokenType.STRING_TYPE)) {
      this.advance()
      return { kind: "StringType" }
    }

    if (this.check(TokenType.BOOLEAN_TYPE)) {
      this.advance()
      return { kind: "BoolType" }
    }

    if (this.check(TokenType.ANY_TYPE)) {
      this.advance()
      return { kind: "AnyType" }
    }

    if (this.check(TokenType.VOID_TYPE)) {
      this.advance()
      return { kind: "VoidType" }
    }

    if (this.check(TokenType.UNKNOWN_TYPE)) {
      this.advance()
      return { kind: "UnknownType" }
    }

    if (this.check(TokenType.UNDEFINED_TYPE)) {
      this.advance()
      return { kind: "UndefinedType" }
    }

    if (this.check(TokenType.NULL_TYPE) || this.check(TokenType.NULL)) {
      this.advance()
      return { kind: "NullType" }
    }

    if (this.check(TokenType.OBJECT_TYPE)) {
      this.advance()
      return { kind: "ObjectType" }
    }

    if (this.check(TokenType.IDENTIFIER)) {
      const typeName = this.advance()

      let typeArguments: TypeNode[] | undefined
      if (this.check(TokenType.LESS_THAN)) {
        this.advance()
        typeArguments = []
        while (!this.check(TokenType.GREATER_THAN) && !this.isAtEnd()) {
          typeArguments.push(this.parseType())
          if (this.check(TokenType.COMMA)) this.advance()
        }
        this.consume(TokenType.GREATER_THAN, "Expected '>' after type arguments")
      }

      return { kind: "TypeReference", typeName, typeArguments }
    }

    this.error(`Expected type, got '${token.value}'`, token)
    return null
  }
}
