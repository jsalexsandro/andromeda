import { Token } from "./lexer"
import type { PrimitiveTypes } from "./types"

export type Expr =
  | BinaryExpr
  | LiteralExpr
  | GroupExpr
  | UnaryExpr
  | LogicalExpr
  | IdentifierExpr
  | ThisExpr
  | SuperExpr
  | NewExpr
  | AssignExpr
  | CallExpr
  | ArrayExpr
  | MemberExpr
  | IndexExpr
  | IcexElement
  | ConditionalExpr
  | ObjectExpr
  | NullishCoalescingExpr
  | ClassExpr
  | ArrowFunctionExpr
  | TemplateLiteralExpr
  | AwaitExpr
  | SpreadExpr

export interface BinaryExpr {
  kind: "Binary"
  left: Expr
  operator: Token
  right: Expr
}

export interface LiteralExpr {
  kind: "Literal"
  value: any
}

export interface GroupExpr {
  kind: "Group"
  expression: Expr
}

export interface UnaryExpr {
  kind: "Unary"
  operator: Token
  right: Expr
}

export interface LogicalExpr {
  kind: "Logical"
  left: Expr
  operator: Token
  right: Expr
}

export interface IdentifierExpr {
  kind: "Identifier"
  name: Token
}

export interface ThisExpr {
  kind: "This"
}

export interface SuperExpr {
  kind: "Super"
}

export interface NewExpr {
  kind: "New"
  callee: Expr
  args: Expr[]
}

export interface AssignExpr {
  kind: "Assign"
  name: Expr
  value: Expr
  operator?: Token
}

export interface CallExpr {
  kind: "Call"
  callee: Expr
  args: Expr[]
}

export interface ArrayExpr {
  kind: "Array"
  elements: Expr[]
}

export interface ObjectExpr {
  kind: "Object"
  properties: { key: string | null; value: Expr }[]
}

export interface MemberExpr {
  kind: "Member"
  object: Expr
  property: IdentifierExpr
}

export interface IndexExpr {
  kind: "Index"
  object: Expr
  index: Expr
}

export type Stmt =
  | ExpressionStmt
  | BlockStmt
  | IfStmt
  | VariableStmt
  | WhileStmt
  | ForStmt
  | BreakStmt
  | ContinueStmt
  | FunctionStmt
  | ReturnStmt
  | ImportStmt
  | ExportStmt
  | TypeAliasStmt   // ← Fase 3
  | StructStmt      // ← Fase 4
  | EnumStmt        // ← Fase 5
  | ProtocolStmt    // ← Fase 6
  | ModelStmt       // [model] - Tipos nomeados (nominal)

export interface ExpressionStmt {
  kind: "ExpressionStmt"
  expression: Expr
}

export interface BlockStmt {
  kind: "BlockStmt"
  statements: Stmt[]
}

export interface IfStmt {
  kind: "IfStmt"
  condition: Expr
  thenBranch: Stmt
  elseBranch?: Stmt
}

export interface WhileStmt {
  kind: "WhileStmt"
  condition: Expr
  body: Stmt
}

export interface ForStmt {
  kind: "ForStmt"
  initializer: Stmt | null
  condition: Expr
  update: Expr
  body: Stmt
}

export interface VariableStmt {
  kind: "VariableStmt"
  declarationType: "var" | "val" | "const"
  name: Token
  type?: TypeNode
  initializer?: Expr
}

export interface BreakStmt {
  kind: "BreakStmt"
}

export interface ContinueStmt {
  kind: "ContinueStmt"
}

export interface FunctionStmtParam {
  name: Token
  type?: TypeNode
  isRest?: boolean
  isOptional?: boolean
}

export interface FunctionStmt {
  kind: "FunctionStmt"
  name: Token
  params: FunctionStmtParam[]
  body: BlockStmt
  async?: boolean
  returnType?: TypeNode
}

export interface ReturnStmt {
  kind: "ReturnStmt"
  value?: Expr
}

export interface ConditionalExpr {
  kind: "Conditional"
  condition: Expr
  consequent: Expr
  alternate: Expr
}

export interface NullishCoalescingExpr {
  kind: "NullishCoalescing"
  left: Expr
  right: Expr
}

export interface IcexElement {
  kind: "IcexElement"
  tag: string
  attributes: IcexAttribute[]
  children: IcexChild[]
  isSelfClosing: boolean
}

export interface IcexAttribute {
  name: string
  value: Expr | string | boolean
}

export type IcexChild = IcexElement | IcexText | IcexExpression

export interface IcexText {
  kind: "IcexText"
  value: string
}

export interface IcexExpression {
  kind: "IcexExpression"
  expression: Expr
}

export interface ClassExpr {
  kind: "Class"
  name: string
  extends?: string
  properties: ClassProperty[]
  methods: ClassMethod[]
}

export interface ClassProperty {
  name: string
  type?: Token
  visibility: "public" | "private" | "protected" | null
  isStatic: boolean
  initializer?: Expr
}

export interface ClassMethod {
  name: string
  params: { name: Token }[]
  body: BlockStmt
  visibility: "public" | "private" | "protected" | null
  isStatic: boolean
}

