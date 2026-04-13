# Gramática do Andromeda

## Versão 1.0.0

---

## 1. Literais

```
Literal     → NUMBER | STRING | BOOLEAN | NULL
NUMBER     → [0-9]+ ("." [0-9]+)?
STRING     → "\"" ... "\""
BOOLEAN    → "true" | "false"
NULL       → "null"
```

### 1.1 Array Literals
```
ArrayLiteral → "[" (Expression ("," Expression)* ","?)? "]"
```
- Arrays podem conter elementos de tipos diferentes (inferido como `unknown[]` ou `any[]`)
- Suporta arrays vazios: `[]`
- Suporta nested arrays: `[[1, 2], [3, 4]]`
- Suporta trailing comma: `[1, 2, 3,]`

### Exemplos:
```andromeda
[]                    // array vazio
[1, 2, 3]            // ints → int[]
[1.5, 2.5]           // floats → float[]
["a", "b"]           // strings → string[]
[true, false]        // bools → bool[]
[1, "two", true]     // mixed → unknown[]
[[1, 2], [3, 4]]     // nested → int[][]
[[1, ], [2, 3, ]]    // trailing comma
[1 + 2, x * y]       // expressões
```

### 1.2 Object Literals
```
ObjectLiteral → "{" (Property ("," Property)* ","?)? "}"
Property     → PropertyName ":" Expression
            | PropertyName
PropertyName → IDENTIFIER | KEYWORD | STRING
```
- Objetos são literais com pares chave-valor
- Suporta empty objects: `{}`
- Suporta nested objects: `{a: {b: 1}}`
- Suporta shorthand: `{a, b}` → `{a: a, b: b}`
- Suporta keywords como nomes: `{val: 1, if: 2}`
- Suporta strings como chaves: `{"key": value}`

### Tipagem Estrutural Estática
Objetos em Andromeda são **estaticamente tipados**:
- Os campos são definidos na criação/inferência
- **Não é possível adicionar novos campos** após a criação
- **Não é possível remover campos**
- Erros em campos inexistentes são pegos em compile-time

Isso garante robustez e facilita manutenção, enquanto mantém alta velocidade de desenvolvimento.

### Exemplos:
```andromeda
{}                           // objeto vazio
{a: 1}                      // basic
{a: 1, b: 2}               // múltiplas propriedades
{name: "John"}              // string como valor
{a, b}                      // shorthand (equivale a {a: a, b: b})
{a: 1 + 2, b: x * y}       // expressões
{a: {b: 1}}                 // nested
{a: [1, 2]}                // array como valor
{a: {nested: true}}        // objeto em objeto
{val: 1, bool: true}       // keywords como keys
flag ? {a: 1} : {b: 2}    // em ternary
maybe ?? {default: 0}       // em nullish
```

---

## 2. Identificadores

```
Identifier → [a-zA-Z_][a-zA-Z0-9_]*
```

---

## 3. Operadores Unários

```
Unary      → ("-" | "+" | "!") Expression
```

---

## 4. Operadores Binários

### 4.1 Aritméticos
```
Arithmetic → ("+" | "-" | "*" | "/" | "%") Expression
```

### 4.2 Comparação
```
Comparison → ("==" | "!=" | ">" | "<" | ">=" | "<=") Expression
```

### 4.3 Lógicos
```
Logical   → ("&&" | "||") Expression
```

---

## 5. Agrupamento

```
Group     → "(" Expression ")"
```

---

## 6. Precedência de Operadores (do menor para maior)

```
1.  ASSIGN      =   +=  -=  *=  /=  %=
2.  OR           ||
3.  AND          &&
4.  EQUALS       ==  !=
5.  LESSGREATER  >   <   >=  <=
6.  SUM          +   -
7.  PRODUCT      *   /   %
8.  PREFIX      -X  +X  !X
9.  CALL        ()
10. INDEX       []
11. MEMBER       .
```

---

## 7. Declaração de Variáveis

```
VariableDecl → ("var" | "val" | "const") Identifier (":" Type)? ("=" Expression)?

Type        → "int" | "float" | "bool" | "string" | "void" | Identifier
ArrayType   → Type ("[" "]")+
ObjectType  → "{" (Field ("," Field)*)? "}"
Field       → IDENTIFIER ":" Type
```

