import { Token } from "./lexer"

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
  isOptional?: boolean
  isRest?: boolean
}

export interface FunctionStmt {
  kind: "FunctionStmt"
  name: Token
  typeParameters?: TypeNode[]
  params: FunctionStmtParam[]
  returnType?: TypeNode
  body: BlockStmt
  async?: boolean
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
  params: { name: Token; type?: TypeNode; isOptional?: boolean; isRest?: boolean }[]
  returnType?: TypeNode
  body: Expr | Stmt
  async?: boolean
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
// TypeNode - AST de Tipos (igual TypeScript)
// ========================================

export type TypeNode =
  | IntTypeNode
  | FloatTypeNode
  | StringTypeNode
  | BoolTypeNode
  | UndefinedTypeNode
  | NullTypeNode
  | VoidTypeNode
  | AnyTypeNode
  | UnknownTypeNode
  | ObjectTypeNode
  | TypeReference
  | ArrayTypeNode
  | TupleTypeNode
  | UnionTypeNode
  | IntersectionTypeNode
  | FunctionTypeNode
  | ObjectLiteralTypeNode
  | ParenthesizedTypeNode
  | TypeOperatorNode
  | TypePredicateNode
  | TypeQueryNode
  | ConditionalTypeNode
  | TypeParameterNode
  | MappedTypeNode
  | IndexedAccessTypeNode
  | ImportTypeNode

export interface IntTypeNode {
  kind: "IntType"
}

export interface FloatTypeNode {
  kind: "FloatType"
}

export interface StringTypeNode {
  kind: "StringType"
}

export interface BoolTypeNode {
  kind: "BoolType"
}

export interface UndefinedTypeNode {
  kind: "UndefinedType"
}

export interface NullTypeNode {
  kind: "NullType"
}

export interface VoidTypeNode {
  kind: "VoidType"
}

export interface AnyTypeNode {
  kind: "AnyType"
}

export interface UnknownTypeNode {
  kind: "UnknownType"
}

export interface ObjectTypeNode {
  kind: "ObjectType"
}

export interface TypeReference {
  kind: "TypeReference"
  typeName: Token
  typeArguments?: TypeNode[]
}

export interface ArrayTypeNode {
  kind: "ArrayType"
  elementType: TypeNode
  degrees: number
}

export interface TupleTypeNode {
  kind: "TupleType"
  elements: TupleTypeElement[]
}

export interface TupleTypeElement {
  name?: string
  type: TypeNode
  isOptional?: boolean
  isRest?: boolean
}

export interface UnionTypeNode {
  kind: "UnionType"
  types: TypeNode[]
}

export interface IntersectionTypeNode {
  kind: "IntersectionType"
  types: TypeNode[]
}

export interface FunctionTypeNode {
  kind: "FunctionType"
  parameters: FunctionParameter[]
  returnType: TypeNode
}

export interface FunctionParameter {
  name: Token
  type: TypeNode
  isOptional?: boolean
  isRest?: boolean
}

export interface ObjectLiteralTypeNode {
  kind: "ObjectLiteralType"
  members: TypeElement[]
}

export interface TypeElement {
  name: string
  type: TypeNode
  isOptional?: boolean
  isReadonly?: boolean
  isIndexSignature?: boolean
  keyType?: TypeNode
}

export interface ParenthesizedTypeNode {
  kind: "ParenthesizedType"
  type: TypeNode
}

export interface TypeOperatorNode {
  kind: "TypeOperator"
  operator: "keyof" | "readonly" | "unique"
  type: TypeNode
}

export interface TypePredicateNode {
  kind: "TypePredicate"
  parameterName: Token
  type?: TypeNode
}

export interface TypeQueryNode {
  kind: "TypeQuery"
  typeName: Token
}

export interface ConditionalTypeNode {
  kind: "ConditionalType"
  checkType: TypeNode
  extendsType: TypeNode
  trueType: TypeNode
  falseType: TypeNode
}

export interface TypeParameterNode {
  kind: "TypeParameter"
  name: Token
  constraint?: TypeNode
  default?: TypeNode
}

export interface MappedTypeNode {
  kind: "MappedType"
  typeParameter: TypeParameterNode
  type?: TypeNode
  isReadonly?: boolean
  isOptional?: boolean
}

export interface IndexedAccessTypeNode {
  kind: "IndexedAccessType"
  objectType: TypeNode
  indexType: TypeNode
}

export interface ImportTypeNode {
  kind: "ImportType"
  path: Token
  qualifier?: Token
}
