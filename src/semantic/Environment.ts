import { Symbol } from "./types";
import { Token } from "../lexer/types";
import {
  PrimitiveTypeNode,
  NamedTypeNode,
  GenericTypeNode,
  FunctionTypeNode,
  ArrayTypeNode,
} from "../ast";
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
  }

  private defineBuiltinTypes() {
    const anyType: PrimitiveTypeNode = { kind: "PrimitiveType", name: "any" };
    const intType: PrimitiveTypeNode = { kind: "PrimitiveType", name: "int" };
    const stringType: PrimitiveTypeNode = { kind: "PrimitiveType", name: "string" };
    const boolType: PrimitiveTypeNode = { kind: "PrimitiveType", name: "bool" };
    const voidType: PrimitiveTypeNode = { kind: "PrimitiveType", name: "void" };

    const arrayType = (elementType: PrimitiveTypeNode): ArrayTypeNode => ({
      kind: "ArrayType",
      elementType,
      dimensions: 1,
    });

    const functionType = (
      params: PrimitiveTypeNode[],
      returnType: PrimitiveTypeNode
    ): FunctionTypeNode => ({
      kind: "FunctionType",
      params,
      returnType,
    });

    const printFnType: FunctionTypeNode = functionType([stringType], voidType);
    const printlnFnType: FunctionTypeNode = functionType([stringType], voidType);
    const intToStringFnType: FunctionTypeNode = functionType([intType], stringType);
    const stringToIntFnType: FunctionTypeNode = functionType([stringType], intType);
    const toStringFnType: FunctionTypeNode = functionType([anyType], stringType);
    const lenFnType: FunctionTypeNode = functionType([anyType], intType);
    const readLineFnType: FunctionTypeNode = functionType([], stringType);

    this.symbols.set("print", {
      name: "print",
      type: printFnType,
      kind: "function",
      mutable: false,
      initialized: true,
    });

    this.symbols.set("println", {
      name: "println",
      type: printlnFnType,
      kind: "function",
      mutable: false,
      initialized: true,
    });

    this.symbols.set("toString", {
      name: "toString",
      type: toStringFnType,
      kind: "function",
      mutable: false,
      initialized: true,
    });

    this.symbols.set("len", {
      name: "len",
      type: lenFnType,
      kind: "function",
      mutable: false,
      initialized: true,
    });

    this.symbols.set("readLine", {
      name: "readLine",
      type: readLineFnType,
      kind: "function",
      mutable: false,
      initialized: true,
    });
  }

  public define(name: string, symbol: Symbol): void {
    if (this.symbols.has(name)) {
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