### Regras:
- `var`   → mutável, tipo opcional (inferido)
- `val`   → **imutável, tipo obrigatório** ⚠️
- `const` → imutável, tipo opcional (inferido)

### Array Types:
```
int[]        // array de int
string[]     // array de string
int[][]      // array 2D de int
float[][][]  // array 3D de float
```

### Object Types:
```
{}                        // objeto vazio
{name: string}           // objeto com um campo
{name: string, age: int} // objeto com múltiplos campos
{outer: {inner: int}}    // objeto aninhado
{items: int[], name: string}  // objeto com campo array
{name: string}[]         // array de objetos
```

### Exemplos:
```andromeda
var x = 10           // mutável, tipo inferido
var y: int = 20      // mutável, tipo int
val z: string = "hi" // imutável, tipo string (obrigatório)
const PI = 3.14      // imutável

// Arrays
var nums: int[] = [1, 2, 3]
val words: string[] = ["hello", "world"]
var matrix: int[][] = [[1, 2], [3, 4]]

// Objects
val empty: {} = {}
val person: {name: string, age: int} = {name: "John", age: 30}
val nested: {outer: {inner: int}} = {outer: {inner: 42}}
val withArr: {items: int[], name: string} = {items: [1, 2], name: "test"}
val users: {name: string}[] = [{name: "Alice"}, {name: "Bob"}]
```

---

## 8. Statements

```
Statement     → ExpressionStmt
              | VariableStmt
              | BlockStmt
              | IfStmt
              | WhileStmt
              | BreakStmt
              | ContinueStmt
              | ForStmt
              | FunctionStmt
              | ReturnStmt

BlockStmt  → "{" Statement* "}"

Program    → Statement*
```

### 8.1 Block Statement
```
BlockStmt  → "{" Statement* "}"
```
Abre novo escopo léxico para variáveis.

### 8.2 If Statement
```
IfStmt     → "if" "(" Expression ")" Statement ("else" Statement)?
```
- Suporta `if (condição) { ... }`
- Suporta `if ... else { ... }`
- Suporta `else if` (aninhado)

### Exemplos:
```andromeda
if (true) { x = 1 }
if (x > 0) { ... } else { ... }
if (a > 10) { ... } else if (a > 5) { ... } else { ... }
```

### 8.3 While Statement
```
WhileStmt  → "while" "(" Expression ")" Statement
```
- Loop condicional
- Cria novo escopo para variáveis

### Exemplos:
```andromeda
while (condicao) { ... }
while (i < 10) {
  i
}
```

### 8.4 Break & Continue
```
BreakStmt    → "break"
ContinueStmt → "continue"
```
- Só podem ser usados dentro de loops (`while`, `for`)
- Erro semântico se usado fora de loops

### Exemplos:
```andromeda
while (true) {
  if (condicao) break
  if (outra) continue
  x
}
```

### 8.5 Assignment
```
Assignment       → (Identifier | IndexExpr | MemberExpr) "=" Expression
CompoundAssign   → (Identifier | IndexExpr | MemberExpr) ("+=" | "-=" | "*=" | "/=" | "%=") Expression
IndexAssign      → Expression "[" Expression "]" "=" Expression
MemberAssign     → Expression "." Identifier "=" Expression
```
- Atribuição simples: `x = 10`
- Atribuição composta: `x += 1`, `x -= 1`, `x *= 2`, `x /= 2`, `x %= 2`
- **Assignment a índice**: `arr[0] = 5`
- **Compound assignment a índice**: `arr[0] += 5`, `arr[0] -= 2`
- **Assignment a membro**: `obj.field = value`
- Valida se variável está declarada
- Valida tipo compatível
- Valida mutabilidade (não pode modificar `val`/`const` na referência)

### Exemplos:
```andromeda
var x = 10
x = 20
x += 5
x -= 3
x *= 2
x /= 4
x %= 3

// Assignment a índice
var arr: int[] = [1, 2, 3]
arr[0] = 10
arr[1] += 5
arr[2] *= 2

// Nested assignment
var matrix: int[][] = [[1, 2], [3, 4]]
matrix[0][0] = 99
matrix[1][1] *= 2

// Erro: val não pode ser modificado
val immutable: int[] = [1, 2, 3]
immutable[0] = 10  // ERRO: cannot modify val
```

