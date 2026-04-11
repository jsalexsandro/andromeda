import { TokenType } from '../lexer/types'

export enum Precedence {
  LOWEST = 1,
  ASSIGN,      // =
  CONDITIONAL, // ?:
  NULLISH,     // ??
  OR,          // ||
  AND,         // &&
  EQUALS,      // == !=
  LESSGREATER, // > < >= <=
  SUM,         // + -
  PRODUCT,     // * / %
  PREFIX,      // -X !X
  CALL,        // myFunction(X)
  INDEX,       // array[index]
  MEMBER       // obj.property
}

export const TokenPrecedence: Record<string, Precedence> = {
  [TokenType.ASSIGN]: Precedence.ASSIGN,
  [TokenType.QUESTION]: Precedence.CONDITIONAL,
  [TokenType.QUESTION_QUESTION]: Precedence.NULLISH,
  [TokenType.OR]: Precedence.OR,
  [TokenType.AND]: Precedence.AND,
  [TokenType.EQUAL]: Precedence.EQUALS,
  [TokenType.NOT_EQUAL]: Precedence.EQUALS,
  [TokenType.LESS_THAN]: Precedence.LESSGREATER,
  [TokenType.GREATER_THAN]: Precedence.LESSGREATER,
  [TokenType.LESS_EQUAL]: Precedence.LESSGREATER,
  [TokenType.GREATER_EQUAL]: Precedence.LESSGREATER,
  [TokenType.PLUS]: Precedence.SUM,
  [TokenType.MINUS]: Precedence.SUM,
  [TokenType.STAR]: Precedence.PRODUCT,
  [TokenType.SLASH]: Precedence.PRODUCT,
  [TokenType.MODULO]: Precedence.PRODUCT,
  [TokenType.LPAREN]: Precedence.CALL,
  [TokenType.LBRACKET]: Precedence.INDEX,
  [TokenType.DOT]: Precedence.MEMBER,
}

export function getPrecedence(type: TokenType): Precedence {
  return TokenPrecedence[type] || Precedence.LOWEST
}
