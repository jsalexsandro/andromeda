import { Token, TokenType } from "../lexer/types";
import { ErrorHandler } from "./error";
import { Expr, Stmt, TypeNode } from "../ast";
import { Precedence, getPrecedence } from "./precedence";

type PrefixParselet = () => Expr | null;
type InfixParselet = (left: Expr) => Expr | null;

export class Parser {
  private tokens: Token[];
  private current = 0;
  public errors: ErrorHandler;
  private sourceCode: string;

  private prefixParselets: Map<TokenType, PrefixParselet> = new Map();
  private infixParselets: Map<TokenType, InfixParselet> = new Map();

  constructor(tokens: Token[], sourceCode: string) {
    this.tokens = tokens;
    this.sourceCode = sourceCode;
    this.errors = new ErrorHandler(sourceCode);

    this.registerParselets();
  }

  private registerParselets() {
    this.prefixParselets.set(
      TokenType.IDENTIFIER,
      this.parseIdentifier.bind(this),
    );
    this.prefixParselets.set(TokenType.NUMBER, this.parseNumber.bind(this));
    this.prefixParselets.set(TokenType.STRING, this.parseString.bind(this));
    this.prefixParselets.set(TokenType.BOOLEAN, this.parseBoolean.bind(this));
    this.prefixParselets.set(TokenType.NULL, this.parseNull.bind(this));
    this.prefixParselets.set(TokenType.LPAREN, this.parseGroup.bind(this));

    this.prefixParselets.set(TokenType.MINUS, this.parseUnary.bind(this));
    this.prefixParselets.set(TokenType.PLUS, this.parseUnary.bind(this));
    this.prefixParselets.set(TokenType.NOT, this.parseUnary.bind(this));

    this.prefixParselets.set(
      TokenType.LPAREN,
      this.parseArrowOrGroup.bind(this),
    );

    this.prefixParselets.set(
      TokenType.LBRACKET,
      this.parseArrayLiteral.bind(this),
    );

    this.prefixParselets.set(TokenType.SPREAD, this.parseSpread.bind(this));

    this.infixParselets.set(TokenType.ASSIGN, this.parseAssignment.bind(this));
    this.infixParselets.set(
      TokenType.PLUS_EQUAL,
      this.parseAssignment.bind(this),
    );
    this.infixParselets.set(
      TokenType.MINUS_EQUAL,
      this.parseAssignment.bind(this),
    );
    this.infixParselets.set(
      TokenType.STAR_EQUAL,
      this.parseAssignment.bind(this),
    );
    this.infixParselets.set(
      TokenType.SLASH_EQUAL,
      this.parseAssignment.bind(this),
    );
    this.infixParselets.set(
      TokenType.MODULO_EQUAL,
      this.parseAssignment.bind(this),
    );

    this.infixParselets.set(TokenType.PLUS, this.parseBinary.bind(this));
    this.infixParselets.set(TokenType.MINUS, this.parseBinary.bind(this));
    this.infixParselets.set(TokenType.STAR, this.parseBinary.bind(this));
    this.infixParselets.set(TokenType.SLASH, this.parseBinary.bind(this));
    this.infixParselets.set(TokenType.MODULO, this.parseBinary.bind(this));

    this.infixParselets.set(TokenType.EQUAL, this.parseBinary.bind(this));
    this.infixParselets.set(TokenType.NOT_EQUAL, this.parseBinary.bind(this));
    this.infixParselets.set(TokenType.LESS_THAN, this.parseBinary.bind(this));
    this.infixParselets.set(
      TokenType.GREATER_THAN,
      this.parseBinary.bind(this),
    );
    this.infixParselets.set(TokenType.LESS_EQUAL, this.parseBinary.bind(this));
    this.infixParselets.set(
      TokenType.GREATER_EQUAL,
      this.parseBinary.bind(this),
    );

    this.infixParselets.set(TokenType.AND, this.parseBinary.bind(this));
    this.infixParselets.set(TokenType.OR, this.parseBinary.bind(this));

    this.infixParselets.set(TokenType.QUESTION, this.parseTernary.bind(this));

    this.infixParselets.set(
      TokenType.QUESTION_QUESTION,
      this.parseNullish.bind(this),
    );

    this.infixParselets.set(TokenType.LPAREN, this.parseCall.bind(this));

    this.infixParselets.set(TokenType.DOT, this.parseMember.bind(this));

    this.infixParselets.set(TokenType.LBRACKET, this.parseIndex.bind(this));

    this.prefixParselets.set(
      TokenType.LBRACE,
      this.parseObjectLiteral.bind(this),
    );

    this.infixParselets.set(
      TokenType.INCREMENT,
      this.parsePostfixIncrement.bind(this),
    );
    this.infixParselets.set(
      TokenType.DECREMENT,
      this.parsePostfixDecrement.bind(this),
    );
  }

  private parseIdentifier(): Expr {
    const name = this.previous();

    if (this.check(TokenType.ARROW)) {
      this.advance();
      const params = [{ name }];
      return this.parseArrowBody(params, undefined);
    }

    return { kind: "Identifier", name };
  }

  private parseNumber(): Expr {
    return { kind: "Literal", value: this.previous().value };
  }

  private parseString(): Expr {
    return { kind: "Literal", value: this.previous().value };
  }

  private parseBoolean(): Expr {
    return { kind: "Literal", value: this.previous().value };
  }

  private parseNull(): Expr {
    return { kind: "Literal", value: null };
  }

  private parseGroup(): Expr {
    const lparen = this.previous();
    const expr = this.parseExpression(Precedence.LOWEST);
    if (this.check(TokenType.RPAREN)) {
      this.advance();
    } else {
      this.error(
        `Expected ')' to close group starting at line ${lparen.line}`,
        lparen,
      );
    }
    return { kind: "Group", expression: expr };
  }

  private parseArrayLiteral(): Expr {
    const bracket =
      this.previous().type === TokenType.LBRACKET
        ? this.previous()
        : this.peek();

    if (this.previous().type !== TokenType.LBRACKET) {
      this.advance();
    }

    const elements: Expr[] = [];
    let foundClosingBracket = false;

    if (this.check(TokenType.RBRACKET)) {
      this.advance();
      foundClosingBracket = true;
      return { kind: "Array", elements };
    }

    while (!this.isAtEnd()) {
      const elem = this.parseExpression(Precedence.LOWEST);
      if (elem) {
        elements.push(elem);
      }

      if (this.check(TokenType.RBRACKET)) {
        this.advance();
        foundClosingBracket = true;
        break;
      }

      if (this.check(TokenType.COMMA)) {
        this.advance();
        if (this.check(TokenType.RBRACKET)) {
          this.advance();
          foundClosingBracket = true;
          break;
        }
      } else {
        if (!this.isAtEnd()) {
          this.error("Expected ',' or ']' after array element", this.peek());
        }
        break;
      }
    }

    if (!foundClosingBracket && !this.isAtEnd()) {
      this.error("Expected ']' to close array literal", bracket);
    }

    return { kind: "Array", elements };
  }