### 8.6 Expression as Statement
```
ExpressionStmt → Expression
```
- Qualquer expressão pode ser usada como statement
- O resultado é avaliado mas descartado

### Exemplos:
```andromeda
"hello world"
1 + 2
print("oi")
```

### 8.7 Member Expression
```
MemberExpr → Expression "." Identifier
```
- Accesso de propriedade de objeto
- Sintaxe: `obj.property`
- Suporta acesso encadeado: `obj.prop1.prop2`
- Precedência mais alta que Call
- **Retorna o tipo do campo**: `{name: string}` → `string`

#### Type Inference:
```
var user = {name: "Ana", age: 25}  // user: {name: string, age: int}
var name = user.name                // name: string
var nested = {a: {b: 1}}           // nested: {a: {b: int}}
var b = nested.a.b                   // b: int
```

#### Member Assignment:
```
MemberAssign → Expression "." Identifier "=" Expression
```
- Atribuição a propriedade de objeto
- Funciona em `var` e `val` (val só protege a referência, não o conteúdo)
- Suporta compound assignment: `obj.prop += 1`

#### Member Assignment Exemplos:
```andromeda
var user = {name: "Ana", age: 25}
user.name = "Bruno"        // OK
user.age += 1              // OK (compound)
user.foo = "x"             // ERRO: campo inexistente
user.name = 123            // ERRO: tipo incompatível
```

### 8.8 Index Expression
```
IndexExpr → Expression "[" Expression "]"
```
- Acesso a elemento de array ou propriedade de objeto
- Sintaxe: `arr[index]` ou `obj["property"]`
- Suporta index encadeado: `arr[0][1]`, `obj["a"]["b"]`
- Suporta Member + Index: `obj.items[0]`, `arr[0].name`

#### Validação de Tipos:
- **Arrays**: índice deve ser `int`
- **Objetos**: chave deve ser `string`
- Tipos incompatíveis geram erro em compile-time

#### Type Inference:
```
var arr = [1, 2, 3]     // arr: int[]
var first = arr[0]      // first: int

var matrix = [[1, 2], [3, 4]]  // matrix: int[][]
var row = matrix[0]             // row: int[]
var elem = matrix[0][0]        // elem: int
```

#### Exemplos com Arrays:
```andromeda
var nums = [10, 20, 30]
nums[0]           // 10
nums[1 + 1]       // 30
nums[i]            // int (i: int)
nums["x"]          // ERRO: índice deve ser int
```

#### Exemplos com Objetos:
```andromeda
var user = {name: "Ana", age: 25}
user["name"]       // "Ana"
user["age"]        // 25
user["name"] = "Bruno"  // atribuição
user[0]            // ERRO: chave deve ser string
user["foo"]        // unknown (campo inexistente)
user[key]          // unknown (key variável, não valida)
```

#### Index Assignment:
```
IndexAssign → Expression "[" Expression "]" "=" Expression
```
- Atribuição a índice de array ou propriedade de objeto via bracket
- Valida tipo de índice (int para arrays, string para objetos)
- Valida existência do campo em objetos (se chave for literal)

#### Index Assignment Exemplos:
```andromeda
var arr = [1, 2, 3]
arr[0] = 10            // OK
arr[0] += 5            // OK (compound)

var obj = {name: "Ana"}
obj["name"] = "Bruno"  // OK
obj["age"] = 25        // ERRO: campo inexistente
obj["name"] = 123      // ERRO: tipo incompatível
```

#### Exemplos:
```andromeda
arr[0]
arr[i + 1]
matrix[0][1]
obj.list[0]
makeArray()[0]        // call + index
getMatrix()[1][0]     // chained
```

### 8.9 Call Expression
```
CallExpr → Identifier "(" Expression* ")"
```
- Chamada de função
- Suporta múltiplos argumentos
- Suporta argumentos vazios
- Valida se função está definida
- Valida se callee é um identifier

### Exemplos:
```andromeda
print("Hello")
print("a", "b", "c")
print()
myFunc(arg1, arg2)
```

### 8.10 Arrow Functions
```
ArrowFunction → "(" (Param ("," Param)*)? ")" (":" Type)? "=>" (Expression | Block)
Param          → Identifier (":" Type)?
Block          → "{" Statement* "}"
```
- Funções anônimas com sintaxe arrow
- Parâmetros opcionais com type annotation
- Return type opcional
- Body pode ser expressão ou bloco

