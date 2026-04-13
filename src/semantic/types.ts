import { Expr, Stmt } from "../ast"

export enum TypeKind {
  Int = "int",
  Float = "float",
  String = "string",
  Bool = "bool",
  Null = "null",
  Void = "void",
  Any = "any",
  Unknown = "unknown",
}

export interface PrimitiveType {
  kind: "primitive"
  type: TypeKind
}

export interface ArrayType {
  kind: "array"
  elementType: AndroType
}

export interface FunctionType {
  kind: "function"
  params: AndroType[]
  returnType: AndroType
}

export interface ClassType {
  kind: "class"
  name: string
  fields: Map<string, AndroType>
  methods: Map<string, FunctionType>
}

export type AndroType = PrimitiveType | ArrayType | FunctionType | ClassType

export const Primitive = {
  int: (): PrimitiveType => ({ kind: "primitive", type: TypeKind.Int }),
  float: (): PrimitiveType => ({ kind: "primitive", type: TypeKind.Float }),
  string: (): PrimitiveType => ({ kind: "primitive", type: TypeKind.String }),
  bool: (): PrimitiveType => ({ kind: "primitive", type: TypeKind.Bool }),
  null: (): PrimitiveType => ({ kind: "primitive", type: TypeKind.Null }),
  void: (): PrimitiveType => ({ kind: "primitive", type: TypeKind.Void }),
  any: (): PrimitiveType => ({ kind: "primitive", type: TypeKind.Any }),
  unknown: (): PrimitiveType => ({ kind: "primitive", type: TypeKind.Unknown }),
}

export const Array = {
  of: (elementType: AndroType): ArrayType => ({
    kind: "array",
    elementType,
  }),
}

export const Function = {
  create: (params: AndroType[], returnType: AndroType): FunctionType => ({
    kind: "function",
    params,
    returnType,
  }),
}

export const Class = {
  create: (name: string): ClassType => ({
    kind: "class",
    name,
    fields: new Map(),
    methods: new Map(),
  }),
}

export enum SymbolKind {
  Variable = "variable",
  Function = "function",
  Class = "class",
  Param = "param",
  Property = "property",
  Type = "type",
}

export interface SymbolDefinition {
  name: string
  type: AndroType
  kind: SymbolKind
  mutable: boolean
  declarationType: "var" | "val" | "const"
  ast: Expr | Stmt
  line: number
  column: number
}