export interface ArrowFunctionExpr {
  kind: "ArrowFunction"
  params: { name: Token; isRest?: boolean; type?: TypeNode }[]
  body: Expr | Stmt
  async?: boolean
  returnType?: TypeNode
}

export interface TemplateLiteralExpr {
  kind: "TemplateLiteral"
  quasis: string[]
  expressions: (string | null)[]
}

export interface ImportSpecifier {
  kind: "ImportSpecifier"
  name: string
  alias?: string
}

export interface ImportStmt {
  kind: "ImportStmt"
  source: string
  specifiers?: ImportSpecifier[]
  alias?: string
}

export interface ExportSpecifier {
  kind: "ExportSpecifier"
  name: string
  alias?: string
}

export interface ExportStmt {
  kind: "ExportStmt"
  specifiers?: ExportSpecifier[]
}

export interface AwaitExpr {
  kind: "Await"
  expression: Expr
}

export interface SpreadExpr {
  kind: "Spread"
  argument: Expr
}



// ========================================
// TypeNode - AST de Tipos Nominal
// (Swift / Kotlin / Rust style)
// ========================================

export type TypeNode =
  | PrimitiveTypeNode
  | NamedTypeNode
  | GenericTypeNode
  | ArrayTypeNode
  | NullableTypeNode
  | TupleTypeNode
  | FunctionTypeNode
  | UnionTypeNode
  | LiteralTypeNode
  | GroupingTypeNode

// int, float, string, bool, void, null, any, unknown
export interface PrimitiveTypeNode {
  kind: "PrimitiveType"
  name: PrimitiveTypes
}

// User, Product, Status — tipos com nome
export interface NamedTypeNode {
  kind: "NamedType"
  name: Token
}

// List<T>, Map<K, V>, Promise<User>
export interface GenericTypeNode {
  kind: "GenericType"
  name: Token
  args: TypeNode[]
}

// 3.14, "active", 200, true — literal types
export interface LiteralTypeNode {
  kind: "LiteralType"
  value: string | number | boolean
}

// T[], string[], User[]
export interface ArrayTypeNode {
  kind: "ArrayType"
  elementType: TypeNode
  dimensions: number
}

// T? — nullable, açúcar pra T | null
export interface NullableTypeNode {
  kind: "NullableType"
  type: TypeNode
}

// ========================================
// GroupingType — (int | string)
// Agrupamento de tipos com parênteses
// Útil para precedência: (int | string)[] vs int | string[]
// ========================================
export interface GroupingTypeNode {
  kind: "GroupingType"
  type: TypeNode
}

// [T, U, V] — tuple
export interface TupleTypeNode {
  kind: "TupleType"
  elements: TypeNode[]
}

// (T, U) => V — function type anônimo
export interface FunctionTypeNode {
  kind: "FunctionType"
  params: TypeNode[]
  returnType: TypeNode
}

// T | U | null — union
export interface UnionTypeNode {
  kind: "UnionType"
  types: TypeNode[]
}

// ========================================
// TypeParameterNode — generics em funções/structs
// func f<T extends Comparable, U = string>()
// ========================================

export interface TypeParameterNode {
  kind: "TypeParameter"
  name: Token
  constraint?: TypeNode   // T extends Comparable
  default?: TypeNode      // T = string
}

// ========================================
// Statements de Tipo Nominal (Fases 3-7)
// ========================================

// Fase 3 — type alias
// type UserId = int
// type Handler = (Request) => Response
export interface TypeAliasStmt {
  kind: "TypeAliasStmt"
  name: Token
  typeParameters?: TypeParameterNode[]
  type: TypeNode
}

// Fase 4 — struct
// struct User { id: int; name: string }
export interface StructStmt {
  kind: "StructStmt"
  name: Token
  typeParameters?: TypeParameterNode[]
  fields: StructField[]
  protocols?: Token[]     // implements Printable, Comparable
}

export interface StructField {
  name: Token
  type: TypeNode
  mutable: boolean        // var vs val
  defaultValue?: Expr
}

// Fase 5 — enum
// enum Status { Active; Inactive; Pending(string) }
export interface EnumStmt {
  kind: "EnumStmt"
  name: Token
  typeParameters?: TypeParameterNode[]
  variants: EnumVariant[]
}

export interface EnumVariant {
  name: Token
  payload?: TypeNode[]    // Ok(T), Err(string) — sem payload = unit variant
}

// Fase 6 — protocol
// protocol Printable { func print(): void }
export interface ProtocolStmt {
  kind: "ProtocolStmt"
  name: Token
  typeParameters?: TypeParameterNode[]
  methods: ProtocolMethod[]
}

export interface ProtocolMethod {
  name: Token
  params: FunctionStmtParam[]
  returnType?: TypeNode
}

// [model] - Tipos nomeados (nominal type aliases)
// Syntax: model Name = type
// Ex: model Callable = (int) => int
export interface ModelStmt {
  kind: "ModelStmt"
  name: Token
  type: TypeNode
}