#### Tipos de Parâmetros e Retorno:
```
(int) => int           // parâmetro int, retorna int
(int[], int) => int[]  // parâmetro array, retorna array
() => int[]            // sem parâmetros, retorna array
(x: int[]) => int      // parâmetro array tipado
```

#### Exemplos:
```andromeda
var identity = (x: int): int => x
var makeArray = (): int[] => [1, 2, 3]
var makeMatrix = (): int[][] => [[1, 2], [3, 4]]
var double = (arr: int[]): int[] => [arr[0] * 2, arr[1] * 2]

// Uso
var arr = makeArray()
var first = arr[0]
var elem = makeMatrix()[0][1]
```

---

## 9. Semantic Analyzer

O Semantic Analyzer é executado após o Parser e valida o significado do código.

### 9.1 Escopos (Scope)

Sistema de escopos léxicos aninhados:
- **Escopo Global**: escopo principal
- **Escopo Local**: criado por BlockStmt, if, while, for, função

Cada símbolo é pesquisado primeiro no escopo atual, depois nos pais.

### 9.2 Type Inference

O type checker infere tipos ausentes:
```andromeda
var x = 10      // infere: int
var y: int = 20 // explícito: int
var arr = [1, 2, 3]  // infere: int[]
var first = arr[0]  // infere: int
```

### 9.3 Array Literal Type Inference

Arrays inferem o tipo dos elementos:
```
[1, 2, 3]           → int[]
[1.0, 2.0]          → float[]
["a", "b"]          → string[]
[1, "two"]          → unknown[] (tipos mistos)
[[1, 2], [3, 4]]    → int[][]
```

### 9.4 Erros Semânticos Detectados

| Código | Descrição |
|--------|----------|
| UNDEFINED_VARIABLE | Variável referenciada mas não declarada |
| ALREADY_DECLARED | Nome já usado no mesmo escopo |
| TYPE_MISMATCH | Tipos incompatíveis em operação |
| VAL_REQUIRES_TYPE | `val` sem type annotation |
| INVALID_OPERATION | Operação inválida (ex: logical com não-boolean, call em não-função) |
| INVALID_BREAK | `break`/`continue` usado fora de loop |
| CANNOT_ASSIGN | Tentativa de reatribuir a `val` ou `const` |
| INVALID_INDEX | Tentativa de indexar tipo não-array |
| INVALID_ASSIGNMENT | Target de assignment inválido |
| INVALID_MEMBER_ACCESS | Acesso a propriedade em tipo não-objeto |
| UNKNOWN_PROPERTY | Tentativa de acessar campo inexistente |

---

## 10. Recuperação de Erros

- O parser reporta erros com linha, coluna e ponteiro (^)
- Error deduplication evita mensagens duplicadas
- Recovery automático em caso de erro: pula token problemático e continua

---

## Tokens Reconhecidos

| Tipo | Valor | Descrição |
|------|-------|-----------|
| KEYWORD | var, val, const, func, if, else, while, break, continue | Palavras reservadas |
| IDENTIFIER | nomes | Identificadores |
| NUMBER | 42, 3.14 | Números |
| STRING | "texto" | Strings |
| BOOLEAN | true, false | Booleanos |
| NULL | null | Nulo |
| ASSIGN | = | Atribuição |
| PLUS_EQUAL, MINUS_EQUAL | +=, -= | Atribuição composta |
| STAR_EQUAL, SLASH_EQUAL | *=, /= | Atribuição composta |
| MODULO_EQUAL | %= | Atribuição composta |
| COLON | : | Dois pontos (type annotation) |
| PLUS, MINUS | +, - | Aritméticos |
| STAR, SLASH, MODULO | *, /, % | Aritméticos |
| EQUAL, NOT_EQUAL | ==, != | Comparação |
| LESS_THAN, GREATER_THAN | <, > | Comparação |
| LESS_EQUAL, GREATER_EQUAL | <=, >= | Comparação |
| AND, OR | &&, \|\| | Lógicos |
| LPAREN, RPAREN | ( ) | Agrupamento |
| LBRACE, RBRACE | { } | Bloco |
| LBRACKET, RBRACKET | [ ] | Arrays |
| TYPE_INT, TYPE_FLOAT, TYPE_STRING, TYPE_BOOL, TYPE_VOID | int, float, string, bool, void | Tipos |
| ARROW | => | Arrow function |
| QUESTION, QUESTION_QUESTION | ?, ?? | Ternary, Nullish |
| DOT | . | Member access |
| COMMA | , | Separador |
| SEMICOLON | ; | Statement separator |
| SPREAD | ... | Rest/Spread |

