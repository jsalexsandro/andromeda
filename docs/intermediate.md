# Andromeda — Mid IR Implementation Plan

> **Entrada:** AST anotado pelo Semantic Analyzer
> **Saída:** Lista linear de instruções tipadas (`IRInstruction[]`)
> **Targets:** JSEmitter (agora) · BytecodeEmitter (futuro)

---

## Visão Geral da Arquitetura

```
AST (anotado)
      ↓
 IRGenerator
      ↓
  IR Program
   ↙      ↘
JSEmitter  BytecodeEmitter (futuro)
```

Cada função do programa vira um `IRFunction` com uma lista linear de `IRInstruction`.
Controle de fluxo é explícito via `label` + `jump` + `jumpIf`.
Toda expressão produz um **temporário** nomeado (`t0`, `t1`, ...).

---

## Fase 1 — Estrutura Base

### [ ] 1.1 Tipos de instrução (`IRInstruction`)

Criar o tipo union que representa todas as instruções possíveis:

```typescript
type IRInstruction =
  // Valores
  | { op: "const";    dest: string; value: IRValue }
  | { op: "copy";     dest: string; src: string }

  // Operações
  | { op: "binary";   dest: string; left: string; op: BinaryOp; right: string }
  | { op: "unary";    dest: string; op: UnaryOp; operand: string }

  // Controle de fluxo
  | { op: "label";    name: string }
  | { op: "jump";     label: string }
  | { op: "jumpIf";   cond: string; then: string; else: string }
  | { op: "return";   value: string | null }

  // Funções
  | { op: "call";     dest: string; callee: string; args: string[] }
  | { op: "callNamed";dest: string; callee: string; args: { name: string; value: string }[] }

  // Structs
  | { op: "alloc";    dest: string; structName: string }
  | { op: "getField"; dest: string; object: string; field: string }
  | { op: "setField"; object: string; field: string; value: string }

  // Arrays
  | { op: "array";    dest: string; elements: string[] }
  | { op: "getIndex"; dest: string; object: string; index: string }
  | { op: "setIndex"; object: string; index: string; value: string }

  // Spread
  | { op: "spread";   dest: string; src: string }
```

### [ ] 1.2 Tipos de valor (`IRValue`)

```typescript
type IRValue =
  | { kind: "int";    value: number }
  | { kind: "float";  value: number }
  | { kind: "string"; value: string }
  | { kind: "bool";   value: boolean }
  | { kind: "null" }
```

### [ ] 1.3 Estrutura de função (`IRFunction`)

```typescript
type IRFunction = {
  name: string
  params: { name: string; type: string }[]
  returnType: string
  instructions: IRInstruction[]
  isArrow: boolean
}
```

### [ ] 1.4 Programa IR (`IRProgram`)

```typescript
type IRProgram = {
  functions: IRFunction[]
  globals: IRInstruction[]     // declarações no topo do arquivo
  structs: IRStructDef[]
}

type IRStructDef = {
  name: string
  fields: { name: string; type: string; mutable: boolean }[]
  methods: IRFunction[]
}
```

### [ ] 1.5 Gerador de temporários e labels

```typescript
class IRGenerator {
  private tempCount = 0
  private labelCount = 0

  private freshTemp(): string {
    return `t${this.tempCount++}`
  }

  private freshLabel(hint: string): string {
    return `${hint}_${this.labelCount++}`
  }
}
```

---

## Fase 2 — Expressões

> Cada método `emitExpr(node)` retorna o nome do temporário que contém o resultado.

### [ ] 2.1 Literais

```
val x = 42
→  const t0 int 42
   copy x t0
```

- `NumberLiteral` (int / float)
- `StringLiteral`
- `BoolLiteral`
- `NullLiteral`

### [ ] 2.2 Identificadores

```
x
→  copy t0 x
```

Apenas resolve o nome da variável no escopo atual.

### [ ] 2.3 Expressão binária

```
a + b
→  binary t0 a + b
```

- Aritméticos: `+` `-` `*` `/` `%`
- Comparação: `==` `!=` `<` `>` `<=` `>=`
- Lógicos: `&&` `||`
- String concat: `+` com operandos string

