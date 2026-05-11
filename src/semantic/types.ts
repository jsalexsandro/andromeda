import { Token } from "../lexer/types";
import { TypeNode } from "../ast";

export type SymbolKind = "variable" | "function" | "type" | "struct" | "enum" | "protocol" | "parameter" | "typeParam";

export interface Symbol {
  name: string;
  type: TypeNode;
  kind: SymbolKind;
  mutable: boolean;
  initialized: boolean;
  declarationToken?: Token;
  constraint?: TypeNode;
}

export function createSymbol(
  name: string,
  type: TypeNode,
  kind: SymbolKind,
  mutable: boolean,
  declarationToken?: Token
): Symbol {
  return {
    name,
    type,
    kind,
    mutable,
    initialized: mutable || kind === "const",
    declarationToken,
  };
}