---

## Histórico de Implementações

| Versão | Data | Features |
|--------|------|-----------|
| 1.0.0 | 2026-04-10 | Lexer, Parser, AST, Literals, Binários, Unários |
| 1.0.1 | 2026-04-11 | Semantic Analyzer, Type Checker, Escopos |
| 1.0.2 | 2026-04-11 | Block Statement, IfStatement |
| 1.0.3 | 2026-04-11 | WhileStatement, BreakStmt, ContinueStmt |
| 1.0.4 | 2026-04-11 | Assignment (x = 10), Compound (+=, etc), ExpressionStmt |
| 1.0.5 | 2026-04-11 | CallExpression, String Concatenation |
| 1.0.6 | 2026-04-12 | MemberExpression (obj.prop) |
| 1.0.7 | 2026-04-12 | IndexExpression (arr[i]) |
| 1.0.8 | 2026-04-13 | **Array Literals**, **Array Types**, **Index Type Inference** |
| 1.0.9 | 2026-04-13 | **Arrow Functions com tipos array**, **Index Assignment** |
| 1.0.10 | 2026-04-13 | **Ternary**, **Nullish Coalescing**, CallExpression Semantic |
| 1.0.11 | 2026-04-13 | **Object Literals**, **Object Types**, **Object Semantic** |
| 1.0.12 | 2026-04-13 | **MemberExpression Semantic**, **Member Assignment**, **Index Type Validation** |
| 1.0.13 | 2026-04-13 | **Bracket Notation on Objects**, index/key type validation |

---

## Implementado ✓

### Arrays
- [x] Array Literais: `[1, 2, 3]`, `[[1, 2], [3, 4]]`
- [x] Array Types: `int[]`, `string[]`, `int[][]`, `float[][][]`
- [x] Index Access: `arr[0]`, `matrix[0][1]`
- [x] Index Type Inference: `int[]` → `int`, `int[][]` → `int[]`
- [x] Index Assignment: `arr[0] = 5`, `matrix[0][0] = 10`
- [x] Compound Assignment to Index: `arr[0] += 5`, `arr[0] -= 2`
- [x] Val Arrays: validação de immutabilidade
- [x] Type checking em elementos: `[1, "two"]` em `int[]` → ERRO
- [x] **Index type validation**: índice deve ser `int`

### Arrow Functions
- [x] Arrow Functions básicas: `(x) => x + 1`
- [x] Com type annotation: `(x: int): int => x * 2`
- [x] Com return type: `(): int[] => [1, 2]`
- [x] Com array types: `(x: int[]): int[] => [x[0]]`

### Objects
- [x] Object Literals: `{a: 1}`, `{a, b}` shorthand, `{a: {b: 1}}` nested
- [x] Object Types: `{}`, `{name: string}`, `{name: string, age: int}`
- [x] Nested Object Types: `{outer: {inner: int}}`
- [x] Object with Array field: `{items: int[], name: string}`
- [x] Array of Objects: `{name: string}[]`
- [x] Structural Typing: campos extras são permitidos
- [x] Object Literal Type Inference: `{name: "John", age: 30}` → `{name: string, age: int}`
- [x] Object Type Checking: valida campos e tipos
- [x] **Tipagem Estrutural Estática**: não permite adicionar/remover campos
- [x] **Member Access**: `obj.field` retorna tipo do campo
- [x] **Member Assignment**: `obj.field = value` com validação
- [x] **Bracket Access**: `obj["field"]` acesso via string
- [x] **Bracket Assignment**: `obj["field"] = value` atribuição via string
- [x] **Key type validation**: chave deve ser `string`

### Other
- [x] Ternary: `a ? b : c`
- [x] Nullish Coalescing: `a ?? b`
- [x] CallExpression Semantic validation

---

## Em Desenvolvimento (Planejado)

- [ ] ForStatement
- [ ] Androx (sintaxe JSX nativa)
- [ ] Classes
- [ ] Import/Export
- [ ] Template Literals
- [ ] Spread Operator
- [ ] Await/Async