  private parseObjectLiteral(): Expr {
    const brace = this.peek();
    const properties: { key: string | null; value: Expr }[] = [];

    const isAtBrace = this.check(TokenType.LBRACE);
    if (isAtBrace) {
      this.advance();
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance();
      return { kind: "Object", properties };
    }

    while (!this.isAtEnd() && !this.check(TokenType.RBRACE)) {
      let key: string | null = null;
      let value: Expr | null = null;

      if (this.check(TokenType.SPREAD)) {
        this.advance();
        const spreadArg = this.parseExpression(Precedence.LOWEST);
        if (spreadArg) {
          properties.push({
            key: null,
            value: { kind: "Spread", argument: spreadArg },
          });
        }
      } else if (
        this.check(TokenType.IDENTIFIER) ||
        this.check(TokenType.KEYWORD) ||
        this.check(TokenType.BOOLEAN) ||
        this.check(TokenType.NULL)
      ) {
        key = this.advance().value as string;

        if (this.check(TokenType.COLON)) {
          this.advance();
          value = this.parseExpression(Precedence.LOWEST);
        } else {
          value = {
            kind: "Identifier",
            name: {
              type: TokenType.IDENTIFIER,
              value: key,
              line: brace.line,
              column: brace.column,
            },
          };
        }
      } else if (this.check(TokenType.STRING)) {
        key = this.advance().value as string;
        if (this.check(TokenType.COLON)) {
          this.advance();
          value = this.parseExpression(Precedence.LOWEST);
        }
      } else if (this.check(TokenType.NUMBER)) {
        const numToken = this.advance();
        const numValue = numToken.value as number;
        key = String(numValue);

        if (this.check(TokenType.COLON)) {
          this.advance();
          value = this.parseExpression(Precedence.LOWEST);
        } else {
          value = {
            kind: "Identifier",
            name: {
              type: TokenType.IDENTIFIER,
              value: key,
              line: brace.line,
              column: brace.column,
            },
          };
        }
      } else {
        this.error("Expected property name", this.peek());
        break;
      }

      if (value) {
        properties.push({ key, value });
      }

      if (this.check(TokenType.RBRACE)) break;

      if (!this.check(TokenType.COMMA)) {
        this.error("Expected ',' or '}' in object literal", this.peek());
        break;
      }
      this.advance();
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance();
    } else {
      this.error("Expected '}' to close object literal", this.peek());
    }

    return { kind: "Object", properties };
  }

  private parseSpread(): Expr {
    const spread = this.previous();
    const arg = this.parseExpression(Precedence.LOWEST);
    if (!arg) {
      this.error("Expected expression after '...'", spread);
      return {
        kind: "Identifier",
        name: {
          type: TokenType.IDENTIFIER,
          value: "error",
          line: spread.line,
          column: spread.column,
        },
      };
    }
    return { kind: "Spread", argument: arg };
  }

  private parseArrowOrGroup(): Expr {
    const startPos = this.current;

    const arrow = this.tryParseArrowFunction();
    if (arrow) {
      return arrow;
    }

    this.current = startPos;
    return this.parseGroup();
  }

  private tryParseArrowFunction(): Expr | null {
    const params: { name: Token; isRest?: boolean; type?: TypeNode }[] = [];

    if (this.check(TokenType.RPAREN)) {
      this.advance();

      // Check for return type: () => int
      let returnType: TypeNode | undefined;
      if (this.check(TokenType.COLON)) {
        this.advance();
        returnType = this.parseAnnotationType();
      }

      if (!this.check(TokenType.ARROW)) {
        return null;
      }
      this.advance();
      return this.parseArrowBody(params, returnType);
    }

    while (!this.isAtEnd() && !this.check(TokenType.RPAREN)) {
      let isRest = false;
      if (this.check(TokenType.SPREAD)) {
        this.advance();
        isRest = true;
      }

      if (this.peek().type !== TokenType.IDENTIFIER) {
        return null;
      }

      const paramName = this.advance();

      let paramType: TypeNode | undefined;
      if (this.check(TokenType.COLON)) {
        paramType = this.parseAnnotation();
      }

      params.push({ name: paramName, isRest, type: paramType });

      if (isRest && !this.check(TokenType.RPAREN)) {
        return null;
      }

      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }

    if (!this.check(TokenType.RPAREN)) {
      return null;
    }
    this.advance();

    // Check for return type: (x: int) => int
    let returnType: TypeNode | undefined;
    if (this.check(TokenType.COLON)) {
      this.advance();
      returnType = this.parseAnnotationType();
    }

    if (!this.check(TokenType.ARROW)) {
      return null;
    }
    this.advance();

    return this.parseArrowBody(params, returnType);
  }

  private isObjectTypeAnnotation(lbracePos: number): boolean {
    return false;
  }

  private looksLikeBlockStatement(): boolean {
    let i = this.current + 1;
    const token = this.tokens[i];
    if (!token) return false;

    if (token.type === TokenType.RBRACE) return false;

    if (token.type === TokenType.KEYWORD) {
      const keywords = [
        "if",
        "while",
        "for",
        "return",
        "var",
        "val",
        "const",
        "func",
        "break",
        "continue",
      ];
      if (keywords.includes(token.value as string)) return true;
    }

    if (token.type === TokenType.IDENTIFIER) {
      i++;
      const nextToken = this.tokens[i];
      if (nextToken && nextToken.type === TokenType.LPAREN) return true;
      if (nextToken && nextToken.type === TokenType.LBRACE) return true;
      if (nextToken && nextToken.type === TokenType.COLON) return false;
      if (nextToken && nextToken.type === TokenType.COMMA) return true;
      if (nextToken && nextToken.type === TokenType.ASSIGN) return true;
    }

    if (
      token.type === TokenType.NUMBER ||
      token.type === TokenType.STRING ||
      token.type === TokenType.BOOLEAN ||
      token.type === TokenType.NULL
    ) {
      i++;
      const nextToken = this.tokens[i];
      if (nextToken && nextToken.type === TokenType.SEMICOLON) return true;
      if (nextToken && nextToken.type === TokenType.RBRACE) return true;
    }

    return false;
  }

  private parseArrowBody(params: { name: Token; isRest?: boolean; type?: TypeNode }[], returnType?: TypeNode): Expr {
    if (this.check(TokenType.LBRACE)) {
      if (this.looksLikeBlockStatement()) {
        const body = this.parseBlockStatement();
        return {
          kind: "ArrowFunction",
          params,
          body,
        };
      }

      const savedPos = this.current;
      const savedErrorsLength = this.errors.errors.length;
      try {
        const objLiteral = this.parseObjectLiteral();
        return {
          kind: "ArrowFunction",
          params,
          body: objLiteral,
          returnType,
        };
      } catch (e) {
        this.current = savedPos;
        this.errors.errors = this.errors.errors.slice(0, savedErrorsLength);
        const body = this.parseBlockStatement();
        return {
          kind: "ArrowFunction",
          params,
          body,
          returnType,
        };
      }
    } else {
      const body = this.parseExpression(Precedence.LOWEST);
      if (!body) {
        this.error("Expected expression after '=>'", this.peek());
        return { kind: "Literal", value: null };
      }
      return {
        kind: "ArrowFunction",
        params,
        body,
        returnType,
      };
    }
  }