### [ ] 2.4 Expressão unária

```
!x
→  unary t0 ! x

-y
→  unary t1 - y
```

### [ ] 2.5 Expressão agrupada

Transparente — apenas emite a expressão interna.

### [ ] 2.6 Ternário

```
cond ? a : b
→  jumpIf t_cond then_0 else_0
   label then_0
     copy t_res a
     jump end_0
   label else_0
     copy t_res b
   label end_0
```

### [ ] 2.7 Nullish Coalescing (`??`)

```
a ?? b
→  // se a != null usa a, senão usa b
   binary t_check a != null
   jumpIf t_check nn_0 is_null_0
   label nn_0
     copy t_res a
     jump end_1
   label is_null_0
     copy t_res b
   label end_1
```

---

## Fase 3 — Statements

### [ ] 3.1 VariableDeclaration

```
val x: int = expr
→  <emite expr → t0>
   copy x t0
```

- `val` / `const` → marcar como imutável no IR (metadata)
- `var` → mutável
- Sem inicializador → `const x null`

### [ ] 3.2 Assignment

```
x = expr
→  <emite expr → t0>
   copy x t0
```

Operadores compostos — desugar antes de emitir:

```
x += y   →   x = x + y
x -= y   →   x = x - y
x *= y   →   x = x * y
x /= y   →   x = x / y
x %= y   →   x = x % y
```

### [ ] 3.3 ExpressionStatement

Emite a expressão, descarta o temporário resultante.

### [ ] 3.4 BlockStatement

Abre escopo lógico, emite cada statement interno, fecha escopo.
Não gera instrução — escopo é apenas contagem de variáveis.

---

## Fase 4 — Controle de Fluxo

### [ ] 4.1 IfStatement

```
if (cond) { A } else { B }

→  <emite cond → t0>
   jumpIf t0 then_0 else_0

   label then_0
     <emite A>
     jump end_0

   label else_0
     <emite B>

   label end_0
```

Sem else: `else_0` e `end_0` colapsam no mesmo label.

### [ ] 4.2 WhileStatement

```
while (cond) { body }

→  label while_start_0
     <emite cond → t0>
     jumpIf t0 while_body_0 while_end_0

   label while_body_0
     <emite body>
     jump while_start_0

   label while_end_0
```

- Registrar `while_end_0` no contexto para `break`
- Registrar `while_start_0` no contexto para `continue`

### [ ] 4.3 ForStatement — desugar para while

```
for (var i = 0; i < 5; i = i + 1) { body }

→  copy i 0                       // init

   label for_start_0
     binary t0 i < 5              // condition
     jumpIf t0 for_body_0 for_end_0

   label for_body_0
     <emite body>
     <emite update: i = i + 1>   // update
     jump for_start_0

   label for_end_0
```

### [ ] 4.4 BreakStatement

```
break
→  jump <label_end do loop atual>
```

### [ ] 4.5 ContinueStatement

```
continue
→  jump <label_start ou label_update do loop atual>
```

---

## Fase 5 — Funções

### [ ] 5.1 FunctionStatement

```
func add(a: int, b: int): int {
  return a + b
}

→  IRFunction {
     name: "add"
     params: [{ name: "a", type: "int" }, { name: "b", type: "int" }]
     returnType: "int"
     instructions: [
       binary t0 a + b
       return t0
     ]
   }
```

- Criar novo `IRFunction`
- Emitir params como variáveis disponíveis no escopo
- Emitir body
- Registrar função no `IRProgram`

### [ ] 5.2 ReturnStatement

```
return expr
→  <emite expr → t0>
   return t0

return           // void
→  return null
```

### [ ] 5.3 CallExpression

```
add(1, 2)
→  const t0 int 1
   const t1 int 2
   call t2 add [t0, t1]
```

### [ ] 5.4 CallNamed (named args)

```
User(name: "Alice", age: 30)
→  const t0 string "Alice"
   const t1 int 30
   callNamed t2 User [{ name: "name", value: t0 }, { name: "age", value: t1 }]
```

### [ ] 5.5 ArrowFunction

Arrow atribuída a variável:

