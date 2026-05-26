import { Token } from "../lexer/types";
import { TypeNode, TypeParameterNode, StructField } from "../ast";

export type SymbolKind = "variable" | "function" | "type" | "struct" | "enum" | "protocol" | "parameter" | "typeParam" | "builtin";

export interface Symbol {
  name: string;
  type: TypeNode;
  kind: SymbolKind;
  mutable: boolean;
  initialized: boolean;
  declarationToken?: Token;
  constraint?: TypeNode;
  typeParameters?: TypeParameterNode[];
  fields?: StructField[];
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