  private parseAssignment(left: Expr): Expr | null {
    const operator = this.previous();
    const value = this.parseExpression(Precedence.LOWEST);
    if (!value) {
      this.error(`Expected expression after '${operator.value}'`, operator);
      return null;
    }
    return { kind: "Assign", name: left, value, operator };
  }

  private parseUnary(): Expr {
    const operator = this.previous();
    const right = this.parseExpression(Precedence.PREFIX);
    if (!right) {
      this.error(`Expected expression after '${operator.value}'`, operator);
      return { kind: "Literal", value: null };
    }
    return { kind: "Unary", operator, right };
  }

  private parsePostfixIncrement(left: Expr): Expr {
    const operator = this.previous();
    return { kind: "Unary", operator, right: left };
  }

  private parsePostfixDecrement(left: Expr): Expr {
    const operator = this.previous();
    return { kind: "Unary", operator, right: left };
  }

  private parseCall(left: Expr): Expr | null {
    const args: Expr[] = [];

    if (this.check(TokenType.RPAREN)) {
      this.advance();
      return { kind: "Call", callee: left, args };
    }

    while (!this.isAtEnd()) {
      const arg = this.parseExpression(Precedence.LOWEST);
      if (arg) {
        args.push(arg);
      }

      if (this.check(TokenType.RPAREN)) {
        this.advance();
        break;
      }

      if (!this.check(TokenType.COMMA)) {
        break;
      }
      this.advance();

      if (this.isAtEnd()) {
        break;
      }
    }

    return { kind: "Call", callee: left, args };
  }

  private parseMember(left: Expr): Expr | null {
    const property = this.peek();

    const validPropertyTypes = [
      TokenType.IDENTIFIER,
      TokenType.KEYWORD,
      TokenType.BOOLEAN,
      TokenType.NULL,
    ];

    if (!validPropertyTypes.includes(property.type)) {
      this.errors.report("Expected property name after '.'", property);
      return null;
    }

    this.advance();
    return {
      kind: "Member",
      object: left,
      property: { kind: "Identifier", name: this.previous() },
    };
  }

  private parseIndex(left: Expr): Expr | null {
    if (!left) {
      this.error("Expected expression before '['", this.peek());
      return null;
    }

    const indexExpr = this.parseExpression(Precedence.LOWEST);

    if (!indexExpr) {
      this.error("Expected expression inside brackets", this.peek());
      return null;
    }

    if (!this.check(TokenType.RBRACKET)) {
      this.error("Expected ']' after index expression", this.peek());
      return null;
    }

    this.advance();
    return { kind: "Index", object: left, index: indexExpr };
  }

  private parseTernary(left: Expr): Expr | null {
    const consequent = this.parseExpression(Precedence.LOWEST);
    if (!consequent) {
      this.error("Expected expression after '?'", this.peek());
      return null;
    }

    if (!this.check(TokenType.COLON)) {
      this.error("Expected ':' after '?' expression", this.peek());
      return null;
    }
    this.advance();

    const alternate = this.parseExpression(Precedence.CONDITIONAL);
    if (!alternate) {
      this.error("Expected expression after ':'", this.peek());
      return null;
    }

    return {
      kind: "Conditional",
      condition: left,
      consequent,
      alternate,
    };
  }

  private parseNullish(left: Expr): Expr | null {
    const right = this.parseExpression(Precedence.NULLISH);
    if (!right) {
      this.error("Expected expression after '??'", this.peek());
      return null;
    }

    return {
      kind: "NullishCoalescing",
      left,
      right,
    };
  }

  private parseBinary(left: Expr): Expr | null {
    const operator = this.previous();
    const precedence = getPrecedence(operator.type);
    const right = this.parseExpression(precedence);
    if (!right) {
      this.error(`Expected expression after '${operator.value}'`, operator);
      return null;
    }
    return {
      kind: "Binary",
      left,
      operator,
      right,
    };
  }

  public parse(): Stmt[] {
    this.errors.errors = [];
    const statements: Stmt[] = [];
    while (!this.isAtEnd()) {
      try {
        const stmt = this.parseStatement();
        if (stmt) statements.push(stmt);
      } catch (e: any) {
        this.synchronize();
      }
    }
    return statements;
  }

  private parseStatement(): Stmt | null {
    const token = this.peek();

    if (token?.type === TokenType.LBRACE) {
      if (this.looksLikeObjectLiteral()) {
        const expr = this.parseObjectLiteral();
        return { kind: "ExpressionStmt", expression: expr };
      }
      return this.parseBlockStatement();
    }

    if (token?.type === TokenType.LBRACKET) {
      if (this.looksLikeArrayLiteral()) {
        this.advance();
        const expr = this.parseArrayLiteral();
        return { kind: "ExpressionStmt", expression: expr };
      }
    }

    if (token?.type === TokenType.KEYWORD) {
      const keyword = token.value as string;
      if (keyword === "var" || keyword === "val" || keyword === "const") {
        return this.parseVariableDeclaration();
      }
      if (keyword === "if") {
        return this.parseIfStatement();
      }
      if (keyword === "while") {
        return this.parseWhileStatement();
      }
      if (keyword === "break") {
        this.advance();
        return { kind: "BreakStmt" };
      }
      if (keyword === "continue") {
        this.advance();
        return { kind: "ContinueStmt" };
      }
      if (keyword === "func") {
        return this.parseFunctionStatement();
      }
      if (keyword === "return") {
        return this.parseReturnStatement();
      }
      if (keyword === "protocol") {
        return this.parseProtocolStatement();
      }
    }

    const expr = this.parseExpression(Precedence.LOWEST);
    if (!expr) {
      this.advance();
      return null;
    }
    return { kind: "ExpressionStmt", expression: expr };
  }

  private looksLikeObjectLiteral(): boolean {
    let i = this.current + 1;
    if (this.tokens[i]?.type === TokenType.RBRACE) {
      return true;
    }
    if (this.tokens[i]?.type === TokenType.SPREAD) {
      return true;
    }
    if (this.tokens[i]?.type === TokenType.IDENTIFIER) {
      i++;
      if (this.tokens[i]?.type === TokenType.COLON) {
        return true;
      }
      if (this.tokens[i]?.type === TokenType.COMMA) {
        return true;
      }
      if (this.tokens[i]?.type === TokenType.RBRACE) {
        return true;
      }
    }
    if (
      this.tokens[i]?.type === TokenType.KEYWORD ||
      this.tokens[i]?.type === TokenType.BOOLEAN ||
      this.tokens[i]?.type === TokenType.NULL
    ) {
      i++;
      if (this.tokens[i]?.type === TokenType.COLON) {
        return true;
      }
    }
    if (this.tokens[i]?.type === TokenType.STRING) {
      i++;
      if (this.tokens[i]?.type === TokenType.COLON) {
        return true;
      }
      if (this.tokens[i]?.type === TokenType.COMMA) {
        return true;
      }
      if (this.tokens[i]?.type === TokenType.RBRACE) {
        return true;
      }
    }
    if (this.tokens[i]?.type === TokenType.RBRACE) {
      return true;
    }
    return false;
  }

