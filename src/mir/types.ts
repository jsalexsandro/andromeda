// ════════════════════════════════════════════════════════════════
// MIR — Mid-level Intermediate Representation
//
// SRCO:
//   AST (com tipos) → MIR → IR (Low IR) → JS / Bytecode
//
// MIR é uma representação linear por função:
//   - Expressões viram temporários (t0, t1, ...)
//   - Controle de fluxo é explícito via label + jump + jumpIf
//   - Structs e arrays têm operações de alto nível (field, index)
// ════════════════════════════════════════════════════════════════


// ─── Binary / Unary ops ───────────────────────────────────────

export type BinaryOp =
  | "add" | "sub" | "mul" | "div" | "mod"
  | "eq"  | "ne"  | "lt"  | "gt"  | "le"  | "ge"
  | "and" | "or"

export type UnaryOp = "neg" | "not"


// ─── Valores constantes ───────────────────────────────────────

export type IRValue =
  | { kind: "int";    value: number }
  | { kind: "float";  value: number }
  | { kind: "string"; value: string }
  | { kind: "bool";   value: boolean }
  | { kind: "null" }


// ─── Instruções MIR ───────────────────────────────────────────

export type MIRInstruction =
  // Valores
  | { op: "const";    dest: string; value: IRValue }
  | { op: "copy";     dest: string; src: string }

  // Operações
  | { op: "binary";   dest: string; left: string; operator: BinaryOp; right: string }
  | { op: "unary";    dest: string; operator: UnaryOp; operand: string }

  // Controle de fluxo
  | { op: "block";    name: string }
  | { op: "jump";     label: string }
  | { op: "jumpIf";   cond: string; then: string; else: string }
  | { op: "return";   value: string | IRValue | null }
  | { op: "phi";      dest: string; pairs: { block: string; value: string }[] }

  // Null checks
  | { op: "notNull";  dest: string; src: string }

  // Funções
  | { op: "call";         dest: string; callee: string; args: string[] }
  | { op: "callIndirect"; dest: string; callee: string; args: string[] }
  | { op: "callNamed";    dest: string; callee: string; args: { name: string; value: string }[] }

  // Closures
  | { op: "makeClosure";  dest: string; callee: string; cells: string[] }
  | { op: "callClosure";  dest: string; closure: string; args: string[] }

  // Structs
  | { op: "alloc";     dest: string; structName: string }
  | { op: "getField";  dest: string; object: string; field: string }
  | { op: "setField";  object: string; field: string; value: string }

  // Arrays
  | { op: "array";     dest: string; elements: string[] }
  | { op: "getIndex";  dest: string; object: string; index: string }
  | { op: "setIndex";  object: string; index: string; value: string }

  // Spread
  | { op: "spread";    dest: string; src: string }

  // Closures — mutable capture via heap cells
  | { op: "cellAlloc";  dest: string }
  | { op: "cellLoad";   dest: string; src: string }
  | { op: "cellStore";  cell: string; value: string }


// ─── Função MIR ───────────────────────────────────────────────

export type MIRFunction = {
  name: string
  params: { name: string; type: string }[]
  returnType: string
  instructions: MIRInstruction[]
  isArrow: boolean
}


// ─── Definição de struct ──────────────────────────────────────

export type MIRStructDef = {
  name: string
  fields: { name: string; type: string; mutable: boolean }[]
  methods: MIRFunction[]
}


// ─── Programa MIR ─────────────────────────────────────────────

export type MIRProgram = {
  functions: MIRFunction[]
  globals: MIRInstruction[]
  structs: MIRStructDef[]
}
