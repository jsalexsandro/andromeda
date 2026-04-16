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
  typeAnnotation?: TypeAnnotation
  initializer?: Expr
}

export interface TypeAnnotation {
  base?: Token
  dimensions: number
  types?: TypeAnnotation[]
  kind?: "UnionType"
}

export interface BreakStmt {
  kind: "BreakStmt"
}

export interface ContinueStmt {
  kind: "ContinueStmt"
}

export interface FunctionStmtParam {
  name: Token
  type?: Token
  isRest?: boolean
}

export interface FunctionStmt {
  kind: "FunctionStmt"
  name: Token
  params: FunctionStmtParam[]
  returnType?: TypeAnnotation
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
  params: { name: Token; type?: Token }[]
  returnType?: Token
  body: BlockStmt
  visibility: "public" | "private" | "protected" | null
  isStatic: boolean
}

export interface ArrowFunctionExpr {
  kind: "ArrowFunction"
  params: { name: Token; type?: TypeAnnotation; isRest?: boolean }[]
  returnType?: TypeAnnotation
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