  private looksLikeArrayLiteral(): boolean {
    let i = this.current + 1;
    if (this.tokens[i]?.type === TokenType.RBRACKET) {
      return true;
    }
    if (this.tokens[i]?.type === TokenType.SPREAD) {
      return true;
    }
    if (
      this.tokens[i]?.type === TokenType.NUMBER ||
      this.tokens[i]?.type === TokenType.STRING ||
      this.tokens[i]?.type === TokenType.BOOLEAN ||
      this.tokens[i]?.type === TokenType.NULL ||
      this.tokens[i]?.type === TokenType.LBRACKET ||
      this.tokens[i]?.type === TokenType.LBRACE ||
      this.tokens[i]?.type === TokenType.IDENTIFIER ||
      this.tokens[i]?.type === TokenType.MINUS ||
      this.tokens[i]?.type === TokenType.PLUS ||
      this.tokens[i]?.type === TokenType.NOT ||
      this.tokens[i]?.type === TokenType.LPAREN
    ) {
      return true;
    }
    return false;
  }

  private parseBlockStatement(): Stmt {
    const lbrace = this.previous();
    this.advance();
    const statements: Stmt[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance();
    } else {
      this.error("Expected '}' to close block", lbrace);
    }

    return { kind: "BlockStmt", statements };
  }

  private parseVariableDeclaration(): Stmt | null {
    const keywordToken = this.advance();
    const keyword = keywordToken.value as string;

    const nameToken = this.advance();
    if (nameToken.type !== TokenType.IDENTIFIER) {
      this.error(`Expected variable name after '${keyword}'`, nameToken);
      this.advance();
      return null;
    }

    const typeAnnotation = this.parseAnnotation();

    let initializer: Expr | undefined;
    if (this.peek().type === TokenType.ASSIGN) {
      this.advance();
      initializer = this.parseExpression(Precedence.LOWEST);
    }

    return {
      kind: "VariableStmt",
      declarationType: keyword as "var" | "val" | "const",
      name: nameToken,
      type: typeAnnotation,
      initializer,
    };
  }

  private parseIfStatement(): Stmt {
    this.advance();

    if (this.peek().type !== TokenType.LPAREN) {
      this.error("Expected '(' after 'if'", this.peek());
      this.synchronize();
      return { kind: "BlockStmt", statements: [] };
    }
    this.advance();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (this.check(TokenType.RPAREN)) {
      this.advance();
    } else {
      this.error("Expected ')' after condition", this.peek());
      this.synchronize();
      return { kind: "BlockStmt", statements: [] };
    }

    let thenBranch: Stmt;
    if (this.peek().type === TokenType.LBRACE) {
      thenBranch = this.parseBlockStatement();
    } else {
      thenBranch = this.parseStatement() || {
        kind: "BlockStmt",
        statements: [],
      };
    }

    let elseBranch: Stmt | undefined;
    if (
      this.peek().type === TokenType.KEYWORD &&
      this.peek().value === "else"
    ) {
      this.advance();

      if (
        this.peek().type === TokenType.KEYWORD &&
        this.peek().value === "if"
      ) {
        elseBranch = this.parseIfStatement();
      } else if (this.peek().type === TokenType.LBRACE) {
        elseBranch = this.parseBlockStatement();
      } else {
        elseBranch = this.parseStatement() || {
          kind: "BlockStmt",
          statements: [],
        };
      }
    }

    return {
      kind: "IfStmt",
      condition,
      thenBranch,
      elseBranch,
    };
  }

  private parseWhileStatement(): Stmt {
    this.advance();

    if (this.peek().type !== TokenType.LPAREN) {
      this.error("Expected '(' after 'while'", this.peek());
      this.synchronize();
      return { kind: "BlockStmt", statements: [] };
    }
    this.advance();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (this.check(TokenType.RPAREN)) {
      this.advance();
    } else {
      this.error("Expected ')' after condition", this.peek());
      this.synchronize();
      return { kind: "BlockStmt", statements: [] };
    }

    let body: Stmt;
    if (this.peek().type === TokenType.LBRACE) {
      body = this.parseBlockStatement();
    } else {
      body = this.parseStatement() || { kind: "BlockStmt", statements: [] };
    }

    return {
      kind: "WhileStmt",
      condition,
      body,
    };
  }

  private parseFunctionStatement(): Stmt {
    this.advance();

    const nameToken = this.advance();
    if (nameToken.type !== TokenType.IDENTIFIER) {
      this.error("Expected function name after 'func'", nameToken);
      return {
        kind: "ExpressionStmt",
        expression: { kind: "Literal", value: null },
      };
    }

    if (!this.check(TokenType.LPAREN)) {
      this.error("Expected '(' after function name", this.peek());
    }
    this.advance(); // consume '('

// USA A NOVA FUNÇÃO ISOLADA
    const params = this.parseFunctionParams()

    // Parse return type: func app(): int {}
    let returnType: TypeNode | undefined
    if (this.check(TokenType.COLON)) {
      this.advance() // consume ':'
      returnType = this.parseAnnotationType()
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
      body,
      returnType
    }
  }

  // ========================================
  // Parse Function Parameters
  // Extraído de parseFunctionStatement()
  // Suporta: nome, ...spread, vírgulasy
  // ========================================
  private parseFunctionParams(): { name: Token; isRest?: boolean; type?: TypeNode }[] {
    const params: { name: Token; isRest?: boolean; type?: TypeNode }[] = [];

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      let isRest = false;
      if (this.check(TokenType.SPREAD)) {
        this.advance();
        isRest = true;
      }

      const paramName = this.advance();
      if (paramName.type !== TokenType.IDENTIFIER) {
        this.error("Expected parameter name", paramName);
        break;
      }

      let paramType: TypeNode | undefined;
      if (this.check(TokenType.COLON)) {
        paramType = this.parseAnnotation();
      }

      params.push({ name: paramName, isRest, type: paramType });

      if (isRest && !this.check(TokenType.RPAREN)) {
        this.error("Rest parameter must be last", paramName);
        break;
      }

      if (this.check(TokenType.COMMA)) {
        this.advance();
      } else if (!this.check(TokenType.RPAREN)) {
        break;
      }
    }

    if (this.check(TokenType.RPAREN)) {
      this.advance(); // consume ')'
    } else {
      this.error("Expected ')' after parameters", this.peek());
    }

