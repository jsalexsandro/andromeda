# Andromeda Language Syntax Reference

**Version:** 1.0.2 (Experimental)  
**Runtime:** Bun  
**File Extension:** `.med`

---

## Table of Contents

1. [Basic Syntax](#1-basic-syntax)
2. [Variables and Constants](#2-variables-and-constants)
3. [Primitive Types](#3-primitive-types)
4. [Arrays](#4-arrays)
5. [Object Literals](#5-object-literals)
6. [Type Aliases (Nominal Types)](#6-type-aliases-nominal-types)
7. [Union and Nullable Types](#7-union-and-nullable-types)
8. [Generic Types](#8-generic-types)
9. [Functions](#9-functions)
10. [Arrow Functions](#10-arrow-functions)
11. [Control Flow](#11-control-flow)
    - [Optional Binding (if val / if var)](#optional-binding-if-val--if-var)
12. [Operators](#12-operators)
13. [Spread Operator](#13-spread-operator)
14. [Comments](#14-comments)
15. [Examples](#15-examples)
16. [Structs](#16-structs)
    - [Declaration](#161-declaração)
    - [Struct Literals](#162-struct-literals)
    - [Field Access](#163-field-access)
    - [Mutable Fields](#164-mutable-fields)
    - [Methods](#165-methods)
    - [Constructors](#166-constructors)
    - [Generic Structs](#167-generic-structs)
    - [Type Aliases com Structs](#168-type-aliases-com-structs)
    - [Nominal Typing](#169-nominal-typing)
    - [Struct Equality](#1610-struct-equality)
    - [Complete Examples](#1611-exemplos-completos)

---

## 1. Basic Syntax

Andromeda uses a familiar C-style syntax with modern enhancements.

```typescript
// Statements end with newline (semicolons optional in some contexts)
val x: int = 10

// Blocks use curly braces
{
  val y: int = 20
}
```

---

## 2. Variables and Constants

### Variable Declarations

| Keyword | Mutability | Type Required | Description |
|---------|-------------|---------------|-------------|
| `var` | Mutable | No | Variable that can be reassigned |
| `val` | Immutable | No | Variable Imutable
| `const` | Immutable | No | Constant (similar to val) |

### Examples

```typescript
// Mutable variable
var count: int = 0
count = count + 1

// Immutable value (type required)
val name: string = "Andromeda"
// name = "Other"  // ERROR: Cannot assign to immutable value

// Val with type inference from initializer
val inferred = 42  // Type inferred as int
```

---

## 3. Primitive Types

| Type | Description | Example |
|------|-------------|---------|
| `int` | Integer numbers | `42`, `-10` |
| `float` | Floating-point numbers | `3.14`, `-2.5` |
| `string` | Text strings | `"hello"`, `"world"` |
| `bool` | Boolean values | `true`, `false` |
| `null` | Null value | `null` |
| `void` | No value (function return) | - |
| `any` | Any type (escape hatch) | - |
| `unknown` | Unknown type (safer than any) | - |

### Literals

```typescript
val intVal: int = 42
val floatVal: float = 3.14
val strVal: string = "hello world"
val boolVal: bool = true
val nullVal: null = null
```

---

## 4. Arrays

### Array Type Syntax

```typescript
// Single-dimensional array
val nums: int[] = [1, 2, 3]

// Array of strings
val names: string[] = ["Alice", "Bob"]

// Multi-dimensional array (matrix)
val matrix: int[][] = [[1, 2], [3, 4]]

// Nested array type syntax
val nested: (int | string)[][] = [[1, "a"], [2, "b"]]
```

### Array Operations

```typescript
val arr: int[] = [1, 2, 3]

// Access element (if supported)
// val first: int = arr[0]

// Spread operator (see section 13)
val combined: int[] = [...arr, 4, 5]
```

---

## 5. Object Literals

### Syntax

```typescript
// Basic object
val person = {
  name: "Alice",
  age: 30
}

// With type annotation (if supported)
// val config: { debug: bool, port: int } = {
//   debug: true,
//   port: 8080
// }
```

### Spread in Objects

```typescript
val base = { x: 1, y: 2 }
// val extended = { ...base, z: 3 }  // If supported
```

---

## 6. Type Aliases (Nominal Types)

Type aliases create named types (nominal typing, similar to Swift/Kotlin).

### Syntax

```typescript
typealias AliasName = ExistingType
```

### Examples

```typescript
// Basic type alias
typealias ID = int
val userId: ID = 123

// Array type alias
typealias IntArray = int[]
val nums: IntArray = [1, 2, 3]

// Union type alias
typealias StringOrNum = int | string
val x: StringOrNum = 42
val y: StringOrNum = "hello"

// Function type alias
typealias Callback = (int) => string

// Nullable type alias
typealias NullableString = string?
val s: NullableString = null
val t: NullableString = "text"

// Nested type alias
typealias UserID = ID
val adminId: UserID = 999
```

---

## 7. Union and Nullable Types

### Union Types

Combine multiple types with `|`:

```typescript
val union1: int | string = 42
val union2: int | string = "hello"

// Union with arrays
val unionArr: (int | string)[] = [1, "a", 2, "b"]
```

### Nullable Types

Shorthand for `T | null`:

```typescript
// Nullable int
val nullable1: int? = null
val nullable2: int? = 42

// Nullable string
val name: string? = null

// Nested nullable
val nested: (int | string)? = null
```

---

## 8. Generic Types

### Built-in Generics

```typescript
// Array with generic syntax
val list: Array<int> = [1, 2, 3]
val map: Array<string> = ["a", "b"]

// Map type (if supported)
// val dict: Map<string, int> = { "a": 1 }
```

---

### Generic Functions

Functions can be parameterized with type parameters using `<T>` syntax:

```typescript
// Generic function with one type parameter
func identity<T>(x: T): T {
  return x
}

// Generic function with multiple type parameters
func pair<A, B>(a: A, b: B): B {
  return b
}

// Generic function with type parameter used in multiple params
func add<T>(n1: T, n2: T): T {
  return n1
}
```

#### Generic Function Call

Explicit type arguments via `<Type>` before `(`:

```typescript
val x1 = identity<int>(42)
val x2 = identity<string>("hello")
val x3 = add<int>(1, 2)
val x4 = pair<int, string>(1, "hi")
```

#### Type Inference

If type arguments are omitted, the compiler infers them from the argument types:

```typescript
val x1 = identity(42)            // infers T → int
val x2 = add(1, 2)               // infers T → int
```

Inference traverses nested types recursively:

```typescript
func deep<T>(x: T[][][]): T[][][] { return x }
val d1 = deep([[[1]]])           // infers T → int (3D array unwrapped)

func nullableIdentity<T>(x: T?): T? { return x }
val n1 = nullableIdentity(42)    // infers T → int (NullableType unwrapped)

func apply<T>(x: T, fn: (T) => T): T { return fn(x) }
val a1 = apply("hi", (s) => s)   // infers T → string (FunctionType unwrapped)
```

#### Bidirectional Type Inference

If a type parameter cannot be inferred from the arguments alone, the compiler
uses **bidirectional inference**: it examines the expected return type
(`contextualType`) provided by the surrounding context:

```typescript
// T cannot be inferred from null alone, but the annotation provides it:
val f: int? = maybe(null)        // ⬅ annotation "int?" tells compiler T → int

func make<T>(): T { return make<T>() }
val x: string = make()           // ⬅ annotation "string" tells compiler T → string
```

The contextual type flows from:
- **Variable type annotations**: `val x: int = identity(42)`
- **Function return type expectations**: `return identity(42)` with expected return
- **Array element types**: `var arr: int[] = [identity(42)]`

#### GENERIC_INFERENCE_FAILED

**When a type parameter cannot be inferred from any source, the compiler reports an error.**

Three sources are consulted (in order):

1. **Argument types** — `T` is matched against concrete argument types
2. **Return type context** — the expected type of the expression (bidirectional)
3. **Explicit type arguments** — `<Type>` syntax

If all three fail to determine `T`, the error `GENERIC_INFERENCE_FAILED` is emitted:

```typescript
func maybe<T>(x: T?): T? { return x }
val a = maybe(null)               // ❌ GENERIC_INFERENCE_FAILED: null provides no type

func empty<T>(): T { return empty<T>() }
val b = empty()                   // ❌ GENERIC_INFERENCE_FAILED: no arguments, no context
```

To fix, provide the missing information:

```typescript
val a = maybe<int>(null)          // ✅ explicit type argument
val a: int? = maybe(null)         // ✅ contextual type from annotation
val a = maybe(42)                 // ✅ concrete argument infers T → int
```

#### Error Cases

| Error | Example | Message |
|-------|---------|---------|
| Wrong type arg count | `add<int, string>(1)` (func has `<T>`) | `Generic function 'add' expects 1 type argument(s), got 2` |
| Not generic | `foo<int>()` (func `foo()` is not generic) | `Function 'foo' is not generic` |
| Duplicate type param | `func add<T, T>()` | `'T' is already declared` |
| Inference failed | `maybe(null)` with no context | `Could not infer type for 'T'` |

---

## 9. Functions

### Syntax

```typescript
// Regular function
func functionName(param1: Type1, param2: Type2): ReturnType {
  // body
  return value
}

// Generic function
func functionName<T, U>(param1: T, param2: U): ReturnType {
  // body
  return value
}
```

### Examples

```typescript
// Basic function
func add(a: int, b: int): int {
  return a + b
}

// Function with union return type
func process(x: int): int | string {
  if (x > 0) {
    return x
  }
  return "negative"
}

// Generic function
func identity<T>(x: T): T {
  return x
}

// Generic function with explicit type args
val r1: int = identity<int>(42)

// Generic function with inference
val r2: string = identity("hello")

// Function call
val result: int = add(1, 2)

// Multi-line call with arrow functions as arguments
func compose<A, B, C>(
  f: (B) => C,
  g: (A) => B,
  x: A
): C {
  return f(g(x))
}

val g1: int = compose(
  (n: int) => n + 1,
  (s: string) => 42,
  "hello"
)
```

### Multi-line Function Calls

Function calls can span multiple lines. Arguments on subsequent lines are parsed
correctly as call arguments (not standalone expressions):

```typescript
val result = add(
  1,
  2
)
```

**Note:** Multi-line calls rely on the lexer recording the token's line number
*before* advancing past it in `readOperator()`. This ensures the parser sees
`(` as being on the same line as the function name, keeping the call context
active.

---

## 10. Arrow Functions

### Syntax

```typescript
// Single expression
val name: (ParamType) => ReturnType = (param) => expression

// With type annotation
val double: (int) => int = (x) => x * 2

// Block body
val name: (int) => int = (x) => {
  return x * 2
}

// Block body with return type annotation
val name = (x: int): int => {
  return x * 2
}

// Higher-order arrow returning function type (block body)
val factory = (): (() => int) => {
  return (): int => 42
}

// Generic arrow function (type parameters before params)
val name = <T>(x: T): T => x

// Generic arrow with multiple type params
val name = <A, B>(a: A, b: B): A => a
```

### Examples

```typescript
// Simple arrow function
val triple: (int) => int = (x) => x * 3
val result: int = triple(10)  // 30

// Arrow function as variable
val greet: (string) => string = (name) => "Hello, " + name

// Generic arrow function
val identity = <T>(x: T): T => x
val r1: int = identity<int>(42)        // explicit type args
val r2: string = identity<string>("hi") // explicit type args

// Generic arrow with block body
val idBlock = <T>(x: T): T => {
  return x
}

// Generic arrow with array type
val first = <T>(arr: T[]): T => arr[0]
val r3: int = first<int>([1, 2, 3])

// Generic arrow passed as argument (contextual inference)
func apply<T>(x: T, fn: (T) => T): T { return fn(x) }
val ctx = apply(10, <T>(x: T): T => x)  // T inferred as int from context

// Grouped generic arrow + immediate call
val r4 = (<T>(x: T): T => x)(42)

// Higher-order: arrow returning generic arrow
val nested = <T>(x: T): (T) => T => (y: T): T => y
```

### Generic Arrow Call

Generic arrows are called with explicit type arguments just like generic functions:

```typescript
val id = <T>(x: T): T => x
val r1 = id<int>(42)
val r2 = id<string>("hello")
```

### Contextual Type Inference for Generic Arrows

When a generic arrow is passed as an argument to a function parameter with a concrete type, the compiler attempts to infer the arrow's type parameters from context:

```typescript
func apply<T>(x: T, fn: (T) => T): T { return fn(x) }

// The arrow's T is inferred as int from apply's T=int
val result = apply(10, <T>(x: T): T => x)  // ✅
```

#### Multi-Type-Parameter Inference (Bug #11 Fixed)

Generic arrows with multiple type params inside generic calls are now fully supported:

```typescript
func swap<A, B>(pair: (A, B) => B, a: A, b: B): B { return pair(a, b) }

// Arrow's A,B are unified with swap's A,B, then inferred from args 1 and "hello"
val r = swap(<A, B>(a: A, b: B): B => b, 1, "hello")  // ✅ A → int, B → string
```

The compiler correctly:
1. Unifies the arrow's signature with the parameter type `(A, B) => B`
2. Infers `A=int` from argument `1` and `B=string` from argument `"hello"`
3. Applies the mapping to both `swap`'s and the arrow's type params

---

## 11. Control Flow

### If/Else

```typescript
val x: int = 10

if (x > 5) {
  val msg: string = "greater than 5"
} else if (x > 0) {
  val msg: string = "greater than 0"
} else {
  val msg: string = "zero or negative"
}
```

### Optional Binding (if val / if var)

The `if val` and `if var` constructs **unwrap** an optional value and bind it to a
new variable, making it available inside the then-branch as a non-nullable type:

```typescript
func maybe(): int? {
  return 42
}

val x: int? = maybe()

// if val — binding imutável (com ou sem parênteses)
if val y = x {
  val z: int = y   // y é int (unwrapped), não int?
}

if (val w = x) {
  val z: int = w   // sintaxe com parênteses também funciona
}

// if var — binding mutável
if var z = x {
  z = 10           // pode reatribuir dentro do bloco
}

// Múltiplos bindings encadeados (IfContExpr)
if val a = x, val b = x {
  val sum: int = a + b   // ambos a e b são int unwrapped
}

// Com else — variável bound NÃO está disponível no else
if val y = x {
  // y: int
} else {
  // y NÃO existe aqui — o optional original (x) ainda está em escopo
}
```

**Error:** binding a non-optional type:
```
[INVALID_BINDING_TYPE] 'y' must be bound to an optional type in if binding
```

**Type annotation:** `if val y: Tipo = expr` é suportado — o tipo anotado é validado contra o tipo unwrapped:
```typescript
val x: int? = 42
if val y: int = x { }     // ✅ OK
// if val y: string = x { }  // ❌ TYPE_MISMATCH: Cannot bind 'y' with type 'string' to value of type 'int'
```

### While Loop

```typescript
var i: int = 0

while (i < 5) {
  i = i + 1
}

// With break
while (true) {
  if (condition) {
    break
  }
}

// With continue
var j: int = 0
while (j < 10) {
  j = j + 1
  if (j == 5) {
    continue
  }
  val x = j
}
```

### For Loop (Implemented ✓)
```typescript
// Basic for loop
for (var i: int = 0; i < 5; i = i + 1) {
  val x: int = i
}

// With val (immutable initializer)
for (val j: int = 0; j < 3; j = j + 1) {
  val y: int = j
}

// Nested for loops (proper scoping)
for (var i: int = 0; i < 3; i = i + 1) {
  for (var k: int = 0; k < 3; k = k + 1) {
    val z: int = i + k
  }
}

// With break
for (var m: int = 0; m < 10; m = m + 1) {
  if (m == 5) break
  val w: int = m
}

// With continue
for (var n: int = 0; n < 5; n = n + 1) {
  if (n == 2) continue
  val v: int = n
}

// Without initializer (uses external variable)
var ext: int = 0
for (; ext < 3; ext = ext + 1) {
  val t: int = ext
}

// Without condition (infinite loop with break)
for (var inf: int = 0;; inf = inf + 1) {
  if (inf > 5) break
}

// Without update (update inside body)
for (var p: int = 0; p < 3;) {
  val q: int = p
  p = p + 1
}
```

### For Loop Error Detection ✓
```typescript
// ❌ Break outside loop (INVALID_BREAK error)
// break  // ERROR: can only be used inside a loop

// ❌ Continue outside loop (INVALID_CONTINUE error)
// continue  // ERROR: can only be used inside a loop

// ❌ Reassignment to val in update (CANNOT_ASSIGN error)
for (val fixed: int = 0; fixed < 3; fixed = fixed + 1) {
  // ERROR: cannot assign to 'fixed'
}

// ❌ Invalid condition (INVALID_CONDITION error)
// for (var i: int = 0; "string"; i = i + 1) {
//   val x = 1
// }  // ERROR: condition must be boolean

// ✅ Nested loops with same variable name (separate scopes)
for (var k: int = 0; k < 2; k = k + 1) {
  for (var k: int = 10; k < 12; k = k + 1) {  // OK: different scope
    val inner_k: int = k  // 10, 11
  }
  val outer_k: int = k  // 0, 1 (unchanged)
}
```

---

## 12. Operators

### Arithmetic Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `a + b` |
| `-` | Subtraction | `a - b` |
| `*` | Multiplication | `a * b` |
| `/` | Division | `a / b` |
| `%` | Modulo | `a % b` |
| `-` (unary) | Negation | `-a` |

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equal | `a == b` |
| `!=` | Not equal | `a != b` |
| `<` | Less than | `a < b` |
| `>` | Greater than | `a > b` |
| `<=` | Less or equal | `a <= b` |
| `>=` | Greater or equal | `a >= b` |

### Logical Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `&&` | Logical AND | `a && b` |
| `||` | Logical OR | `a || b` |
| `!` | Logical NOT | `!a` |

### Assignment Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Assign | `a = b` |
| `+=` | Add assign | `a += b` |
| `-=` | Subtract assign | `a -= b` |
| `*=` | Multiply assign | `a *= b` |
| `/=` | Divide assign | `a /= b` |
| `%=` | Modulo assign | `a %= b` |

### Increment/Decrement

```typescript
var x: int = 10
x = x + 1  // Increment
x = x - 1  // Decrement
```

---

## 13. Spread Operator

**⚠️ Important:** The spread operator `...` is only valid in specific contexts (fixed in v1.0.2).

### Valid Contexts

```typescript
val arr1: int[] = [1, 2, 3]
val arr2: int[] = [4, 5, 6]

// ✅ Inside array literals
val combined: int[] = [...arr1, ...arr2, 7, 8]

// ✅ Inside object literals (if supported)
// val merged = { ...obj1, ...obj2 }

// ✅ Inside function calls (rest parameters)
// func sum(...numbers: int[]) { ... }
```

### Invalid Contexts (Parse Error)

```typescript
val arr: int[] = [1, 2, 3]

// ❌ Standalone (PARSE ERROR)
// val invalid = ...arr

// ❌ In binary expressions (PARSE ERROR)
// val bad = ...arr + 1
```

### Error Messages

When used incorrectly:
```
[Parse Error]: Unexpected token '...', expected expression.
At line X, column Y:
```

---

## 14. Comments

### Single-Line Comments

```typescript
// This is a comment
val x: int = 10  // Comment at end of line
```

### Multi-Line Comments (if supported)

```typescript
/* 
 * Multi-line comment
 * (Check if supported)
 */
```

---

## 15. Examples

### Complete Program

```typescript
// Type aliases
typealias ID = int
typealias UserData = ID | string

// Generic function
func identity<T>(x: T): T {
  return x
}

// Regular function
func greet(name: string): string {
  return "Hello, " + name
}

// Variables
val userId: ID = 123
var count: int = 0

// Generic function call with type inference
val inferred = identity(42)     // T → int

// Generic function call with explicit type args
val explicit = identity<string>("hello")

// Array with spread
val numbers: int[] = [1, 2, 3]
val allNumbers: int[] = [...numbers, 4, 5, 6]

// Union type
val value: int | string = "test"

// If/else
if (count > 0) {
  val msg: string = "positive"
} else {
  val msg: string = "zero or negative"
}

// While loop
while (count < 10) {
  count = count + 1
}

// Arrow function
val double: (int) => int = (x) => x * 2
val result: int = double(5)
```

---

## 16. Structs

Structs são tipos nominais com campos nomeados (similar a `struct` em Rust, `data class` em Kotlin, ou `record` em Java).

### 16.1 Declaração

```
struct Nome {
  campo: Tipo
  mut campoMut: Tipo
  campoComDefault: Tipo = valor
}
```

#### Exemplos

```typescript
// Struct básico
struct User {
  name: string
  age: int
}

// Campo mutável (pode ser reatribuído)
struct Counter {
  mut value: int
}

// Campo com valor default (opcional em literais e construtores)
struct Config {
  host:   string = "localhost"
  port:   int    = 8080
  secure: bool   = true
}

// Tipos compostos como campo
struct WithArrays {
  ids:     int[]
  matrix:  int[][]
  entries: Array<string>
}

// Union e nullable
struct Status {
  code:    int | string
  message: string?
}

// Struct vazio
struct Empty {}
```

### 16.2 Struct Literals

Criar um valor de struct com `Nome { campo: valor }`:

```typescript
val user = User { name: "Alice", age: 30 }
val cfg  = Config { host: "server" }           // port=8080, secure=true (defaults)
val c    = Counter { value: 0 }
val e    = Empty {}                             // struct vazio
```

**Regras:**
- Campos **sem** default são obrigatórios no literal
- Campos **com** default são opcionais
- Ordem dos campos não importa
- Tipos são validados campo a campo

#### Shorthand Field Assignment

Quando uma variável tem o **mesmo nome** do campo, pode usar `{ campo }` em vez de `{ campo: valor }`:

```typescript
struct Point { x: float; y: float }

func makePoint(x: float, y: float): Point {
  return Point { x, y }          // ≡ { x: x, y: y }
}

val p = makePoint(x: 3.0, y: 4.0)

// Misto: shorthand + nomeado
struct User { name: string; age: int; active: bool }

func create(name: string, age: int): User {
  return User { name, age, active: true }  // active é nomeado, name/age são shorthand
}
```

### 16.3 Field Access

```typescript
val name: string = user.name       // acesso simples
val city: string = user.addr.city  // acesso encadeado
```

**Nullable field access** — campos `T?` podem ser lidos e atribuídos a `null`:

```typescript
struct Profile {
  mut email: string?
}

val p = Profile { email: null }
p.email = "alice@example.com"       // atribuição em mut field
val e: string? = p.email            // leitura — tipo é string?
```

### 16.4 Mutable Fields

Campos declarados com `mut` podem ser reatribuídos:

```typescript
struct Counter {
  mut value: int
}

val c = Counter { value: 0 }
c.value = 42                         // ok — field é mut
// c.value = "x"                     // TYPE_MISMATCH — tipo errado
```

A variável que segura o struct pode ser `val` ou `var` — a mutabilidade é do campo, não da variável.

### 16.5 Methods

Structs podem ter métodos — funções declaradas dentro do corpo do struct.
O primeiro parâmetro implícito é `self`, que dá acesso aos campos.

```typescript
struct Point {
  x: float
  y: float

  // Método de leitura (self implícito)
  func magnitude(): float {
    return (self.x * self.x + self.y * self.y).sqrt()
  }

  // Método mutável — pode alterar self
  mut func scale(factor: float) {
    self.x = self.x * factor
    self.y = self.y * factor
  }

  // Método genérico
  func map<C>(fn: (float) => C): C {
    return fn(self.x)
  }
}

val p = Point { x: 3.0, y: 4.0 }
val m = p.magnitude()                // 5.0
p.scale(2.0)                         // Point { x: 6.0, y: 8.0 }
```

### 16.6 Constructors

Structs têm **dois modos** mutuamente exclusivos, determinados pela presença de `init`.

#### Auto-init (sem `init` declarado)

O compilador gera um construtor automático com **argumentos nomeados**:

```typescript
struct User {
  name: string
  age:  int
}

val u1 = User(name: "Alice", age: 30)  // ok
val u2 = User(age: 30, name: "Alice")  // ordem não importa
// val u3 = User("Alice", 30)           // ERROR: positional not allowed
```

Campos com default são opcionais no construtor:

```typescript
struct Config {
  host: string = "localhost"
  port: int    = 8080
}

val c = Config(host: "server")         // port=8080 (default)
```

#### Custom init (com `init` declarado)

Usa **argumentos posicionais** e corpo arbitrário:

```typescript
struct Token {
  mut value: string

  init(raw: string) {
    self.value = raw.trim()
  }
}

val t = Token("  hello  ")             // positional
// val t = Token(raw: "hello")         // ERROR: named not allowed in custom init
```

**Regra de inicialização:** campos sem default devem ser atribuídos no escopo raiz do `init` (não dentro de `if`/`for`):

```typescript
struct Rect {
  mut width:  int
  mut height: int = 0                  // opcional — tem default

  init(w: int) {
    self.width = w                     // ok — escopo raiz
    // self.height usa default (0)
  }
}
```

### 16.7 Generic Structs

Structs podem ter parâmetros de tipo:

```typescript
struct Box<T> {
  value: T
}

struct Pair<A, B> {
  first:  A
  second: B
}
```

**Uso com type args explícitos:**

```typescript
val b1 = Box<int> { value: 10 }
val b2 = Box<string> { value: "hello" }
val p  = Pair<int, string> { first: 1, second: "a" }
```

**Inferência de type args** (em construtores e literais):

```typescript
val b = Box { value: 42 }             // infere Box<int>
val p = Pair { first: 1, second: "a" } // infere Pair<int, string>
```

**Struct genérico como campo de outro struct:**

```typescript
struct Wrapper<T> { inner: Box<T> }

val w = Wrapper { inner: Box { value: 10 } }  // inferência encadeada
```

### 16.8 Type Aliases com Structs

Alias de struct é transparente — o alias e o original são o mesmo tipo:

```typescript
struct UserId { value: int }
typealias UID = UserId

val uid: UID    = UserId { value: 1 }
val uid2: UserId = uid                  // ok — mesmo tipo
```

**Generic type alias:**

```typescript
typealias IntBox = Box<int>
val b: IntBox = Box { value: 42 }

typealias StringPair<A> = Pair<A, string>
val p = StringPair { first: 1, second: "x" }  // Pair<int, string>
```

### 16.9 Nominal Typing

Structs são **nominais** — duas declarações com os mesmos campos **não** são o mesmo tipo:

```typescript
struct UserId  { value: int }
struct ProductId { value: int }

val uid = UserId { value: 1 }
val pid = ProductId { value: 1 }

// uid = pid           // TYPE_MISMATCH — nomes diferentes
// uid == pid          // TYPE_MISMATCH
```

### 16.10 Struct Equality

Structs suportam `==` e `!=` com comparação estrutural (deep equality):

```typescript
struct Person { name: string; age: int }

val a = Person { name: "Alice", age: 30 }
val b = Person { name: "Bob",   age: 25 }

val eq: bool = a == b                  // false (em runtime)
val ne: bool = a != b                  // true
val same: bool = a == a                // true — mesma variável
```

**Regras:**

| Comparação | Resultado |
|---|---|
| `Person == Person` | ✅ mesmo tipo nominal |
| `Person == ProductId` | ❌ TYPE_MISMATCH — nomes diferentes |
| `Box<int> == Box<int>` | ✅ mesmos type args |
| `Box<int> == Box<string>` | ❌ TYPE_MISMATCH — args diferentes |
| `UserId? == null` | ✅ nullable com null |
| `UserId == null` | ❌ TYPE_MISMATCH — non-nullable |
| `UID == UserId` | ✅ alias transparente |
| `Person == 42` | ❌ TYPE_MISMATCH — struct ≠ primitive |

**Deep equality de arrays:** arrays dentro de structs são comparados elemento a elemento.

```typescript
struct Data { values: int[] }
val d1 = Data { values: [1, 2, 3] }
val d2 = Data { values: [1, 2, 3] }
val eq = d1 == d2            // true — deep equality
```

### 16.11 Exemplos Completos

```typescript
// Modelo de domínio com structs
typealias Email = string

struct Address {
  street: string
  city:   string
  zip:    string?
}

struct Person {
  name:    string
  email:   Email
  address: Address
  mut age: int = 0

  func isAdult(): bool {
    return self.age >= 18
  }

  mut func birthday() {
    self.age = self.age + 1
  }
}

val addr = Address { street: "123 Main", city: "NYC", zip: null }
val p = Person { name: "Alice", email: "a@b.com", address: addr }

val adult: bool = p.isAdult()
p.birthday()

// Struct genérico com método
struct Result<T, E> {
  value: T
  error: E?

  func isOk(): bool {
    return self.error == null
  }

  func unwrap(): T {
    return self.value
  }
}

val ok: Result<int, string> = Result { value: 42, error: null }
val okCheck: bool = ok.isOk()
```

---

## Implemented Features (✓)

- [x] **Structs** - Declaração, literais, métodos, construtores, genéricos, equality
- [x] **For loops** - `for (var i: int = 0; i < 10; i++)`
- [x] **Ternary Operator** - `condition ? a : b`
- [x] **Nullish Coalescing** - `??` operator
- [x] **Generic Functions** - `func foo<T>(x: T): T`
- [x] **Generic Arrow Functions** - `<T>(x: T): T => x` with explicit type args and contextual inference
- [x] **Multi-Type-Param Arrow Inference** - `swap(<A,B>(...)=>..., 1, "hello")` infers A→int, B→string
- [x] **Bidirectional Type Inference** - contextual type participates in generic inference
- [x] **Optional Binding** - `if val x = expr`, `if (val x = expr)`, and chained binding `if val x = a, val y = b`


## Planned Features (Not Yet Implemented)

- [ ] **Classes** - Object-oriented programming
- [ ] **Androx** - JSX-like syntax native to the language
- [ ] **Import/Export** - Module system
- [ ] **Template Literals** - String interpolation
- [ ] **Async/Await** - Asynchronous programming
- [ ] **Generic type aliases** - `typealias Container<T> = T`

---

## CLI Usage

```bash
# Run a file (syntax + semantic)
bun src/main.ts run file.med

# Compile (lexer + parser + semantic)
bun src/main.ts compile file.med

# Show tokens
bun src/main.ts tokens file.med

# Show AST
bun src/main.ts ast file.med

# Show help
bun src/main.ts help

# Show version
bun src/main.ts version
```

---

**Documentation Version:** 1.0.2  
**Last Updated:** May 12, 2026
