import { Symbol } from "./types";
import { Token, TokenType } from "../lexer/types";
import {
  PrimitiveTypeNode,
  GenericTypeNode,
} from "../ast";
import {
  BUILTIN_NAMESPACES,
  BUILTIN_TYPE_ALIASES,
  BUILTIN_TYPES,
  BUILTIN_VALUES,
  builtinAliasType,
  builtinNamespaceType,
  builtinTypeNode,
  builtinValueType,
  typeParameterNode,
} from "../builtins";
import type { PrimitiveTypes } from "../types";

export class Environment {
  private symbols: Map<string, Symbol> = new Map();
  public parent: Environment | null = null;
  public readonly isGlobal: boolean;

  constructor(parent: Environment | null = null, isGlobal: boolean = false) {
    this.parent = parent;
    this.isGlobal = isGlobal;

    if (isGlobal) {
      this.definePrimitives();
    }
  }

  private definePrimitives() {
    const primitives: PrimitiveTypes[] = [
      "int",
      "float",
      "string",
      "bool",
      "void",
      "null",
      "any",
      "unknown",
    ];

    for (const name of primitives) {
      const typeNode: PrimitiveTypeNode = {
        kind: "PrimitiveType",
        name,
      };
      this.symbols.set(name, {
        name,
        type: typeNode,
        kind: "type",
        mutable: false,
        initialized: true,
      });
    }

    this.defineBuiltinTypes();
    this.defineBuiltinValues();
    this.defineBuiltinNamespaces();
    this.defineBuiltinAliases();
  }

  private defineBuiltinNamespaces() {
    for (const name of BUILTIN_NAMESPACES) {
      this.symbols.set(name, {
        name,
        type: builtinNamespaceType(name),
        kind: "builtin",
        mutable: false,
        initialized: true,
      });
    }
  }

  private defineBuiltinAliases() {
    for (const alias of BUILTIN_TYPE_ALIASES) {
      this.symbols.set(alias.name, {
        name: alias.name,
        type: builtinAliasType(alias),
        kind: "builtin",
        mutable: false,
        initialized: true,
      });
    }
  }

  private defineBuiltinTypes() {
    for (const builtin of BUILTIN_TYPES) {
      this.symbols.set(builtin.name, {
        name: builtin.name,
        type: builtinTypeNode(builtin) as GenericTypeNode,
        kind: "builtin",
        mutable: false,
        initialized: true,
        typeParameters: builtin.typeParameters.map(typeParameterNode),
      });
    }
  }

  private defineBuiltinValues() {
    for (const builtin of BUILTIN_VALUES) {
      this.symbols.set(builtin.name, {
        name: builtin.name,
        type: builtinValueType(builtin),
        kind: "builtin",
        mutable: false,
        initialized: true,
      });
    }
  }

  public define(name: string, symbol: Symbol): void {
    const existing = this.symbols.get(name);
    if (existing && existing.kind !== "builtin") {
      return;
    }
    this.symbols.set(name, symbol);
  }

  public lookup(name: string): Symbol | null {
    const symbol = this.symbols.get(name);
    if (symbol) {
      return symbol;
    }
    if (this.parent) {
      return this.parent.lookup(name);
    }
    return null;
  }

  public lookupLocal(name: string): Symbol | null {
    return this.symbols.get(name) || null;
  }

  public resolve(name: string): Symbol | null {
    return this.lookup(name);
  }

  public assign(name: string, value: unknown): boolean {
    const symbol = this.lookup(name);
    if (!symbol) {
      return false;
    }
    if (!symbol.mutable) {
      return false;
    }
    symbol.initialized = true;
    return true;
  }

  public getAllSymbols(): Symbol[] {
    return Array.from(this.symbols.values());
  }

  public getSymbolCount(): number {
    return this.symbols.size + (this.parent ? this.parent.getSymbolCount() : 0);
  }
}

export function createSymbolForToken(
  name: string,
  type: ReturnType<typeof import("../ast")["TypeNode"]>,
  kind: Symbol["kind"],
  mutable: boolean,
  token?: Token
): Symbol {
  return {
    name,
    type: type as Symbol["type"],
    kind,
    mutable,
    initialized: !mutable,
    declarationToken: token,
  };
}