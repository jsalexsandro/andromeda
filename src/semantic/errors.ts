import { Token } from "../lexer/types";

export type SemanticPhase = "scope" | "typecheck" | "analysis";

export type ErrorCode =
  | "UNDEFINED_VARIABLE"
  | "ALREADY_DECLARED"
  | "TYPE_MISMATCH"
  | "VAL_REQUIRES_TYPE"
  | "INVALID_OPERATION"
  | "INVALID_BREAK"
  | "CANNOT_ASSIGN"
  | "INVALID_INDEX"
  | "INVALID_ASSIGNMENT"
  | "INVALID_MEMBER_ACCESS"
  | "UNKNOWN_PROPERTY"
  | "INVALID_SPREAD"
  | "ARGUMENT_COUNT_MISMATCH"
  | "INVALID_CALL"
  | "MISSING_RETURN"
  | "INVALID_RETURN"
  | "INVALID_CONTINUE"
  | "UNDEFINED_TYPE"
  | "INVALID_UNARY"
  | "REST_NOT_LAST"
  | "INVALID_RETURN_TYPE";

export class SemanticError {
  constructor(
    public message: string,
    public token: Token,
    public phase: SemanticPhase,
    public code: ErrorCode
  ) {}

  public render(): string {
    const line = this.token?.line ?? 0;
    const col = this.token?.column ?? 0;
    return `[${this.code}] Line ${line}, Col ${col}: ${this.message}`;
  }
}

export function createError(
  code: ErrorCode,
  message: string,
  token: Token,
  phase: SemanticPhase
): SemanticError {
  return new SemanticError(message, token, phase, code);
}

export const Errors = {
  undefinedVariable: (name: string, token: Token) =>
    createError("UNDEFINED_VARIABLE", `'${name}' is not declared`, token, "scope"),

  alreadyDeclared: (name: string, token: Token) =>
    createError("ALREADY_DECLARED", `'${name}' is already declared`, token, "scope"),

  typeMismatch: (message: string, token: Token) =>
    createError("TYPE_MISMATCH", message, token, "typecheck"),

  valRequiresType: (name: string, token: Token) =>
    createError("VAL_REQUIRES_TYPE", `'val' requires type annotation`, token, "typecheck"),

  invalidOperation: (message: string, token: Token) =>
    createError("INVALID_OPERATION", message, token, "analysis"),

  invalidBreak: (token: Token) =>
    createError("INVALID_BREAK", "'break' can only be used inside a loop", token, "analysis"),

  cannotAssign: (name: string, token: Token) =>
    createError("CANNOT_ASSIGN", `cannot assign to '${name}'`, token, "typecheck"),

  invalidIndex: (message: string, token: Token) =>
    createError("INVALID_INDEX", message, token, "typecheck"),

  invalidAssignment: (message: string, token: Token) =>
    createError("INVALID_ASSIGNMENT", message, token, "typecheck"),

  invalidMemberAccess: (message: string, token: Token) =>
    createError("INVALID_MEMBER_ACCESS", message, token, "typecheck"),

  unknownProperty: (name: string, token: Token) =>
    createError("UNKNOWN_PROPERTY", `property '${name}' does not exist`, token, "typecheck"),

  invalidSpread: (token: Token) =>
    createError("INVALID_SPREAD", "cannot spread non-array/non-object type", token, "typecheck"),

  argumentCountMismatch: (expected: number, got: number, token: Token) =>
    createError("ARGUMENT_COUNT_MISMATCH", `expected ${expected} arguments, got ${got}`, token, "typecheck"),

  invalidCall: (token: Token) =>
    createError("INVALID_CALL", "cannot call non-function type", token, "typecheck"),

  missingReturn: (token: Token) =>
    createError("MISSING_RETURN", "function does not return a value", token, "typecheck"),

  invalidReturn: (token: Token) =>
    createError("INVALID_RETURN", "'return' can only be used inside a function", token, "analysis"),

  invalidContinue: (token: Token) =>
    createError("INVALID_CONTINUE", "'continue' can only be used inside a loop", token, "analysis"),

  undefinedType: (name: string, token: Token) =>
    createError("UNDEFINED_TYPE", `type '${name}' is not found`, token, "typecheck"),

  invalidUnary: (operator: string, token: Token) =>
    createError("INVALID_UNARY", `unary operator '${operator}' is invalid for the operand`, token, "typecheck"),

  restNotLast: (token: Token) =>
    createError("REST_NOT_LAST", "rest parameter must be the last parameter", token, "analysis"),

  invalidReturnType: (expected: string, got: string, token: Token) =>
    createError("INVALID_RETURN_TYPE", `return type mismatch: expected '${expected}', got '${got}'`, token, "typecheck"),
};