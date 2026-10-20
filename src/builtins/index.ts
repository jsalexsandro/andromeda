import {
  ArrayTypeNode,
  FunctionTypeNode,
  GenericTypeNode,
  PrimitiveTypeNode,
  TypeNode,
  TypeParameterNode,
} from "../ast";
import { Token, TokenType } from "../lexer/types";

export type BuiltinParam = TypeNode & { paramName?: string; isRest?: boolean };

export interface BuiltinValue {
  /** Nome visível na linguagem Andromeda */
  name: string;
  /** Nome do símbolo no JavaScript gerado */
  jsName: string;
  params: BuiltinParam[];
  returnType: TypeNode;
  summary: string;
}

export interface BuiltinType {
  name: string;
  typeParameters: string[];
}

export interface BuiltinProtocol {
  name: string;
  methods: { name: string; params: BuiltinParam[]; returnType: TypeNode }[];
}

/**
 * Alias global de primitivo. Transparente: `Integer` E `int`, e
 * intercambiavel nos dois sentidos. Diferente de `typealias` escrito pelo
 * usuario — aqui nao ha boilerplate e o nome vale em todo programa.
 */
export interface BuiltinTypeAlias {
  name: string;
  target: PrimitiveTypeNode["name"];
}

const ident = (value: string): Token => ({
  type: TokenType.IDENTIFIER,
  value,
  line: 0,
  column: 0,
});

export { ident };

const primitive = (name: PrimitiveTypeNode["name"]): PrimitiveTypeNode => ({
  kind: "PrimitiveType",
  name,
});

export const voidType = primitive("void");
export const anyType = primitive("any");

const anyArray: ArrayTypeNode = {
  kind: "ArrayType",
  elementType: anyType,
  dimensions: 1,
};

const fn = (
  params: BuiltinParam[],
  returnType: TypeNode
): FunctionTypeNode => ({ kind: "FunctionType", params, returnType });

// ============================================================
// Builtins de valor — disponíveis em qualquer escopo
// ============================================================

export const BUILTIN_VALUES: BuiltinValue[] = [
  {
    name: "print",
    jsName: "AndromedaAPI.print",
    params: [{ ...anyArray, paramName: "values", isRest: true }],
    returnType: voidType,
    summary:
      "Escreve os argumentos em stdout separados por um espaco, sempre seguido de quebra de linha.",
  },
];

// ============================================================
// Builtins de tipo — generics prontos
// ============================================================

export const BUILTIN_TYPES: BuiltinType[] = [
  { name: "Array", typeParameters: ["T"] },
  { name: "Optional", typeParameters: ["T"] },
];

// ============================================================
// Builtin Protocols
// ============================================================

export const BUILTIN_PROTOCOLS: BuiltinProtocol[] = [
  {
    name: "Stringable",
    methods: [
      { name: "toString", params: [], returnType: primitive("string") },
    ],
  },
];

// ============================================================
// Namespaces do runtime
//
// `AndromedaAPI` e o unico global emitido pelo runtime. Fica reservado
// aqui para que um `val AndromedaAPI = ...` do usuario nao colida com a
// declaracao no JavaScript gerado.
// ============================================================

export const BUILTIN_NAMESPACES: string[] = ["AndromedaAPI", "$ext"];

/** Tipo de um namespace: objeto, logo chamar emite INVALID_CALL. */
export function builtinNamespaceType(name: string): TypeNode {
  return { kind: "Object", properties: [] };
}

// ============================================================
// Aliases globais de primitivos
//
// Registrados com kind "builtin", por isso caem no
// CANNOT_REDEFINE_BUILTIN sem precisar mexer nos guards de declaracao.
// resolveAlias expande porque o type do simbolo E um primitivo.
// ============================================================

export const BUILTIN_TYPE_ALIASES: BuiltinTypeAlias[] = [
  { name: "Integer", target: "int" },
  { name: "Float", target: "float" },
  { name: "String", target: "string" },
  { name: "Boolean", target: "bool" },
  { name: "Void", target: "void" },
  { name: "Null", target: "null" },
  { name: "Any", target: "any" },
  { name: "Unknown", target: "unknown" },
];

export function builtinAliasType(alias: BuiltinTypeAlias): PrimitiveTypeNode {
  return primitive(alias.target);
}

const valueByName = new Map(BUILTIN_VALUES.map((b) => [b.name, b]));

export function isBuiltinValue(name: string): boolean {
  return valueByName.has(name);
}

export function getBuiltinValue(name: string): BuiltinValue | null {
  return valueByName.get(name) ?? null;
}

export function builtinValueType(builtin: BuiltinValue): FunctionTypeNode {
  return fn(builtin.params, builtin.returnType);
}

export function builtinTypeNode(builtin: BuiltinType): GenericTypeNode {
  return {
    kind: "GenericType",
    name: ident(builtin.name),
    args: [],
  };
}

export function typeParameterNode(name: string): TypeParameterNode {
  return { kind: "TypeParameter", name: ident(name) };
}