    return params;
  }

  private parseReturnStatement(): Stmt {
    const keyword = this.advance();

    if (this.check(TokenType.RBRACE) || this.isAtEnd()) {
      return { kind: "ReturnStmt" };
    }

    const value = this.parseExpression(Precedence.LOWEST);
    if (!value) {
      return { kind: "ReturnStmt" };
    }

    return {
      kind: "ReturnStmt",
      value,
    };
  }

  public parseExpression(precedence: Precedence): Expr | null {
    if (this.isAtEnd()) return null;

    let token = this.advance();
    let prefix = this.prefixParselets.get(token.type);

    if (!prefix) {
      this.error(
        `Unexpected token '${token.value ?? token.type}', expected expression.`,
        token,
      );
      throw new Error("ParseError");
    }

    let left = prefix();
    if (!left) return null;

    while (!this.isAtEnd() && precedence < getPrecedence(this.peek().type)) {
      if (this.peek().type === TokenType.LBRACKET && left) {
        const isLiteralLeft =
          left.kind === "Array" ||
          left.kind === "Object" ||
          left.kind === "Literal";
        if (isLiteralLeft && this.looksLikeArrayLiteral()) {
          return left;
        }
      }

      const infix = this.infixParselets.get(this.peek().type);
      if (!infix) {
        return left;
      }
      this.advance();
      left = infix(left);
      if (!left) break;
    }

    return left;
  }

  public peek(): Token {
    return this.tokens[this.current];
  }

  public peekNext(): Token | undefined {
    return this.tokens[this.current + 1];
  }

  public previous(): Token {
    return this.tokens[this.current - 1];
  }

  public isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  public advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  public check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  public match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  public consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    this.error(message, this.peek());
    throw new Error("ParseError");
  }

  public error(message: string, token: Token) {
    this.errors.report(message, token);
  }

  public synchronize() {
    while (!this.isAtEnd()) {
      const currentType = this.peek()?.type;

      if (currentType === TokenType.SEMICOLON) {
        this.advance();
        return;
      }

      if (currentType === TokenType.KEYWORD) {
        const val = this.peek().value;
        if (
          [
            "func",
            "val",
            "const",
            "var",
            "if",
            "for",
            "while",
            "return",
            "class",
          ].includes(val as string)
        ) {
          return;
        }
      }

      if (
        [
          TokenType.IDENTIFIER,
          TokenType.NUMBER,
          TokenType.STRING,
          TokenType.BOOLEAN,
          TokenType.NULL,
          TokenType.LPAREN,
          TokenType.LBRACE,
        ].includes(currentType)
      ) {
        return;
      }

      this.advance();
    }
  }

  // ========================================
  // Type Annotation Parser
  // Parses type annotations for variables and function parameters.
  // Supports:
  //   - Primitive types: int, float, string, bool, void, null, any, unknown
  //   - Named types (custom): User, Product, Order, etc.
  // ========================================

  /**
   * Parses a type annotation after `:`.
   * Examples:
   *   val age: int           → PrimitiveTypeNode { name: "int" }
   *   val name: string     → PrimitiveTypeNode { name: "string" }
   *   val user: User      → NamedTypeNode { name: "User" }
   *   val data: MyType    → NamedTypeNode { name: "MyType" }
   *
   * @returns {TypeNode | undefined} The parsed type node, or undefined if no annotation.
   */
  private parseAnnotation(): TypeNode | undefined {
    if (!this.check(TokenType.COLON)) {
      return undefined;
    }
    this.advance();

    const typeToken = this.peek();

    // Check for TupleType: [string, int, bool]
    if (typeToken.type === TokenType.LBRACKET) {
      const savedPos = this.current;
      this.advance(); // consume '['
      const nextToken = this.peek();
      this.current = savedPos; // restore position

      const isTypeToken = [
        TokenType.INT_TYPE,
        TokenType.FLOAT_TYPE,
        TokenType.STRING_TYPE,
        TokenType.BOOLEAN_TYPE,
        TokenType.VOID_TYPE,
        TokenType.ANY_TYPE,
        TokenType.UNKNOWN_TYPE,
        TokenType.NULL,
        TokenType.IDENTIFIER,
        TokenType.NUMBER,
        TokenType.STRING,
        TokenType.BOOLEAN,
        TokenType.LBRACKET, // Nested tuple: [[int, string], [bool, User]]
        TokenType.LPAREN, // Grouping type: (int | string)
      ].includes(nextToken?.type);

      if (isTypeToken) {
        return this.parseAnnotationType()!;
      }
    }

    // ========================================
    // FunctionType or GroupingType — (int) => string ou (int | string)
    // ========================================
    if (typeToken.type === TokenType.LPAREN) {
      return this.parseFunctionOrGroupingType();
    }

    if (typeToken.type === TokenType.INT_TYPE) {
      this.advance();
      let typeNode = { kind: "PrimitiveType", name: "int" as const };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.LBRACKET)) {
        typeNode = this.parseArrayType(typeNode);
      }
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [int]`);
      return typeNode;
    }
    if (typeToken.type === TokenType.FLOAT_TYPE) {
      this.advance();
      let typeNode = { kind: "PrimitiveType", name: "float" as const };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.LBRACKET)) {
        typeNode = this.parseArrayType(typeNode);
      }
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [float]`);
      return typeNode;
    }
    if (typeToken.type === TokenType.STRING_TYPE) {
      this.advance();
      let typeNode = { kind: "PrimitiveType", name: "string" as const };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.LBRACKET)) {
        typeNode = this.parseArrayType(typeNode);
      }
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [string]`);
      return typeNode;
    }
    if (typeToken.type === TokenType.BOOLEAN_TYPE) {
      this.advance();
      let typeNode = { kind: "PrimitiveType", name: "bool" as const };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.LBRACKET)) {
        typeNode = this.parseArrayType(typeNode);
      }
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [bool]`);
      return typeNode;
    }
    if (typeToken.type === TokenType.VOID_TYPE) {
      this.advance();
      let typeNode = { kind: "PrimitiveType", name: "void" as const };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.LBRACKET)) {
        typeNode = this.parseArrayType(typeNode);
      }
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [void]`);
      return typeNode;
    }
    if (typeToken.type === TokenType.ANY_TYPE) {
      this.advance();
      let typeNode = { kind: "PrimitiveType", name: "any" as const };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.LBRACKET)) {
        typeNode = this.parseArrayType(typeNode);
      }
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [any]`);
      return typeNode;
    }
    if (typeToken.type === TokenType.UNKNOWN_TYPE) {
      this.advance();
      let typeNode = { kind: "PrimitiveType", name: "unknown" as const };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.LBRACKET)) {
        typeNode = this.parseArrayType(typeNode);
      }
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [unknown]`);
      return typeNode;
    }
    // ========================================
    // undefined type - Promise<undefined>, string | undefined
    // ========================================
    if (typeToken.type === TokenType.UNDEFINED_TYPE) {
      this.advance();
      let typeNode = { kind: "PrimitiveType", name: "undefined" as const };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.LBRACKET)) {
        typeNode = this.parseArrayType(typeNode);
      }
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [undefined]`);
      return typeNode;
    }
    if (typeToken.type === TokenType.NULL) {
      this.advance();
      let typeNode = { kind: "PrimitiveType", name: "null" as const };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.LBRACKET)) {
        typeNode = this.parseArrayType(typeNode);
      }
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [null]`);
      return typeNode;
    }

    // NamedTypeNode - custom types (User, Product, Order, etc.)
    if (typeToken.type === TokenType.IDENTIFIER) {
      let baseType = this.parseNamedTypeNode();
      // Check for nullable: User?
      if (this.check(TokenType.QUESTION)) {
        baseType = this.parseNullableSuffix(baseType);
      }
      // Check for array suffix: int[], string[][], etc.
      if (this.check(TokenType.LBRACKET)) {
        baseType = this.parseArrayType(baseType);
      }
      // Check for nullable after array: User[]?
      if (this.check(TokenType.QUESTION)) {
        baseType = this.parseNullableSuffix(baseType);
      }
      // Check for union: User | string
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(baseType);
      }
      return baseType;
    }

    // LiteralTypeNode - literal types (3.14, "active", 200, true)
    if (typeToken.type === TokenType.NUMBER) {
      this.advance();
      let typeNode = { kind: "LiteralType", value: typeToken.value as number };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [${typeToken.value}]`);
      return typeNode;
    }
    if (typeToken.type === TokenType.STRING) {
      this.advance();
      let typeNode = { kind: "LiteralType", value: typeToken.value as string };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [${typeToken.value}]`);
      return typeNode;
    }
    if (typeToken.type === TokenType.BOOLEAN) {
      this.advance();
      let typeNode = { kind: "LiteralType", value: typeToken.value as boolean };
      if (this.check(TokenType.QUESTION)) {
        typeNode = this.parseNullableSuffix(typeNode);
      }
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(typeNode);
      }
      console.log(`DEBUG - [${typeToken.value}]`);
      return typeNode;
    }

    // ArrayType - int[], string[][], User[], etc.
    if (typeToken.type === TokenType.LBRACKET) {
      // Check if this is a tuple: [string, int] or empty tuple: []
      const savedPos = this.current;
      this.advance(); // consume '['
      const nextToken = this.peek();
      this.current = savedPos; // restore position

      // Empty tuple: []
      if (nextToken?.type === TokenType.RBRACKET) {
        return this.parseTupleType();
      }

      // If the next token after '[' is a type, it's a tuple
      const isTypeToken = [
        TokenType.INT_TYPE,
        TokenType.FLOAT_TYPE,
        TokenType.STRING_TYPE,
        TokenType.BOOLEAN_TYPE,
        TokenType.VOID_TYPE,
        TokenType.ANY_TYPE,
        TokenType.UNKNOWN_TYPE,
        TokenType.NULL,
        TokenType.UNDEFINED_TYPE,
        TokenType.IDENTIFIER,
        TokenType.NUMBER,
        TokenType.STRING,
        TokenType.BOOLEAN,
        TokenType.LBRACKET,
        TokenType.LPAREN,
      ].includes(nextToken?.type);

      if (isTypeToken) {
        return this.parseTupleType();
      }

      this.error("Expected type before '['", typeToken);
      return undefined;
    }

    this.error(`Expected type name, got '${typeToken.value}'`, typeToken);
    return undefined;
  }

  /**
   * Parses a type inside generic brackets (without `:` prefix).
   * Used by parseNamedTypeWithGenerics to parse type arguments.
   * Examples:
   *   <int>              → PrimitiveTypeNode { name: "int" }
   *   <User>             → NamedTypeNode { name: "User" }
   *   <Array<T>>        → GenericTypeNode
   *
   * @returns {TypeNode | undefined} The parsed type node, or undefined if no type.
   */
  private parseAnnotationType(): TypeNode | undefined {
    const typeToken = this.peek();

    // Tuple aninhada: [int, string]
    if (typeToken.type === TokenType.LBRACKET) {
      let baseType = this.parseTupleType() as TypeNode;
      // Array de tuple: [int, string][]
      if (this.check(TokenType.LBRACKET)) {
        baseType = this.parseArrayType(baseType);
      }
      // Nullable: [int, string]?
      if (this.check(TokenType.QUESTION)) {
        baseType = this.parseNullableSuffix(baseType);
      }
      // Union: [int, string] | [bool, User]
      if (this.check(TokenType.PIPE)) {
        return this.parseUnionType(baseType);
      }
      return baseType;
    }

    // ========================================
    // FunctionType or GroupingType — (int) => string ou (int | string)
    // ========================================
    if (typeToken.type === TokenType.LPAREN) {
      return this.parseFunctionOrGroupingType();
    }

    // Primitivos
    let baseType: TypeNode | undefined;

    if (typeToken.type === TokenType.INT_TYPE) {
      this.advance();
      baseType = { kind: "PrimitiveType", name: "int" };
    } else if (typeToken.type === TokenType.FLOAT_TYPE) {
      this.advance();
      baseType = { kind: "PrimitiveType", name: "float" };
    } else if (typeToken.type === TokenType.STRING_TYPE) {
      this.advance();
      baseType = { kind: "PrimitiveType", name: "string" };
    } else if (typeToken.type === TokenType.BOOLEAN_TYPE) {
      this.advance();
      baseType = { kind: "PrimitiveType", name: "bool" };
    } else if (typeToken.type === TokenType.VOID_TYPE) {
      this.advance();
      baseType = { kind: "PrimitiveType", name: "void" };
    } else if (typeToken.type === TokenType.ANY_TYPE) {
      this.advance();
      baseType = { kind: "PrimitiveType", name: "any" };
    } else if (typeToken.type === TokenType.UNKNOWN_TYPE) {
      this.advance();
      baseType = { kind: "PrimitiveType", name: "unknown" };
    } else if (typeToken.type === TokenType.NULL) {
      this.advance();
      baseType = { kind: "PrimitiveType", name: "null" };
    } else if (typeToken.type === TokenType.UNDEFINED_TYPE) {
      this.advance();
      baseType = { kind: "PrimitiveType", name: "undefined" };
    }

    // Named + Generic: User, Array<T>, Map<K, V>
    else if (typeToken.type === TokenType.IDENTIFIER) {
      baseType = this.parseNamedTypeNode();
    }

    // Literal types
    else if (typeToken.type === TokenType.NUMBER) {
      this.advance();
      baseType = { kind: "LiteralType", value: typeToken.value as number };
    } else if (typeToken.type === TokenType.STRING) {
      this.advance();
      baseType = { kind: "LiteralType", value: typeToken.value as string };
    } else if (typeToken.type === TokenType.BOOLEAN) {
      this.advance();
      baseType = { kind: "LiteralType", value: typeToken.value as boolean };
    }

    if (!baseType) {
      this.error(
        `Expected type in generic, got '${typeToken.value}'`,
        typeToken,
      );
      return undefined;
    }

    // Nullable: int?, User?, List<T>?
    if (this.check(TokenType.QUESTION)) {
      baseType = this.parseNullableSuffix(baseType);
    }

    // Array suffix: int[], User[][], etc.
    if (this.check(TokenType.LBRACKET)) {
      baseType = this.parseArrayType(baseType);
    }

    // Nullable after array: int[]?, User[]?
    if (this.check(TokenType.QUESTION)) {
      baseType = this.parseNullableSuffix(baseType);
    }

    // Union: int | string, User | null
    if (this.check(TokenType.PIPE)) {
      return this.parseUnionType(baseType);
    }

    return baseType;
  }

  /**
   * Parses a named type node (custom types like User, Product, etc.)
   * Examples:
   *   val user: User       → NamedTypeNode { name: "User" }
   *   val item: Product    → NamedTypeNode { name: "Product" }
   *   val items: Array<T>  → GenericTypeNode { name: "Array", args: [...] }
   */
  private parseNamedTypeNode(): TypeNode {
    const nameToken = this.advance();

    // Check for generic parameters: Array<T>, Map<K, V>, etc.
    if (this.check(TokenType.LESS_THAN)) {
      return this.parseNamedTypeWithGenerics(nameToken);
    }

    console.log(`DEBUG - [${nameToken.value}]`);
    return {
      kind: "NamedType",
      name: nameToken,
    };
  }

  /**
   * Parses a named type with generic parameters.
   * Examples:
   *   Array<int>        → GenericTypeNode { name: "Array", args: [PrimitiveTypeNode] }
   *   Map<K, V>         → GenericTypeNode { name: "Map", args: [NamedType, NamedType] }
   *   Array<Array<T>>  → GenericTypeNode { name: "Array", args: [GenericType] }
   *
   * @param {Token} typeName - The name of the type (e.g., "Array", "Map")
   * @returns {TypeNode} The parsed generic type node.
   */
  private parseNamedTypeWithGenerics(typeName: Token): TypeNode {
    this.advance(); // consume '<'

    const args: TypeNode[] = [];

    while (!this.check(TokenType.GREATER_THAN) && !this.isAtEnd()) {
      const typeArg = this.parseAnnotationType();
      if (typeArg) {
        args.push(typeArg);
      }

      if (this.check(TokenType.COMMA)) {
        this.advance(); // consume ','
      } else {
        break;
      }
    }

    if (!this.check(TokenType.GREATER_THAN)) {
      this.error("Expected '>' to close generic type", this.peek());
      return { kind: "NamedType", name: typeName };
    }

    this.advance(); // consume '>'

    const argsDebug = args
      .map((arg) => {
        if (arg.kind === "PrimitiveType") return arg.name;
        if (arg.kind === "NamedType") return arg.name.value;
        if (arg.kind === "GenericType") return `${arg.name.value}<...>`;
        return arg.kind;
      })
      .join(", ");

    console.log(`DEBUG - [${typeName.value}<${argsDebug}>]`);
    return {
      kind: "GenericType",
      name: typeName,
      args,
    };
  }

  /**
   * Parses an array type expression.
   * Examples:
   *   int[]         → ArrayTypeNode { elementType: PrimitiveType, dimensions: 1 }
   *   string[][]    → ArrayTypeNode { elementType: ArrayTypeNode, dimensions: 2 }
   *   User[]       → ArrayTypeNode { elementType: NamedType, dimensions: 1 }
   *   T[]          → ArrayTypeNode { elementType: NamedType, dimensions: 1 }
   *
   * @param {TypeNode} baseType - The base type of the array
   * @returns {TypeNode} The array type with dimensions.
   */
  private parseArrayType(baseType: TypeNode): TypeNode {
    let dimensions = 0;

    while (this.check(TokenType.LBRACKET)) {
      this.advance(); // consume '['
      if (!this.check(TokenType.RBRACKET)) {
        this.error("Expected ']' to close array type", this.peek());
        break;
      }
      this.advance(); // consume ']'
      dimensions++;
    }

    const baseTypeName =
      baseType.kind === "PrimitiveType"
        ? baseType.name
        : baseType.kind === "NamedType"
          ? baseType.name.value
          : baseType.kind === "GenericType"
            ? `${baseType.name.value}<...>`
            : baseType.kind;

    console.log(`DEBUG - [${baseTypeName}${"[]".repeat(dimensions)}]`);
    return {
      kind: "ArrayType",
      elementType: baseType,
      dimensions,
    };
  }

  /**
   * Parses a union type expression.
   * Examples:
   *   int | string      → UnionTypeNode { types: [PrimitiveType, PrimitiveType] }
   *   string | User    → UnionTypeNode { types: [PrimitiveType, NamedType] }
   *   int | string | null → UnionTypeNode { types: [PrimitiveType, PrimitiveType, PrimitiveType] }
   *
   * @param {TypeNode} firstType - O primeiro tipo já parseado
   * @returns {TypeNode} O tipo union com todos os tipos
   */
  private parseUnionType(firstType: TypeNode): TypeNode {
    const types: TypeNode[] = [firstType];

    while (this.check(TokenType.PIPE)) {
      this.advance(); // consume '|'

      // Parse next type in union
      const nextType = this.parseAnnotationType();
      if (nextType) {
        types.push(nextType);
      }
    }

    const typesDebug = types
      .map((t) => {
        if (t.kind === "PrimitiveType") return t.name;
        if (t.kind === "NamedType") return t.name.value;
        if (t.kind === "GenericType") return `${t.name.value}<...>`;
        if (t.kind === "LiteralType") return String(t.value);
        if (t.kind === "ArrayType") {
          const elemName =
            t.elementType.kind === "PrimitiveType"
              ? t.elementType.name
              : t.elementType.kind === "NamedType"
                ? t.elementType.name.value
                : t.elementType.kind;
          return `${elemName}${"[]".repeat(t.dimensions)}`;
        }
        return t.kind;
      })
      .join(" | ");

    console.log(`DEBUG - [${typesDebug}]`);
    return {
      kind: "UnionType",
      types,
    };
  }

  /**
   * Parses a tuple type expression.
   * Examples:
   *   [string, int]       → TupleTypeNode { elements: [PrimitiveType, PrimitiveType] }
   *   [string, int, bool] → TupleTypeNode { elements: [PrimitiveType, PrimitiveType, PrimitiveType] }
   *   [User, string]     → TupleTypeNode { elements: [NamedType, PrimitiveType] }
   *
   * @returns {TypeNode} The parsed tuple type node.
   */
  private parseTupleType(): TypeNode {
    this.advance(); // consume '['

    const elements: TypeNode[] = [];

    // Empty tuple: []
    if (this.check(TokenType.RBRACKET)) {
      this.advance(); // consume ']'
      console.log(`DEBUG - []`);
      return { kind: "TupleType", elements };
    }

    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      const typeArg = this.parseAnnotationType();
      if (typeArg) {
        elements.push(typeArg);
      }

      if (this.check(TokenType.COMMA)) {
        this.advance(); // consume ','
      } else {
        break;
      }
    }

    if (!this.check(TokenType.RBRACKET)) {
      this.error("Expected ']' to close tuple type", this.peek());
      return { kind: "TupleType", elements: [] };
    }

    this.advance(); // consume ']'

    const elementsDebug = elements
      .map((t) => {
        if (t.kind === "PrimitiveType") return t.name;
        if (t.kind === "NamedType") return t.name.value;
        if (t.kind === "GenericType") return `${t.name.value}<...>`;
        if (t.kind === "LiteralType") return String(t.value);
        if (t.kind === "ArrayType") {
          const elemName =
            t.elementType.kind === "PrimitiveType"
              ? t.elementType.name
              : t.elementType.kind === "NamedType"
                ? t.elementType.name.value
                : t.elementType.kind;
          return `${elemName}${"[]".repeat(t.dimensions)}`;
        }
        return t.kind;
      })
      .join(", ");

    console.log(`DEBUG - [${elementsDebug}]`);
    return {
      kind: "TupleType",
      elements,
    };
  }

  // ========================================
  // parseFunctionOrGroupingType — (int) => string ou (int | string)
  // Decide entre FunctionType e GroupingType usando lookahead
  // ========================================
  private parseFunctionOrGroupingType(): TypeNode | undefined {
    this.advance(); // consume '('

    // Caso: () => R
    if (this.check(TokenType.RPAREN)) {
      this.advance(); // consume ')'
      if (!this.check(TokenType.ARROW)) {
        this.error("Expected '=>' after '()' in type position", this.peek());
        return undefined;
      }
      this.advance(); // consume '=>'
      const returnType = this.parseAnnotationType();
      if (!returnType) {
        this.error("Expected return type after '=>'", this.peek());
        return {
          kind: "FunctionType",
          params: [],
          returnType: { kind: "PrimitiveType", name: "void" },
        };
      }
      console.log(`DEBUG - [() => ${this.getTypeNodeName(returnType)}]`);
      return { kind: "FunctionType", params: [], returnType };
    }

    // Lookahead — é FunctionType ou GroupingType?
    if (this.looksLikeFunctionTypeAnnotation()) {
      // Caso: (T, U) => R — '(' já consumido, parseia params diretamente
      const params: TypeNode[] = [];
      while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
        const param = this.parseAnnotationType();
        if (param) params.push(param);
        if (this.check(TokenType.COMMA)) this.advance();
      }
      this.consume(TokenType.RPAREN, "Expected ')' after function type params");
      this.consume(TokenType.ARROW, "Expected '=>' after function type params");
      const returnType = this.parseAnnotationType();
      if (!returnType) {
        this.error("Expected return type after '=>'", this.peek());
        return {
          kind: "FunctionType",
          params,
          returnType: { kind: "PrimitiveType", name: "void" },
        };
      }
      const paramsDebug = params.map((p) => this.getTypeNodeName(p)).join(", ");
      console.log(
        `DEBUG - [(${paramsDebug}) => ${this.getTypeNodeName(returnType)}]`,
      );
      return { kind: "FunctionType", params, returnType };
    }

    // Caso: (int | string) — GroupingType
    const innerType = this.parseAnnotationType();
    if (!innerType) {
      this.error("Expected type inside grouping", this.peek());
      return undefined;
    }
    this.consume(TokenType.RPAREN, "Expected ')' to close grouping type");

    let result: TypeNode = { kind: "GroupingType", type: innerType };
    if (this.check(TokenType.LBRACKET)) {
      result = this.parseArrayType(result);
    }
    if (this.check(TokenType.QUESTION)) {
      result = this.parseNullableSuffix(result);
    }
    if (this.check(TokenType.PIPE)) {
      return this.parseUnionType(result);
    }
    console.log(`DEBUG - [(${this.getTypeNodeName(innerType)})]`);
    return result;
  }

  // ========================================
  // looksLikeFunctionTypeAnnotation — lookahead puro, não consome nada
  // Retorna true se encontrar ')' + '=>' depois dos params
  // ========================================
  private looksLikeFunctionTypeAnnotation(): boolean {
    const saved = this.current;
    let depth = 1;

    // Acha o ')' correspondente
    while (!this.isAtEnd() && depth > 0) {
      const t = this.peek();
      if (t.type === TokenType.LPAREN) depth++;
      if (t.type === TokenType.RPAREN) depth--;
      this.advance();
    }

    // Após ')', tem '=>'?
    const hasArrow = this.check(TokenType.ARROW);
    this.current = saved; // restaura — lookahead puro
    return hasArrow;
  }

  // ========================================
  // getTypeNodeName — helper para debug
  // Retorna string representando o tipo
  // ========================================
  private getTypeNodeName(type: TypeNode): string {
    switch (type.kind) {
      case "PrimitiveType":
        return type.name;
      case "NamedType":
        return type.name.value as string;
      case "UnionType":
        return type.types.map((t) => this.getTypeNodeName(t)).join(" | ");
      case "TupleType":
        return `[${type.elements.map((t) => this.getTypeNodeName(t)).join(", ")}]`;
      case "ArrayType":
        return `${this.getTypeNodeName(type.elementType)}${"[]".repeat(type.dimensions)}`;
      case "GenericType":
        return `${type.name.value}<...>`;
      case "LiteralType":
        return String(type.value);
      case "GroupingType":
        return `(${this.getTypeNodeName(type.type)})`;
      case "FunctionType":
        return `(${type.params.map((p) => this.getTypeNodeName(p)).join(", ")}) => ${this.getTypeNodeName(type.returnType)}`;
      case "NullableType":
        return `${this.getTypeNodeName(type.type)}?`;
      default:
        return type.kind;
    }
  }

  private parseNullableSuffix(baseType: TypeNode): TypeNode {
    if (this.check(TokenType.QUESTION)) {
      this.advance();
      console.log(`DEBUG - [${this.getTypeNodeName(baseType)}?]`);
      return { kind: "NullableType", type: baseType };
    }
    return baseType;
  }

  private parseTypeSuffixes(baseType: TypeNode): TypeNode {
    if (this.check(TokenType.QUESTION)) {
      baseType = this.parseNullableSuffix(baseType);
    }
    if (this.check(TokenType.LBRACKET)) {
      baseType = this.parseArrayType(baseType);
    }
    if (this.check(TokenType.PIPE)) {
      return this.parseUnionType(baseType);
    }
    return baseType;
  }

  // ========================================
  // Protocol Statement
  // protocol Printable { func print(): void }
  // ========================================
  private parseProtocolStatement(): Stmt {
    this.advance(); // consume 'protocol'

    const nameToken = this.advance();
    if (nameToken.type !== TokenType.IDENTIFIER) {
      this.error("Expected protocol name", nameToken);
      return { kind: "BlockStmt", statements: [] };
    }

    if (this.peek().type !== TokenType.LBRACE) {
      this.error("Expected '{' after protocol name", this.peek());
      return { kind: "BlockStmt", statements: [] };
    }
    this.advance(); // consume '{'

    const methods: ProtocolMethod[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.KEYWORD) && this.peek().value === "func") {
        const method = this.parseProtocolMethod();
        if (method) {
          methods.push(method);
        }
      } else {
        this.error("Expected 'func' in protocol", this.peek());
        this.advance();
      }
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance(); // consume '}'
    } else {
      this.error("Expected '}' to close protocol", this.peek());
    }

    return {
      kind: "ProtocolStmt",
      name: nameToken,
      methods,
    };
  }

  private parseProtocolMethod(): ProtocolMethod | null {
    if (!this.check(TokenType.KEYWORD) || this.peek().value !== "func") {
      this.error("Expected 'func' in protocol method", this.peek());
      return null;
    }
    this.advance(); // consume 'func'

    const nameToken = this.advance();
    if (nameToken.type !== TokenType.IDENTIFIER) {
      this.error("Expected method name", nameToken);
      return null;
    }

    const params: FunctionStmtParam[] = [];
    if (this.check(TokenType.LPAREN)) {
      this.advance(); // consume '('
      while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
        const paramName = this.advance();
        if (paramName.type !== TokenType.IDENTIFIER) {
          this.error("Expected parameter name", paramName);
          break;
        }
        if (!this.check(TokenType.COLON)) {
          this.error("Expected ':' after parameter name", this.peek());
          break;
        }
        this.advance(); // consume ':'
        const paramType = this.parseAnnotationType();
        if (!paramType) {
          this.error("Expected parameter type", this.peek());
          break;
        }
        params.push({ name: paramName, type: paramType });

        if (this.check(TokenType.COMMA)) {
          this.advance(); // consume ','
        } else if (!this.check(TokenType.RPAREN)) {
          break;
        }
      }
      if (this.check(TokenType.RPAREN)) {
        this.advance(); // consume ')'
      }
    }

    let returnType: TypeNode | undefined;
    if (this.check(TokenType.COLON)) {
      this.advance();
      returnType = this.parseAnnotationType();
    }

    return {
      name: nameToken,
      params,
      returnType,
    };
  }
}