```
val double = (x: int): int => x * 2

→  IRFunction {
     name: "__arrow_0"    // nome gerado
     params: [{ name: "x", type: "int" }]
     returnType: "int"
     instructions: [
       binary t0 x * 2
       return t0
     ]
   }
   copy double __arrow_0
```

### [ ] 5.6 Funções como valores (first-class)

Quando uma função é passada como argumento:

```
call t0 map [arr, double]
```

`double` é apenas uma referência ao nome da `IRFunction`.

---

## Fase 6 — Structs

### [ ] 6.1 StructStatement

Registrar definição no `IRProgram.structs`:

```typescript
IRStructDef {
  name: "User",
  fields: [
    { name: "name", type: "string", mutable: false },
    { name: "age",  type: "int",    mutable: true  }
  ],
  methods: []
}
```

Não gera instruções — é apenas metadata.

### [ ] 6.2 StructLiteral

```
User { name: "Alice", age: 30 }

→  alloc t0 User
   const t1 string "Alice"
   setField t0 name t1
   const t2 int 30
   setField t0 age t2
```

### [ ] 6.3 MemberExpression (leitura)

```
user.name
→  getField t0 user name
```

Chained:
```
user.address.city
→  getField t0 user address
   getField t1 t0 city
```

### [ ] 6.4 MemberExpression (escrita)

```
user.age = 31
→  const t0 int 31
   setField user age t0
```

### [ ] 6.5 Métodos

Método vira `IRFunction` com `self` como primeiro parâmetro implícito:

```
func magnitude(): float { return self.x * self.x }

→  IRFunction {
     name: "Point__magnitude"     // namespace: NomeStruct__metodo
     params: [{ name: "self", type: "Point" }]
     returnType: "float"
     instructions: [
       getField t0 self x
       getField t1 self x
       binary t2 t0 * t1
       return t2
     ]
   }
```

Chamada de método:
```
p.magnitude()
→  call t0 Point__magnitude [p]
```

---

## Fase 7 — Arrays

### [ ] 7.1 ArrayLiteral

```
[1, 2, 3]
→  const t0 int 1
   const t1 int 2
   const t2 int 3
   array t3 [t0, t1, t2]
```

### [ ] 7.2 IndexExpression (leitura)

```
arr[0]
→  const t0 int 0
   getIndex t1 arr t0
```

### [ ] 7.3 IndexExpression (escrita)

```
arr[0] = 99
→  const t0 int 0
   const t1 int 99
   setIndex arr t0 t1
```

### [ ] 7.4 Spread em array

```
[...arr, 4, 5]
→  spread t0 arr
   const t1 int 4
   const t2 int 5
   array t3 [t0, t1, t2]
```

---

## Fase 8 — Optional Binding

### [ ] 8.1 IfValExpr / IfVarExpr

```
if val y = x { ... }

→  binary t0 x != null          // checar se não é null
   jumpIf t0 binding_then_0 binding_else_0

   label binding_then_0
     copy y x                   // y = x (unwrapped — sem null)
     <emite then-branch>
     jump binding_end_0

   label binding_else_0
     <emite else-branch se existir>

   label binding_end_0
```

---

## Fase 9 — Generics

Generics são **apagados** no IR (type erasure).

### [ ] 9.1 Funções genéricas

```
func identity<T>(x: T): T { return x }

identity<int>(42)
identity<string>("hello")
```

No IR, ambas as chamadas geram:

```
call t0 identity [42]
call t1 identity ["hello"]
```

A função `identity` no IR é polimórfica — o type param `T` não existe mais.
O semantic já garantiu que os tipos são corretos.

### [ ] 9.2 Structs genéricos

```
Box<int> { value: 42 }

→  alloc t0 Box
   const t1 int 42
   setField t0 value t1
```

O nome no IR é sempre o nome base (`Box`, não `Box<int>`).

---

## Fase 10 — Contexto do Gerador

O `IRGenerator` precisa carregar estado durante a geração:

```typescript
class IRGenerator {
  // Programa sendo construído
  private program: IRProgram

  // Função sendo emitida no momento
  private currentFunction: IRFunction | null

  // Struct sendo emitida (para métodos)
  private currentStruct: IRStructDef | null

  // Stack de loops (para break/continue)
  private loopStack: { start: string; end: string }[]

  // Contador de temporários (por função)
  private tempCount: number

  // Contador de labels (global)
  private labelCount: number
}
```

