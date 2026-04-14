import { Token, TokenType } from '../lexer/types'
import { ErrorHandler } from './error'
import { Expr, Stmt } from '../ast'
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
    // Literals
    this.prefixParselets.set(TokenType.IDENTIFIER, this.parseIdentifier.bind(this))
    this.prefixParselets.set(TokenType.NUMBER, this.parseNumber.bind(this))
    this.prefixParselets.set(TokenType.STRING, this.parseString.bind(this))
    this.prefixParselets.set(TokenType.BOOLEAN, this.parseBoolean.bind(this))
    this.prefixParselets.set(TokenType.NULL, this.parseNull.bind(this))
    this.prefixParselets.set(TokenType.LPAREN, this.parseGroup.bind(this))

    // Unary operators
    this.prefixParselets.set(TokenType.MINUS, this.parseUnary.bind(this))
    this.prefixParselets.set(TokenType.PLUS, this.parseUnary.bind(this))
    this.prefixParselets.set(TokenType.NOT, this.parseUnary.bind(this))

    // Arrow functions (x => x + 1)
    this.prefixParselets.set(TokenType.LPAREN, this.parseArrowOrGroup.bind(this))

    // Array literal [1, 2, 3]
    this.prefixParselets.set(TokenType.LBRACKET, this.parseArrayLiteral.bind(this))

    // Spread operator ...
    this.prefixParselets.set(TokenType.SPREAD, this.parseSpread.bind(this))

    // Assignment operators (= and compound: +=, -=, *=, /=, %=)
    this.infixParselets.set(TokenType.ASSIGN, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.PLUS_EQUAL, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.MINUS_EQUAL, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.STAR_EQUAL, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.SLASH_EQUAL, this.parseAssignment.bind(this))
    this.infixParselets.set(TokenType.MODULO_EQUAL, this.parseAssignment.bind(this))

    // Arithmetic operators
    this.infixParselets.set(TokenType.PLUS, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.MINUS, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.STAR, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.SLASH, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.MODULO, this.parseBinary.bind(this))

    // Comparison operators
    this.infixParselets.set(TokenType.EQUAL, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.NOT_EQUAL, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.LESS_THAN, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.GREATER_THAN, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.LESS_EQUAL, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.GREATER_EQUAL, this.parseBinary.bind(this))

    // Logical operators
    this.infixParselets.set(TokenType.AND, this.parseBinary.bind(this))
    this.infixParselets.set(TokenType.OR, this.parseBinary.bind(this))

    // Ternary operator (?:)
    this.infixParselets.set(TokenType.QUESTION, this.parseTernary.bind(this))

    // Nullish coalescing (??)
    this.infixParselets.set(TokenType.QUESTION_QUESTION, this.parseNullish.bind(this))

    // Function call
    this.infixParselets.set(TokenType.LPAREN, this.parseCall.bind(this))

    // Member access (.)
    this.infixParselets.set(TokenType.DOT, this.parseMember.bind(this))

    // Index access ([])
    this.infixParselets.set(TokenType.LBRACKET, this.parseIndex.bind(this))

    // Object literal { key: value }
    this.prefixParselets.set(TokenType.LBRACE, this.parseObjectLiteral.bind(this))

    // Postfix increment/decrement
    this.infixParselets.set(TokenType.INCREMENT, this.parsePostfixIncrement.bind(this))
    this.infixParselets.set(TokenType.DECREMENT, this.parsePostfixDecrement.bind(this))
  }

  // --- LITERAL PARSELETS ---

  private parseIdentifier(): Expr {
    const name = this.previous()

    // Check for arrow function: x => expr (without parentheses)
    if (this.check(TokenType.ARROW)) {
      this.advance() // consume =>
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
      // Report error at the lparen position since we lost track of the closing paren
      this.error(`Expected ')' to close group starting at line ${lparen.line}`, lparen)
    }
    return { kind: "Group", expression: expr }
  }

  private parseArrayLiteral(): Expr {
    const bracket = this.previous().type === TokenType.LBRACKET 
      ? this.previous() 
      : this.peek()
    
    if (this.previous().type !== TokenType.LBRACKET) {
      this.advance() // consume [
    }

    const elements: Expr[] = []

    if (this.check(TokenType.RBRACKET)) {
      this.advance()
      return { kind: "Array", elements }
    }

    while (!this.isAtEnd()) {
      // Check for end of array BEFORE parsing expression
      if (this.check(TokenType.RBRACKET)) break

      if (this.check(TokenType.SPREAD)) {
        this.advance()
        const arg = this.parseExpression(Precedence.LOWEST)
        if (arg) elements.push({ kind: "Spread", argument: arg })
      } else {
        const elem = this.parseExpression(Precedence.LOWEST)
        if (elem) elements.push(elem)
      }

      // After parsing element, check if we're done
      if (this.check(TokenType.RBRACKET)) break

      // Must have comma to continue
      if (!this.check(TokenType.COMMA)) {
        this.error("Expected ',' or ']' in array literal", this.peek())
        break
      }
      this.advance()
    }

    if (this.check(TokenType.RBRACKET)) {
      this.advance()
    } else {
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

      // Check for spread operator first
      if (this.check(TokenType.SPREAD)) {
        this.advance()
        const spreadArg = this.parseExpression(Precedence.LOWEST)
        if (spreadArg) {
          properties.push({ key: null, value: { kind: "Spread", argument: spreadArg } })
        }
      } else if (this.check(TokenType.IDENTIFIER) || 
          this.check(TokenType.KEYWORD) || 
          this.check(TokenType.BOOLEAN) ||
          this.check(TokenType.TYPE_INT) ||
          this.check(TokenType.TYPE_FLOAT) ||
          this.check(TokenType.TYPE_BOOL) ||
          this.check(TokenType.TYPE_STRING) ||
          this.check(TokenType.TYPE_VOID) ||
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
    // Save position to backtrack if needed
    const startPos = this.current

    // Try to parse as arrow function first
    const arrow = this.tryParseArrowFunction()
    if (arrow) {
      return arrow
    }

    // Not an arrow function, backtrack and parse as group
    this.current = startPos
    return this.parseGroup()
  }

  private tryParseArrowFunction(): Expr | null {
    // We're after consuming '(', so check for params
    const params: { name: Token; type?: { base: Token; dimensions: number } }[] = []

    // Empty params: () => expr or (): int[] => expr
    if (this.check(TokenType.RPAREN)) {
      this.advance() // consume )
      
      // Optional return type annotation: ): int[] =>
      let returnType: { base: Token; dimensions: number } | undefined
      if (this.check(TokenType.COLON)) {
        this.advance() // consume :
        returnType = this.parseTypeAnnotation()
      }
      
      if (!this.check(TokenType.ARROW)) {
        return null // Not an arrow function
      }
      this.advance() // consume =>
      return this.parseArrowBodyWithReturnType(params, returnType)
    }

    // Parse parameters
    while (!this.isAtEnd() && !this.check(TokenType.RPAREN)) {
      // Check for rest operator
      let isRest = false
      if (this.check(TokenType.SPREAD)) {
        this.advance() // consume ...
        isRest = true
      }

      // Must be identifier
      if (this.peek().type !== TokenType.IDENTIFIER) {
        return null
      }

      const paramName = this.advance() // consume identifier

      // Optional type annotation
      let paramType: { base: Token; dimensions: number } | undefined
      if (this.check(TokenType.COLON)) {
        this.advance() // consume :
        paramType = this.parseTypeAnnotation()
      }

      params.push({ name: paramName, type: paramType, isRest })

      // Comma or end
      if (this.check(TokenType.COMMA)) {
        this.advance() // consume ,
      }
    }

    // Expect )
    if (!this.check(TokenType.RPAREN)) {
      return null
    }
    this.advance() // consume )

    // Optional return type annotation: x): int[] =>
    let returnType: { base: Token; dimensions: number } | undefined
    if (this.check(TokenType.COLON)) {
      this.advance() // consume :
      returnType = this.parseTypeAnnotation()
    }

    // Expect =>
    if (!this.check(TokenType.ARROW)) {
      return null
    }
    this.advance() // consume =>

    return this.parseArrowBodyWithReturnType(params, returnType)
  }

  private parseArrowBody(params: { name: Token; type?: { base: Token; dimensions: number }; isRest?: boolean }[]): Expr {
    // Arrow body can be expression or block
    if (this.check(TokenType.LBRACE)) {
      // Block body: () => { return x }
      const body = this.parseBlockStatement()
      return {
        kind: "ArrowFunction",
        params,
        body
      }
    } else {
      // Expression body: () => x + 1
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

  private parseArrowBodyWithReturnType(params: { name: Token; type?: { base: Token; dimensions: number }; isRest?: boolean }[], returnType: { base: Token; dimensions: number } | undefined): Expr {
    // Arrow body can be expression or block
    if (this.check(TokenType.LBRACE)) {
      // Block body: () => { return x }
      const body = this.parseBlockStatement()
      return {
        kind: "ArrowFunction",
        params,
        returnType,
        body
      }
    } else {
      // Expression body: () => x + 1
      const body = this.parseExpression(Precedence.LOWEST)
      if (!body) {
        this.error("Expected expression after '=>'", this.peek())
        return { kind: "Literal", value: null }
      }
      return {
        kind: "ArrowFunction",
        params,
        returnType,
        body
      }
    }
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

  private isAtExpressionStart(): boolean {
    if (this.current === 0) return true
    const prev = this.tokens[this.current - 1]
    const startTypes = [
      TokenType.LPAREN, TokenType.LBRACE, TokenType.LBRACKET,
      TokenType.COMMA, TokenType.ASSIGN, TokenType.COLON,
      TokenType.AND, TokenType.OR, TokenType.EQUAL, TokenType.NOT_EQUAL,
      TokenType.LESS_THAN, TokenType.GREATER_THAN, TokenType.LESS_EQUAL,
      TokenType.GREATER_EQUAL, TokenType.PLUS, TokenType.MINUS,
      TokenType.STAR, TokenType.SLASH, TokenType.MODULO
    ]
    return startTypes.includes(prev.type)
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

  private parseCall(left: Expr): Expr | null {
    const args: Expr[] = []

    // Check for empty call like fn() or fn()
    if (this.check(TokenType.RPAREN)) {
      this.advance() // consume )
      return { kind: "Call", callee: left, args }
    }

    // Parse arguments
    while (!this.isAtEnd()) {
      const arg = this.parseExpression(Precedence.LOWEST)
      if (arg) {
        args.push(arg)
      }

      if (this.check(TokenType.RPAREN)) {
        this.advance() // consume )
        break
      }

      if (!this.check(TokenType.COMMA)) {
        break
      }
      this.advance() // consume comma

      if (this.isAtEnd()) {
        break
      }
    }

    return { kind: "Call", callee: left, args }
  }

  private parseMember(left: Expr): Expr | null {
    // Note: advance() was already called by parseExpression before calling this parselet
    // DOT has already been consumed, current now points to property token

    const property = this.peek()

    if (property.type !== TokenType.IDENTIFIER) {
      this.errors.report("Expected property name after '.'", property)
      return null
    }

    this.advance() // consume property identifier
    return {
      kind: "Member",
      object: left,
      property: { kind: "Identifier", name: this.previous() }
    }
  }

  private parseIndex(left: Expr): Expr | null {
    const indexExpr = this.parseExpression(Precedence.LOWEST)

    if (!indexExpr) {
      this.error("Expected expression inside brackets", this.peek())
      return null
    }

    if (!this.check(TokenType.RBRACKET)) {
      this.error("Expected ']' after index expression", this.peek())
      return null
    }

    this.advance() // consume RBRACKET
    return { kind: "Index", object: left, index: indexExpr }
  }

  private parseTernary(left: Expr): Expr | null {
    // current is now the '?' token (already consumed)
    const consequent = this.parseExpression(Precedence.LOWEST)
    if (!consequent) {
      this.error("Expected expression after '?'", this.peek())
      return null
    }

    // Expect ':'
    if (!this.check(TokenType.COLON)) {
      this.error("Expected ':' after '?' expression", this.peek())
      return null
    }
    this.advance() // consume ':'

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
    // current is now the '??' token (already consumed)
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
    const statements: Stmt[] = []
    while (!this.isAtEnd()) {
      try {
        const stmt = this.parseStatement()
        if (stmt) statements.push(stmt)
      } catch (e) {
        // On error, skip to next token and continue parsing
        this.advance()
      }
    }
    return statements
  }

  private parseStatement(): Stmt | null {
    const token = this.peek()

    // Block statement or Object literal: {
    if (token?.type === TokenType.LBRACE) {
      if (this.looksLikeObjectLiteral()) {
        const expr = this.parseObjectLiteral()
        return { kind: "ExpressionStmt", expression: expr }
      }
      return this.parseBlockStatement()
    }

    // Array literal: [
    if (token?.type === TokenType.LBRACKET) {
      if (this.looksLikeArrayLiteral()) {
        this.advance() // consume [
        const expr = this.parseArrayLiteral()
        return { kind: "ExpressionStmt", expression: expr }
      }
    }

    // Variable declarations: var, val, const
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

    // For now everything acts as an expression statement until we implement `func`, `val`, etc.
    const expr = this.parseExpression(Precedence.LOWEST)
    if (!expr) {
       // if completely invalid token, consume it so we don't infinite loop when testing initially
       this.advance()
       return null
    }
    // We will consume semi-colons here eventually, but now just pass through
    return { kind: "ExpressionStmt", expression: expr }
  }

  private looksLikeObjectLiteral(): boolean {
    let i = this.current + 1
    if (this.tokens[i]?.type === TokenType.RBRACE) {
      return true
    }
    // Check for spread operator as start of object: {...a}
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
    // Also support KEYWORD (like 'val', 'if', etc.) and TYPE_* as keys
    if (this.tokens[i]?.type === TokenType.KEYWORD || 
        this.tokens[i]?.type === TokenType.TYPE_INT ||
        this.tokens[i]?.type === TokenType.TYPE_FLOAT ||
        this.tokens[i]?.type === TokenType.TYPE_BOOL ||
        this.tokens[i]?.type === TokenType.TYPE_STRING ||
        this.tokens[i]?.type === TokenType.TYPE_VOID ||
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
    this.advance() // consume {
    const statements: Stmt[] = []

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const stmt = this.parseStatement()
      if (stmt) statements.push(stmt)
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance() // consume }
    } else {
      this.error("Expected '}' to close block", this.peek())
    }

    return { kind: "BlockStmt", statements }
  }

  private parseVariableDeclaration(): Stmt | null {
    const keywordToken = this.advance() // consume var/val/const
    const keyword = keywordToken.value as string
    
    // Parse variable name
    const nameToken = this.advance()
    if (nameToken.type !== TokenType.IDENTIFIER) {
      this.error(`Expected variable name after '${keyword}'`, nameToken)
      this.advance()
      return null
    }
    
    // Check for type annotation
    let typeAnnotation: { base: Token; dimensions: number } | undefined
    if (this.peek().type === TokenType.COLON) {
      this.advance() // consume colon
      typeAnnotation = this.parseTypeAnnotation()
    } else if (keyword === 'val') {
      this.error(`Type annotation is required for 'val' declarations`, nameToken)
    }
    
    // Check for initializer
    let initializer: Expr | undefined
    if (this.peek().type === TokenType.ASSIGN) {
      this.advance() // consume =
      initializer = this.parseExpression(Precedence.LOWEST)
    }
    
    return {
      kind: "VariableStmt",
      declarationType: keyword as "var" | "val" | "const",
      name: nameToken,
      typeAnnotation,
      initializer
    }
  }

  private parseTypeAnnotation(): any {
    let objectType: any = null

    // Check for object type annotation: { name: string, age: int }
    if (this.check(TokenType.LBRACE)) {
      objectType = this.parseObjectTypeAnnotation()
    } else {
      const baseType = this.advance()
      const validTypes = [
        TokenType.IDENTIFIER,
        TokenType.KEYWORD,
        TokenType.TYPE_INT,
        TokenType.TYPE_FLOAT,
        TokenType.TYPE_BOOL,
        TokenType.TYPE_STRING,
        TokenType.TYPE_VOID
      ]
      if (!validTypes.includes(baseType.type)) {
        this.error(`Expected type after ':'`, baseType)
        return undefined
      }

      // Parse dimensions: int[][] etc
      let dimensions = 0
      while (this.check(TokenType.LBRACKET)) {
        this.advance()
        if (!this.check(TokenType.RBRACKET)) {
          this.error("Expected ']' after '[' in type annotation", this.peek())
          break
        }
        this.advance()
        dimensions++
      }

      return { base: baseType, dimensions }
    }

    // Handle array of objects: {name: string}[]
    let dimsFromArray = 0
    while (this.check(TokenType.LBRACKET)) {
      this.advance()
      if (!this.check(TokenType.RBRACKET)) {
        this.error("Expected ']' after '[' in type annotation", this.peek())
        break
      }
      this.advance()
      dimsFromArray++
    }

    if (dimsFromArray > 0) {
      objectType.dimensions = dimsFromArray
    }

    return objectType
  }

  private parseObjectTypeAnnotation(): any {
    this.advance() // consume {
    const fields: any[] = []

    if (this.check(TokenType.RBRACE)) {
      this.advance()
      return { kind: "ObjectType", fields }
    }

    while (!this.isAtEnd() && !this.check(TokenType.RBRACE)) {
      // Field name: identifier or keyword
      const validNameTokens = [
        TokenType.IDENTIFIER,
        TokenType.KEYWORD,
        TokenType.TYPE_INT,
        TokenType.TYPE_FLOAT,
        TokenType.TYPE_BOOL,
        TokenType.TYPE_STRING,
        TokenType.TYPE_VOID,
        TokenType.BOOLEAN,
        TokenType.NULL
      ]

      if (!validNameTokens.includes(this.peek().type)) {
        this.error("Expected field name in type annotation", this.peek())
        break
      }

      const fieldName = this.advance()

      // Expect colon
      if (!this.check(TokenType.COLON)) {
        this.error("Expected ':' after field name", this.peek())
        break
      }
      this.advance() // consume :

      // Parse field type (recursive for nested types)
      const fieldType = this.parseTypeAnnotation()

      fields.push({
        name: fieldName.value,
        type: fieldType
      })

      // Check for comma or end
      if (this.check(TokenType.RBRACE)) break

      if (!this.check(TokenType.COMMA)) {
        this.error("Expected ',' or '}' in type annotation", this.peek())
        break
      }
      this.advance() // consume comma
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance()
    } else {
      this.error("Expected '}' to close type annotation", this.peek())
    }

    return { kind: "ObjectType", fields }
  }

  private parseIfStatement(): Stmt {
    this.advance() // consume if

    // Parse condition: if (condition)
    if (this.peek().type !== TokenType.LPAREN) {
      this.error("Expected '(' after 'if'", this.peek())
    }
    this.advance() // consume (
    const condition = this.parseExpression(Precedence.LOWEST)
    if (this.check(TokenType.RPAREN)) {
      this.advance() // consume )
    } else {
      this.error("Expected ')' after condition", this.peek())
    }

    // Parse then branch
    let thenBranch: Stmt
    if (this.peek().type === TokenType.LBRACE) {
      thenBranch = this.parseBlockStatement()
    } else {
      thenBranch = this.parseStatement() || { kind: "ExpressionStmt", expression: { kind: "Literal", value: null } }
    }

    // Check for else
    let elseBranch: Stmt | undefined
    if (this.peek().type === TokenType.KEYWORD && this.peek().value === 'else') {
      this.advance() // consume else

      if (this.peek().type === TokenType.KEYWORD && this.peek().value === 'if') {
        // else if - recursive
        elseBranch = this.parseIfStatement()
      } else if (this.peek().type === TokenType.LBRACE) {
        elseBranch = this.parseBlockStatement()
      } else {
        elseBranch = this.parseStatement() || { kind: "ExpressionStmt", expression: { kind: "Literal", value: null } }
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
    this.advance() // consume while

    // Parse condition: while (condition)
    if (this.peek().type !== TokenType.LPAREN) {
      this.error("Expected '(' after 'while'", this.peek())
    }
    this.advance() // consume (
    const condition = this.parseExpression(Precedence.LOWEST)
    if (this.check(TokenType.RPAREN)) {
      this.advance() // consume )
    } else {
      this.error("Expected ')' after condition", this.peek())
    }

    // Parse body
    let body: Stmt
    if (this.peek().type === TokenType.LBRACE) {
      body = this.parseBlockStatement()
    } else {
      body = this.parseStatement() || { kind: "ExpressionStmt", expression: { kind: "Literal", value: null } }
    }

    return {
      kind: "WhileStmt",
      condition,
      body
    }
  }

  private parseFunctionStatement(): Stmt {
    this.advance() // consume 'func'

    // Parse function name
    const nameToken = this.advance()
    if (nameToken.type !== TokenType.IDENTIFIER) {
      this.error("Expected function name after 'func'", nameToken)
      return { kind: "ExpressionStmt", expression: { kind: "Literal", value: null } }
    }

    // Parse parameters: (
    if (!this.check(TokenType.LPAREN)) {
      this.error("Expected '(' after function name", this.peek())
    }
    this.advance() // consume (

    // Parse parameter list
    const params: any[] = []
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      let isRest = false
      if (this.check(TokenType.SPREAD)) {
        this.advance() // consume ...
        isRest = true
      }

      const paramName = this.advance()
      if (paramName.type !== TokenType.IDENTIFIER) {
        this.error("Expected parameter name", paramName)
        break
      }

      let paramType: any = undefined
      if (this.check(TokenType.COLON)) {
        this.advance() // consume :
        paramType = this.parseTypeAnnotation()
      }

      params.push({ name: paramName, type: paramType, isRest })

      if (this.check(TokenType.COMMA)) {
        this.advance() // consume ,
      }
    }

    if (this.check(TokenType.RPAREN)) {
      this.advance() // consume )
    } else {
      this.error("Expected ')' after parameters", this.peek())
    }

    // Parse return type
    let returnType: { base: Token; dimensions: number } | undefined
    if (this.check(TokenType.COLON)) {
      this.advance() // consume :
      returnType = this.parseTypeAnnotation()
    }

    // Parse body
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
      returnType,
      body
    }
  }

  private parseReturnStatement(): Stmt {
    const keyword = this.advance() // consume 'return'

    // Check if there's an expression after return
    if (this.check(TokenType.RBRACE) || this.isAtEnd()) {
      // return without value
      return { kind: "ReturnStmt" }
    }

    // Try to parse return value
    const value = this.parseExpression(Precedence.LOWEST)
    if (!value) {
      return { kind: "ReturnStmt" }
    }

    return {
      kind: "ReturnStmt",
      value
    }
  }

  // --- PRATT EXPRESSION ROOT ---

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

    // Left associativity loop
    while (!this.isAtEnd() && precedence < getPrecedence(this.peek().type)) {
      // Special case: if we see [ but it looks like an array literal and there's no left value, 
      // don't treat as index. This handles standalone arrays like "[1, 2, 3]" in expression statements.
      if (this.peek().type === TokenType.LBRACKET && left && left.kind !== "Identifier") {
        if (this.looksLikeArrayLiteral()) {
          return left // Array literal is separate expression, stop here
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

  // --- TOKEN NAVIGATION ---

  public peek(): Token {
    return this.tokens[this.current]
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

  // --- ERROR RECOVERY ---

  public error(message: string, token: Token) {
    this.errors.report(message, token)
  }

  public synchronize() {
    // Skip tokens until we find a safe recovery point
    while (!this.isAtEnd()) {
      const currentType = this.peek()?.type

      // Found SEMICOLON - safe to continue
      if (currentType === TokenType.SEMICOLON) {
        this.advance()
        return
      }

      // Found keyword that starts a statement - safe to continue
      if (currentType === TokenType.KEYWORD) {
        const val = this.peek().value
        if (['func', 'val', 'const', 'var', 'if', 'for', 'while', 'return', 'class'].includes(val as string)) {
          return
        }
      }

      // Found start of new expression - safe to continue
      if ([TokenType.IDENTIFIER, TokenType.NUMBER, TokenType.STRING, TokenType.BOOLEAN, TokenType.NULL, TokenType.LPAREN, TokenType.LBRACE].includes(currentType)) {
        return
      }

      // Skip this token and try next
      this.advance()
    }
  }
}