---

## Fase 11 — Validações no IRGenerator

O IR assume que o semantic já validou tudo.
Ainda assim, algumas guardas defensivas são úteis durante o desenvolvimento:

### [ ] 11.1 Guardar que `return` está dentro de função
### [ ] 11.2 Guardar que `break`/`continue` estão dentro de loop
### [ ] 11.3 Guardar que `setField` só ocorre em campos `mut`
### [ ] 11.4 Emitir `IRError` em vez de throw — facilita debugging

---

## Fase 12 — JSEmitter (a partir do IR)

> Entrada: `IRProgram` · Saída: string de código JS válido

### [ ] 12.1 Emitir `IRFunction` → `function` JS

```typescript
// IRFunction { name: "add", params: ["a","b"], instructions: [...] }
→
function add(a, b) {
  ...
}
```

### [ ] 12.2 Emitir instruções

| IR | JS |
|---|---|
| `const t0 int 42` | `let t0 = 42;` |
| `copy x t0` | `let x = t0;` (ou `x = t0` se já declarado) |
| `binary t0 a + b` | `let t0 = a + b;` |
| `unary t0 ! x` | `let t0 = !x;` |
| `call t0 fn [a,b]` | `let t0 = fn(a, b);` |
| `return t0` | `return t0;` |
| `return null` | `return;` |
| `label loop_0` | `__loop_0:` |
| `jump loop_0` | `continue __loop_0;` ou `goto` via label |
| `jumpIf t cond a b` | `if (t) { goto a } else { goto b }` (via restructuring) |
| `alloc t0 User` | `let t0 = {};` |
| `setField t0 name t1` | `t0.name = t1;` |
| `getField t0 obj name` | `let t0 = obj.name;` |
| `array t0 [a,b,c]` | `let t0 = [a, b, c];` |
| `spread t0 arr` | `...arr` (dentro de array literal) |

### [ ] 12.3 Reconstruir controle de fluxo

`jumpIf` + `label` + `jump` viram `if/else` e `while` no JS.
Isso é feito com um **structurizer** simples: detecta padrões de label/jump e reconstrói as estruturas originais.

### [ ] 12.4 Emitir structs como classes JS

```typescript
// IRStructDef { name: "User", fields: [...], methods: [...] }
→
class User {
  constructor({ name, age }) {
    this.name = name;
    this.age = age;
  }
}
```

### [ ] 12.5 Emitir métodos como métodos da classe

```typescript
// IRFunction { name: "Point__magnitude", params: [self, ...] }
→
// dentro da class Point:
magnitude() {
  const self = this;
  ...
}
```

---

## Ordem de Implementação Recomendada

```
[ ] Fase 1   — Estrutura base (tipos, IRProgram, gerador de temps/labels)
[ ] Fase 2   — Expressões (literais, binário, unário, ternário, ??)
[ ] Fase 3   — Statements (var decl, assignment, desugar +=)
[ ] Fase 4   — Controle de fluxo (if, while, for → desugar, break, continue)
[ ] Fase 5   — Funções (func, return, call, arrow)
[ ] Fase 6   — Structs (alloc, getField, setField, métodos)
[ ] Fase 7   — Arrays (array, getIndex, setIndex, spread)
[ ] Fase 8   — Optional binding (if val/var)
[ ] Fase 9   — Generics (type erasure)
[ ] Fase 10  — Contexto e guardas defensivas
[ ] Fase 11  — JSEmitter (IR → JS)
```

---

## Invariantes do IR

Regras que toda instrução deve respeitar:

1. Todo `dest` é único dentro de uma função (SSA relaxado — sem phi nodes ainda)
2. Todo operando (`src`, `left`, `right`, etc.) foi definido antes de ser usado
3. `return` é sempre a última instrução de um bloco básico
4. `label` sempre precede o bloco que nomeia
5. Nenhuma instrução de tipo conhece tipos — apenas nomes de temporários

---

*Andromeda Language — IR Design v0.1*