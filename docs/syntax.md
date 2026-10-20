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
17. [Protocols](#17-protocols)
    - [Declaration](#171-declaração)
    - [Protocol Methods](#172-protocol-methods)
    - [Struct implements Protocol](#173-struct-implements-protocol)
    - [Protocol Conformance](#174-protocol-conformance)
    - [Protocol as Type](#175-protocol-as-type)
    - [Protocol Generics](#176-protocol-generics)
    - [Self Type](#177-self-type)
    - [Error Cases](#178-error-cases)
18. [Extend](#18-extend)
    - [Ordem e hoisting](#181-ordem-e-hoisting)
    - [Métodos](#182-métodos)
    - [mut func](#183-mut-func)
    - [Conflitos de nome](#184-conflitos-de-nome)
    - [implements Protocol](#185-implements-protocol)
    - [Campos no extend](#186-campos-no-extend)
    - [Campos em struct com init custom](#187-campos-em-struct-com-init-custom)
    - [extend em primitivos](#188-extend-em-primitivoses-conhecidas)
19. [Builtins](#19-builtins)

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
| Required after optional | `func f(a: int = 1, b: int)` | `Required parameter cannot follow optional parameter` |
| Rest with default | `func f(...rest: int = [])` | `Rest parameter cannot have a default value` |
| Default type mismatch | `func f(a: string = 42)` | `default value type 'int' incompatible with parameter type 'string'` |

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

// Function with default parameter values
func greet(name: string = "World"): string {
  return "Hello, " + name
}

func makePoint(x: int = 0, y: int = 0): string {
  return "(" + x + ", " + y + ")"
}
```

### Default Parameter Values

Parâmetros podem ter valores default usando `= valor`:

```typescript
func add(a: int = 1, b: int = 2): int {
  return a + b
}

val r1 = add()        // 3 (1 + 2)
val r2 = add(10)      // 12 (10 + 2)
val r3 = add(5, 7)    // 12 (5 + 7)
```

**Regras:**
- Parâmetros com default devem vir **após** parâmetros obrigatórios
- `rest` parameter (`...`) **não pode** ter default
- Default value deve ser compatível com o tipo do parâmetro

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

### Error Cases (Default Parameters)

| Error | Example | Message |
|-------|---------|---------|
| Required after optional | `func f(a: int = 1, b: int)` | `Required parameter cannot follow optional parameter` |
| Rest with default | `func f(...rest: int = [])` | `Rest parameter cannot have a default value` |
| Default type mismatch | `func f(a: string = 42)` | `default value type 'int' incompatible with parameter type 'string'` |

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

### Default Parameter Values in Arrow Functions

Arrow functions também suportam default parameter values:

```typescript
val greet = (name: string = "World"): string => "Hello, " + name

val makePoint = (x: int = 0, y: int = 0): string => "(" + x + ", " + y + ")"

val g1 = greet()        // "Hello, World"
val g2 = greet("Arrow") // "Hello, Arrow"

val p1 = makePoint()           // "(0, 0)"
val p2 = makePoint(10)         // "(10, 0)"
val p3 = makePoint(10, 20)     // "(10, 20)"
```

Mesmas regras das funções regulares se aplicam: parâmetros obrigatórios primeiro, rest sem default, tipagem compatível.

### Error Cases (Arrow Functions com Default Parameters)

| Error | Example | Message |
|-------|---------|---------|
| Required after optional | `val f = (a: int = 1, b: int) => a + b` | `Required parameter cannot follow optional parameter` |
| Rest with default | `val f = (...rest: int = []) => rest` | `Rest parameter cannot have a default value` |
| Default type mismatch | `val f = (a: string = 42) => a` | `default value type 'int' incompatible with parameter type 'string'` |

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
| `/` | Division | `a / b` — `int / int` é inteira (truncada), ver [divisão inteira](#divisão-inteira) |
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

## 17. Protocols

Protocols definem contratos de comportamento que structs podem implementar (similar a `protocol` em Swift, `interface` em Kotlin/Java, ou `trait` em Rust).

### 17.1 Declaração

```
protocol Nome {
  func metodo(): TipoRetorno
  func metodoComParam(param: Tipo): TipoRetorno
}
```

#### Exemplos

```typescript
// Protocol básico
protocol Stringable {
  func toString(): string
}

// Protocol com parâmetros e retorno
protocol Equatable {
  func equals(other: Self): bool
}

// Protocol genérico
protocol Container<T> {
  func get(): T
  func set(value: T): void
}

// Protocol com múltiplos métodos
protocol Comparable {
  func compare(other: Self): int
  func equals(other: Self): bool
}
```

**Regras:**
- Apenas assinaturas de métodos (sem corpo)
- Tipos de parâmetros e retorno obrigatórios
- `Self` type refere-se ao tipo que implementa o protocol
- Type parameters permitidos: `protocol Container<T>`

### 17.2 Protocol Methods

Methods em protocols são **apenas assinaturas** — não têm corpo.

```typescript
protocol Stringable {
  func toString(): string               // método sem parâmetros
  func toStringWith(prefix: string): string  // com parâmetro
  func format(): string                  // com retorno

  // Self type — refere-se ao tipo implementador
  func equals(other: Self): bool

  // Type parameters no método
  func map<U>(fn: (T) => U): U
}
```

**Regras:**
- Não pode ter corpo `{ ... }` — erro de parse se tentar
- Parâmetros requerem type annotation
- Return type annotation obrigatório se não `void`
- `Self` type válido apenas em protocols
- Type parameters permitidos: `func metodo<T>(x: T): T`
- **Default parameter values NÃO são suportados** — protocol methods definem contratos (assinaturas), não implementação. Default values são detalhe de implementação.

```typescript
protocol Logger {
  func log(msg: string, level: string): void  // ❌ sem default
}

struct ConsoleLogger implements Logger {
  func log(msg: string, level: string = "info"): void {  // ✅ default na implementação
    print("[" + level + "] " + msg)
  }
}
```

### 17.3 Struct implements Protocol

Structs implementam protocols com `implements`:

```typescript
protocol Stringable {
  func toString(): string
}

struct User implements Stringable {
  name: string

  func toString(): string {
    return "User(" + self.name + ")"
  }
}

print(User { name: "Alice" })   // User(Alice)
```

**Múltiplos protocols:**
```typescript
protocol Stringable { func toString(): string }
protocol Serializable { func serialize(): string }

struct User implements Stringable, Serializable {
  name: string

  func toString(): string { return "User(" + self.name + ")" }
  func serialize(): string { return self.name }
}
```

**Struct genérico implementa protocol genérico:**
```typescript
protocol Container<T> {
  func get(): T
  func set(value: T): void
}

struct Box<T> implements Container<T> {
  mut value: T
  
  func get(): T { return self.value }
  func set(value: T): void { self.value = value }
}

val box = Box<int> { value: 42 }
val v = box.get()  // int
```

**Regras:**
- Todos métodos do protocol devem ser implementados
- Assinaturas devem ser compatíveis (params + return type)
- Struct genérico pode implementar protocol genérico com mesmos type params
- Múltiplos protocols separados por vírgula

### 17.4 Protocol Conformance (Type Checker)

O type checker valida conformance automaticamente:

```typescript
protocol Stringable { func toString(): string }

struct User implements Stringable {
  name: string
  // ERROR: missing method 'toString'
}
```

**Erros detectados:**
- `MISSING_PROTOCOL_METHOD` — método requerido não implementado
- `PROTOCOL_METHOD_MISMATCH` — assinatura incompatível
- `PROTOCOL_NOT_FOUND` — protocol não existe
- `DUPLICATE_PROTOCOL_METHOD` — método duplicado no protocol

### 17.5 Protocol as Type

Protocols podem ser usados como tipos:

```typescript
protocol Stringable { func toString(): string }

struct User implements Stringable { ... }
struct Logger implements Stringable { ... }

val p: Stringable = User { name: "Alice" }  // upcast implícito
p.toString()

val items: Stringable[] = [User { name: "A" }, Logger { ... }]
for item in items { item.toString() }
```

**Upcast implícito:** struct → protocol é automático quando struct implementa o protocol.

### 17.5.1 Method Resolution on Protocol Types

Quando uma variável é declarada com o tipo de um protocolo, o type checker resolve chamadas de método contra os métodos declarados no protocolo (não no struct subjacente):

```typescript
protocol Stringable {
  func toString(): string
}

struct User implements Stringable {
  name: string
  func toString(): string {
    return "User(" + self.name + ")"
  }
}

val p: Stringable = User { name: "Alice" }
p.toString()  // OK - resolve 'toString' do protocolo Stringable
```

**Regras:**
- Apenas métodos declarados no protocolo estão acessíveis através do tipo do protocolo
- Campos do struct não são acessíveis através do tipo do protocolo (apenas métodos)
- Se o método não existe no protocolo, ocorre erro `UNKNOWN_PROPERTY`
- Assinatura do método é validada contra a declaração no protocolo

### 17.6 Protocol Generics

```typescript
protocol Container<T> {
  func get(): T
  func set(value: T): void
}

struct Box<T> implements Container<T> {
  mut value: T
  func get(): T { return self.value }
  func set(value: T): void { self.value = value }
}

val box = Box<int> { value: 42 }
val v: int = box.get()
box.set(10)
```

**Type args na declaração:**
```typescript
val box: Container<int> = Box<int> { value: 42 }
val box2: Container<string> = Box<string> { value: "hi" }
```

### 17.7 Self Type

`Self` refere-se ao tipo concreto que implementa o protocol:

```typescript
protocol Equatable {
  func equals(other: Self): bool
}

struct UserId implements Equatable {
  value: int
  
  func equals(other: Self): bool {  // Self = UserId
    return self.value == other.value
  }
}

val a = UserId { value: 1 }
val b = UserId { value: 1 }
val eq = a.equals(b)  // Self resolvido para UserId
```

### 17.8 Error Cases

| Error | Exemplo | Mensagem |
|-------|---------|----------|
| `PROTOCOL_NOT_FOUND` | `struct X implements NonExistent` | `protocol 'NonExistent' not found` |
| `MISSING_PROTOCOL_METHOD` | Faltando método | `missing method 'toString' required by protocol 'Stringable'` |
| `PROTOCOL_METHOD_MISMATCH` | Assinatura errada | `method 'toString' signature mismatch: expected '() => string', got '(string) => void'` |
| `DUPLICATE_PROTOCOL_METHOD` | Duplicado no protocol | `duplicate method 'toString' in protocol` |
| `GENERIC_ARG_COUNT` | Type args errados | `Generic protocol 'Container' expects 1 type argument(s), got 2` |
| `ALREADY_DECLARED` | Type param duplicado | `'T' is already declared` |
| `UNKNOWN_PROPERTY` | Método não existe no protocolo | `property 'foo' does not exist` (acessando método inexistente em variável tipada como protocolo) |

---

## 16. Structs

Structs são tipos nominais com campos nomeados (similar a `struct` em Rust,
`data class` em Kotlin, ou `record` em Java).

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

**Bare field access** — dentro de métodos e `init` de struct, campos podem ser acessados pelo nome nu (sem `self.`):

```typescript
struct Counter {
  mut value: int = 0

  func increment() {
    value = value + 1      // ≡ self.value = self.value + 1
  }

  func get(): int {
    return value           // ≡ return self.value
  }
}
```

A regra vale para leitura e escrita. Parâmetros e variáveis locais com o mesmo nome **sombreiam** o campo:

```typescript
struct Shadow {
  x: int = 10

  func setX(x: int) {
    x = x                 // parâmetro sombreia campo — campo NÃO é alterado
    self.x = x            // use self.x para acessar o campo
  }
}
```

### Error Cases

**UNKNOWN_PROPERTY** — propriedade não existe no struct:
```typescript
struct User { name: string }
val u = User { name: "Alice" }
val x = u.age
// ERROR: property 'age' does not exist
```

**INVALID_MEMBER_ACCESS** — acesso a campo em tipo não-struct:
```typescript
val n: int = 42
val x = n.name
// ERROR: cannot access property on non-struct type 'int'
```

**Nullability** — acesso a campo em nullable struct (futuro):
```typescript
struct User { name: string }
val u: User? = null
val x = u.name
// ERROR: cannot access property 'name' on nullable type 'User?' — use optional binding or nullish coalescing
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

**Default Parameter Values in Methods**

Métodos de struct também suportam default parameter values:

```typescript
struct Counter {
  mut value: int = 0
  
  func increment(step: int = 1): int {
    value = value + step
    return value
  }
  
  func setValue(v: int = 10): int {
    value = v
    return value
  }
}

val c = Counter()
print(c.increment())   // 1 (step=1 default)
print(c.increment(5))  // 6 (step=5)
print(c.setValue())    // 10 (v=10 default)
print(c.setValue(42))  // 42 (v=42)
```

Mesmas regras das funções: parâmetros obrigatórios primeiro, rest sem default, tipagem compatível.

**Bare method calls** — dentro de métodos e `init` de struct, métodos podem ser chamados pelo nome nu (sem `self.`):

```typescript
struct Counter {
  mut value: int = 0

  func double(): int {
    return value * 2        // bare field access
  }

  func show(): string {
    return "Value: " + value
  }

  init(start: int) {
    value = start
    print("Init: " + show())  // bare method call in init
  }
}

extend Counter {
  func triple(): int {
    return value * 3
  }

  func incAndShow(step: int): string {
    value = value + step
    return show()           // bare method call in extend method
  }
}
```

A regra vale para chamadas diretas (`b()`) e para referências a métodos como valor (`val f = b` → `this.b`). Parâmetros e variáveis locais com o mesmo nome **sombreiam** o método:

```typescript
struct ShadowTest {
  func getX(): int { return 10 }

  func testShadow(getX: int): int {
    return getX() + getX   // primeira: parâmetro (call inválido), segunda: método
  }
}
```

Métodos de `extend` são incluídos automaticamente — um método do struct pode chamar método de `extend` por nome nu, e vice-versa.

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

#### Default Parameter Values in Custom Init

Construtores customizados (`init`) também suportam default parameter values:

```typescript
struct Counter {
  mut value: int
  mut step: int = 1

  init(start: int = 0, step: int = 1) {
    self.value = start
    self.step = step
  }
}

val c1 = Counter()        // start=0, step=1
val c2 = Counter(10)      // start=10, step=1
val c3 = Counter(10, 5)   // start=10, step=5

print("c1: " + c1.value + ", step=" + c1.step)  // 0, 1
print("c2: " + c2.value + ", step=" + c2.step)  // 10, 1
print("c3: " + c3.value + ", step=" + c3.step)  // 10, 5
```

**Regras de aridade:**
- Mínimo de args = parâmetros **sem** default value
- Chamadas válidas: `minRequiredArgs <= args.length <= totalParams`
- Ex: `init(a: int = 1, b: int = 2)` → 0, 1 ou 2 args permitidos

Mesmas regras das funções: parâmetros obrigatórios primeiro, rest sem default, tipagem compatível.

### Error Cases (Init com Default Parameters)

| Error | Example | Message |
|-------|---------|---------|
| Required after optional | `init(a: int = 1, b: int)` | `Required parameter cannot follow optional parameter` |
| Rest with default | `init(...rest: int = [1])` | `Rest parameter cannot have a default value` |
| Default type mismatch | `init(a: string = 42)` | `default value type 'int' incompatible with parameter type 'string'` |

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

### Error Cases

**Wrong type arg count:**
```typescript
val bad = Box<int, string> { value: 10 }
// ERROR: Generic struct 'Box' expects 1 type argument(s), got 2
```

**Duplicate type param:**
```typescript
struct Dup<T, T> { value: T }
// ERROR: 'T' is already declared
```

**Unresolvable type param (T not used in fields):**
```typescript
struct Ghost<T> { label: string }
val bad = Ghost(label: "x")
// ERROR: cannot infer type parameter 'T' for 'Ghost' — provide an explicit annotation: Ghost<Type>(...)
```

**Partial inference (some type params not inferable):**
```typescript
struct Half<A, B> { a: A; meta: string }
val bad = Half(a: 1, meta: "x")
// ERROR: cannot infer type parameter 'B' for 'Half' — provide an explicit annotation
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

## 18. Extend

`extend` adiciona **métodos e campos** a um tipo já declarado — structs e
primitivos de valor — sem editar a declaração original (similar a extensions em
Kotlin/Swift). Serve para compor o programa progressivamente: cada bloco de
código pode estender tipos de outro módulo sem reabri-los.

### 18.1 Ordem e hoisting

O `extend` **precisa vir depois** da declaração do alvo. Não há hoisting: antes
do `struct`, o alvo não foi declarado e o compilador não acha:

```typescript
extend Ghost { }                 // ❌ [UNDEFINED_TYPE] type 'Ghost' is not found

struct Greeter { who: string }

extend Greeter {
  func hello(): string {
    return "Oi " + self.who
  }
}

val g = Greeter { who: "Ana" }
print(g.hello())                 // "Oi Ana"
```

**Os corpos de método são a exceção — os dois lados se enxergam.** Ao declarar
o `struct`, o compilador pré-registra todos os `extend`s do programa, então um
método do `struct` chama método do `extend` que vem depois:

```typescript
struct Greeter {
  who: string

  func hi(): string {
    return self.hello() + "!"    // ok, `hello` vem do extend abaixo
  }
}

extend Greeter {
  func hello(): string {
    return "Oi " + self.who
  }
}

print(Greeter { who: "Ana" }.hi())   // "Oi Ana!"
```

Nos dois sentidos: método do `extend` chama método do `struct`, e um método do
`extend` chama outro `extend` do mesmo tipo.

**Código executável, porém, roda linha a linha.** O checker valida os nomes
independente da posição, mas uma chamada escrita **acima** da linha do
`extend` executa antes do método existir:

```typescript
val u = Greeter { who: "Ana" }
print(u.hello())                 // checker: ok — runtime: explodiu, prototype ainda não tem `hello`

extend Greeter { func hello(): string { return "Oi " + self.who } }
```

Regra prática: declare os `extend`s **antes** do código executável que os usa.

### 18.2 Métodos

Métodos do `struct` e do `extend` convivem como se tivessem sido declarados
juntos — `self` funciona igual:

```typescript
struct User {
  name: string
  age: int

  func isAdult(): bool {
    return self.age >= 18
  }
}

extend User {
  func greeting(): string {
    return "Oi, " + self.name
  }

  func olderThan(age: int): bool {
    return self.age > age
  }
}

val u = User { name: "Ana", age: 20 }
print(u.greeting())        // "Oi, Ana"
print(u.isAdult())         // true
print(u.olderThan(18))     // true
```

Vários `extend` no mesmo tipo são permitidos desde que não repitam nome — cada
um pode trazer métodos e campos:

```typescript
struct Config {
  host: string = "localhost"
}

extend Config {
  port: int = 8080
}

extend Config {
  secure: bool = true
}

val c = Config { host: "lo" }
print(c.port)              // 8080
print(c.secure)            // true
```

### Default Parameter Values in Extend Methods

Métodos adicionados via `extend` também suportam default parameter values:

```typescript
extend String {
  func center(width: int, fillChar: string = " "): string {
    val padding = width - self.length
    if (padding <= 0) return self
    val left = padding / 2
    val right = padding - left
    var result = ""
    var i = 0
    while (i < left) {
      result = result + fillChar
      i = i + 1
    }
    result = result + self
    i = 0
    while (i < right) {
      result = result + fillChar
      i = i + 1
    }
    return result
  }
}

print("hi".center(10))        // "    hi    "
print("hi".center(10, "-"))   // "----hi----"
print("hello".center(5))      // "hello"
print("".center(5, "*"))      // "*****"
```

Mesmas regras das funções regulares se aplicam.

`mut func` funciona igual dentro do `extend`, e em primitivos também:

```typescript
struct Counter { mut value: int }

extend Counter {
  mut func increment(step: int): int {
    self.value = self.value + step
    return self.value
  }
}

extend Integer {
  mut func times(factor: int): int { return self * factor }
}

val c = Counter { value: 10 }
print(c.increment(5))      // 15
print(7.times(6))          // 42
```

Reatribuir `self = ...` direto é proibido — inclusive em primitivos — com
`CANNOT_ASSIGN`: `'self' is immutable`.

### Error Cases (Extend Methods com Default Parameters)

| Error | Example | Message |
|-------|---------|---------|
| Required after optional | `extend S { func f(a: int = 1, b: int) }` | `Required parameter cannot follow optional parameter` |
| Rest with default | `extend S { func f(...rest: int = []) }` | `Rest parameter cannot have a default value` |
| Default type mismatch | `extend S { func f(a: string = 42) }` | `default value type 'int' incompatible with parameter type 'string'` |

### 18.4 Conflitos de nome

| Situação | Erro |
|----------|------|
| método já existe no struct | `[EXTENSION_CONFLICT] method 'isAdult' already exists in 'User'` |
| nome repetido dentro do mesmo `extend` | `[EXTENSION_CONFLICT]` |
| nome repetido em outro `extend` do mesmo tipo | `[EXTENSION_CONFLICT]` |
| método que já existe no primitivo | `[EXTENSION_CONFLICT] method 'upper' already exists in 'string'` |
| alvo não existe | `[UNDEFINED_TYPE] type 'Ghost' is not found` |
| alvo existe mas não é struct | `[EXTEND_TARGET_INVALID] cannot extend 'Integer': expected a struct, but it is a built-in type` |
| primitivo não extensível (`Void`, `Null`, `Any`, `Unknown`) | `[EXTEND_TARGET_INVALID] ... is not an extendable type` |

Um nome de campo e um nome de método iguais **não** são detectados como conflito
(veja [Limitações](#188-limitações-conhecidas)).

Método adicionado por `extend` **não** conta para `implements` — a conformância
é verificada quando o `struct` é declarado.

### 18.5 implements Protocol

O `extend` pode declarar que adiciona conformidade a um protocol ao struct alvo,
usando a cláusula `implements Protocol` após o nome do tipo alvo:

```typescript
struct User {
  name: string
}

extend User implements Stringable {
  func toString(): string {
    return "User(" + self.name + ")"
  }
}

func printUser(u: Stringable) {
  print("User: " + u.toString())
}

val u = User { name: "Ana" }
printUser(u)  // User(Ana)
```

**Regras:**
- O alvo do `extend` deve ser um struct (não primitivo, não protocol)
- O protocol deve existir e ser do tipo `protocol`
- O `extend` deve fornecer todos os métodos requeridos pelo protocol
- A conformância é verificada em compile-time — erro se faltar método
- O upcast implícito `struct → protocol` funciona em chamadas de função

**Regras de erro:**
| Erro | Exemplo | Mensagem |
|-------|---------|----------|
| Protocol não existe | `extend S implements Ghost { }` | `protocol 'Ghost' not found` |
| Alvo não é struct | `extend String implements S { }` | `cannot extend 'String': expected a struct` |
| Método faltando | `extend S implements Stringable { }` | `missing method 'toString'` |
| Assinatura incompatível | `extend S implements Stringable { func toString(): int }` | `signature mismatch` |

**Nota:** O `extend implements` permite adicionar conformidade a protocols *depois* da declaração do struct, útil para compor bibliotecas de terceiros. O método pode vir do próprio `extend` (como no exemplo) ou já existir no struct original.

### 18.6 Campos no `extend`

`extend` também pode declarar **campos**, que viram propriedade da instância e
são injetados no construtor auto-init:

```typescript
struct Example {
  name: string
}

extend Example {
  mut id: string                 // sem default: obrigatório
  hash: string = "auto"          // com default: opcional

  mut func rehash(value: string) {
    self.hash = value
  }

  func short(): string {
    return self.name + "/" + self.id
  }
}

val e = Example { name: "a", id: "1", hash: "x" }
print(e.short())           // "a/1"
print(e)                   // Example { name: "a", id: "1", hash: "x" }

e.rehash("y")
print(e.hash)              // "y"

val f = Example { name: "b", id: "2" }   // hash = "auto"
```

Como viram propriedade própria, `print()` os mostra normalmente — diferente de
propriedade em prototype, que o formatador não enxergaria.

Campo sem default fica **obrigatório** no literal e no construtor:

```typescript
val g = Example { name: "c" }
// ❌ [TYPE_MISMATCH] missing required field 'id' in struct literal for 'Example'
```

| Situação | Erro |
|----------|------|
| campo repete campo do struct, do mesmo `extend` ou de outro | `[EXTENSION_CONFLICT] field 'name' already exists in 'User'` |
| campo **sem default** em struct com `init` custom | `[EXTEND_TARGET_INVALID] cannot add field 'extra' to 'D' without a default — it has a custom init, which takes positional arguments` |
| campo em struct com `init` custom **com rest param** | `[EXTEND_TARGET_INVALID] ... its init uses a rest parameter and cannot accept extra fields` |
| campo obrigatório faltando no literal | `[TYPE_MISMATCH] missing required field 'id'` |

### 18.7 Campos em struct com `init` custom

Com `init` declarado, o construtor é **posicional**, então o campo só pode
entrar **com default** — ele anexa o fim da lista de parâmetros e o JS preenche
o default quando a chamada omite o argumento:

```typescript
struct Token {
  mut value: string

  init(raw: string) {
    self.value = raw.trim()
  }
}

extend Token {
  hash: string = "auto"
}

val t = Token("  hello  ")        // hash = "auto"
val t2 = Token("  hello  ", "z")  // hash = "z"
print(t2)            // Token { hash: "z", value: "hello" }
```

- **Mínimo de args**: o número de parâmetros do `init` — `Token()` continua
  dando `expected 1 arguments, got 0`.
- **Máximo de args**: params do `init` + campos-default do `extend`. Passou
  disso: `[ARGUMENT_COUNT_MISMATCH] expected 2 arguments, got 3`.
- **Campo sem default é proibido**: não há por onde receber o valor —
  `[EXTEND_TARGET_INVALID] cannot add field 'extra' to 'D' without a default`.
- **`init` com rest param não aceita campo**: JS não aceita default depois de
  `...rest` — erro mesmo com default.
- As atribuições dos campos rodam **antes** do corpo do `init`, então em
  `print()` o campo do extend aparece **antes** dos campos do struct.

### 18.8 extend em primitivos

Primitivo se escreve **pelo alias capitalizado** — o `string` minúsculo é
token de tipo, não identificador:

```typescript
extend string { }   // ❌ Parse Error: Expected type name after 'extend'
extend String { }   // ✅
```

Funciona em `int`, `float`, `string` e `bool` (`Integer`, `Float`, `String`,
`Boolean`). `void`, `null`, `any` e `unknown` não são extensíveis.

```typescript
extend String {
  func shout(): string {
    return self.upper() + "!"
  }

  func has(text: string): bool {
    return self.contains(text)
  }
}

print("ana".shout())              // "ANA!"
print("andromeda".has("rome"))    // true
```

Os métodos **não** vão para `String.prototype` — patchear o prototype global
poluiria todo string vindo de qualquer biblioteca, sem como desfazer. Eles ficam
num registro por primitivo:

```javascript
$ext["string"] = Object.assign($ext["string"] || {}, {
  shout: function (self) { return self.toUpperCase() + "!"; },
});
```

e a chamada é reescrita: `s.shout()` → `$ext["string"].shout(s)`. Por isso
funcionam em cadeia com os embutidos, atravessando tipos:

```typescript
print("  x  ".trim().shout())            // string → string (builtin) → extend
print(42.toFloat().toString().shout())   // int → float → string → extend
```

### 18.9 Limitações conhecidas

**Cravos que ainda não existem, e pegadinhas honestas:**

- **`struct { }` literal não vale em struct com `init` custom.** O literal é a
  forma de auto-init; com init custom o construtor é posicional:

  ```typescript
  struct T { mut value: string; init(raw: string) { self.value = raw.trim() } }

  T("  x  ")             // ✅ ok
  T { value: "x" }       // ❌ ERROR: has a custom init and takes positional arguments
  ```

- **`Array<T>`** ainda não é extensível.

- **Campo em `extend` de primitivo não é suportado** — e hoje é
  **silenciosamente ignorado**: `extend String { ghost: int = 3 }` compila e
  nenhum campo nasce (o suporte a primitivo só cobre métodos). Aguardando
  diagnóstico explícito.

- **Campo e método com o mesmo nome** também não são detectados como conflito
  hoje: o campo prevalece no acesso (`x.name`), a chamada dá `INVALID_CALL`, e
  o método do prototype vira código morto. Evite até virar
  `[EXTENSION_CONFLICT]`.

- **Não há narrowing** depois de `if (x == null)` — use `if val` (ver
  [Optional Binding](#optional-binding-if-val--if-var)).

---

## 19. Builtins

Builtins são funções disponíveis em qualquer escopo sem declaração. A referência
completa da API está em [`docs/controlls/api-bultins.md`](controlls/api-bultins.md).

### print

```typescript
print(...values: any[]): void
```

Escreve os argumentos em stdout separados por um espaço, sempre com quebra de
linha no final:

```typescript
print("Andromeda")            // Andromeda
print(42)                     // 42
print("cidade:", "Recife")    // cidade: Recife
print()                       // (linha vazia)

val nums: int[] = [1, 2, 3]
print(nums)                   // [1, 2, 3]
```

`print` aceita qualquer valor, nunca lança exceção e não pode ser redefinida
(`CANNOT_REDEFINE_BUILTIN`).

### Formatação de structs

Structs são formatados como `Nome { campo: valor }`:

```typescript
struct User { name: string; age: int }
print(User { name: "Alice", age: 30 })   // User { name: "Alice", age: 30 }
```

### Métodos de `int`

Primitivos têm métodos, com receiver explícito ou inferido:

```typescript
val age: int = -10
age.toString()          // "-10"
age.isEven()            // true
age.toFloat()           // -10.0

val test = 1
test.isOdd()            // true  — receiver inferido do literal
```

| Método | Retorno |
|--------|---------|
| `toString()` | `string` |
| `toFloat()` | `float` |
| `isEven()` | `bool` |
| `isOdd()` | `bool` |

O receiver é implícito e só existe método quando **não há operador** para a
operação — por isso não existe `age.isPositive()` (use `age > 0`) nem
`age.abs()`. Método inexistente gera `UNKNOWN_METHOD` com a lista do que existe.

### Métodos de `string`

```typescript
val nome: string = "  Ana Silva  "

nome.trim()                    // "Ana Silva"
nome.trim().upper()            // "ANA SILVA"
nome.trim().lower()            // "ana silva"
nome.trim().length             // 9 — propriedade, sem ()
nome.contains("Silva")         // true
nome.indexOf("Ana")            // 2
nome.trim().substring(0, 3)    // "Ana"
"a,b,c".split(",")             // ["a", "b", "c"]
"banana".replace("an", "X")    // "bXXa" — todas as ocorrências
```

| Entrada | Params | Retorno |
|---------|--------|---------|
| `length` | — | `int` |
| `upper()` / `lower()` | — | `string` |
| `trim()` | — | `string` |
| `isEmpty()` | — | `bool` |
| `contains(value)` | `string` | `bool` |
| `indexOf(value)` | `string` | `int` |
| `substring(from, to)` | `int, int` | `string` |
| `split(separator)` | `string` | `string[]` |
| `replace(old, new)` | `string, string` | `string` |
| `toInt()` | — | `int?` |
| `toFloat()` | — | `float?` |

`length` é **propriedade**: chamar `s.length()` dá `INVALID_CALL`. `isEmpty()`
existe porque a forma com operador exige parênteses ao negar — `!(s == "")`
contra o `!s.isEmpty()` direto.

### Conversão com Optional

`toInt()` e `toFloat()` devolvem `int?` / `float?`, com `null` quando a string
não é número — em vez de `NaN` com tipo `int`:

```typescript
val n: int? = "42".toInt()
if val v = n {
  print(v.isEven())     // v já é int — Optional desembrulhado
} else {
  print("não era número")
}

"".toInt()               // null, não 0
"3.7".toInt()            // 3 — trunca, não arredonda
```

### Métodos de `float` e `bool`

`float` e `bool` só convertem — matemática de `float` fica com os operadores.

| Tipo | Método | Retorno |
|------|--------|---------|
| `float` | `toString()` | `string` |
| `float` | `toInt()` | `int` (trunca: `3.14 → 3`) |
| `bool` | `toString()` | `string` |

`float.toInt()` devolve `int` direto, sem `Optional`: um float **é** um número,
nunca "não é número" — ao contrário de `string.toInt()`.

### Interconexão entre primitivos

Como os métodos devolvem primitivos, as cadeias fluem entre os tipos:

```typescript
"  Ana  ".trim().lower().length.isEven()   // string → string → int → bool
42.toString().upper().length.isEven()      // int → string → string → int → bool
2.toFloat().toString().length.isEven()     // int → float → string → int → bool
const n = ''
print(n.length.isEven())                   // "" → 0 → 0 é par → true
```

### Aliases globais de primitivos

Todo primitivo tem alias capitalizado, sem precisar declarar `typealias`:

```typescript
val i: Integer = 42
val s: String = "Andromeda"
val b: Boolean = true
val f: Float = 3.14

print(i.isEven())          // true — Integer resolve para int
print(s.upper())           // "ANDROMEDA"

func escreve(m: String): Void {
  print(m)
}
```

| Alias | Tipo | Alias | Tipo |
|-------|------|-------|------|
| `Integer` | `int` | `Void` | `void` |
| `Float` | `float` | `Null` | `null` |
| `String` | `string` | `Any` | `any` |
| `Boolean` | `bool` | `Unknown` | `unknown` |

São **transparentes** — `Integer` **é** `int`, e `val j: int = i` funciona. Os 8
nomes são reservados: `struct String` ou `typealias Integer` dão
`CANNOT_REDEFINE_BUILTIN`.

### Divisão inteira

`int / int` é divisão **inteira**, truncada em direção a zero:

```typescript
val a: int = 10
val b: int = 3
val c: int = a / b      // 3     (não 3.333)
val d: int = -10 / 3    // -3
val e: int = 10 % 3     // 1
val f: float = 10.0 / 3 // 3.333 - float em qualquer lado devolve float
```

`int` por zero é **erro** — o compilador pega divisor literal, e o runtime
protege o caso de variável:

```typescript
print(10 / 0)         // ERROR: [DIVISION_BY_ZERO] division by zero

val zero: int = 0
print(10 / zero)      // runtime: Error: division by zero
```

`float` por zero **não** é erro: segue IEEE-754 e devolve `Infinity`, `-Infinity`
ou `NaN`, como em Rust e JavaScript.

### Concatenação

`string + primitivo` concatena, e o simétrico também:

```typescript
val age: int = 10
val s: string = "idade: " + age   // "idade: 10"
val t: string = age + " anos"     // "10 anos"
```

### Stringable

**`Stringable` é um protocol nativo** — disponível globalmente sem declarar.

Um struct controla a própria formatação implementando `Stringable`:

```typescript
struct User implements Stringable {
  name: string
  func toString(): string {
    return "User(" + self.name + ")"
  }
}

print(User { name: "Alice" })   // User(Alice)
```

Strings no topo saem sem aspas; strings aninhadas saem com aspas
(`print(["a"])` → `["a"]`). Ciclos viram `[Circular]`.

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
- [x] **Protocols** - Declaration, methods, generics, Self type, struct implements, conformance checking, upcast
- [x] **Protocol Generics** - Generic protocols, nested generics, type param validation
- [x] **Protocol as Type** - Use protocol as variable type, implicit upcast from struct, method resolution on protocol-typed variables
- [x] **Builtins** - `print` variádica com formatação total, `Stringable` para formatação de structs, proteção contra redefinição
- [x] **Métodos de primitivos** - `int.toString/toFloat/isEven/isOdd` com receiver explícito ou inferido
- [x] **Métodos de string** - `length` (propriedade), `upper`, `lower`, `trim`, `contains`, `indexOf`, `substring`, `split`, `replace` (todas), `toInt`/`toFloat` (Optional)
- [x] **Métodos de float e bool** - só conversão: `float.toString/toInt`, `bool.toString`
- [x] **Aliases globais** - `Integer`, `Float`, `String`, `Boolean`, `Void`, `Null`, `Any`, `Unknown` (transparentes e protegidos)
- [x] **extend em struct** - métodos adicionados após a declaração, com detecção de conflito
- [x] **extend em primitivos** - `extend String`, `extend Integer`, etc., via registro `$ext` sem tocar no prototype global
- [x] **Construtor de struct com `new`** - `Nome(...)` e `Nome(campo: valor)` emitem `new`; literal rejeitado em struct com init custom
- [x] **Método do struct chama método do extend** - pré-registro no momento da declaração do struct
- [x] **Campos no extend** - viram propriedade da instância, entram no construtor auto-init e aparecem no `print()`
- [x] **Campo com default em struct com `init` custom** - anexa o fim da lista posicional (`constructor(raw, hash = "auto")`); sem default segue proibido
- [x] **Divisão inteira** - `int / int` trunca em direção a zero, cumprindo o tipo prometido
- [x] **Divisão por zero** - `int` por zero é erro (`DIVISION_BY_ZERO` ou exceção em runtime); `float` segue IEEE-754
- [x] **Concatenação** - `string + primitivo` e o simétrico

## Planned Features (Not Yet Implemented)

- [ ] **Classes** - Object-oriented programming
- [ ] **Androx** - JSX-like syntax native to the language
- [ ] **Import/Export** - Module system
- [ ] **Template Literals** - String interpolation
- [ ] **Async/Await** - Asynchronous programming
- [ ] **Generic type aliases** - `typealias Container<T> = T`
- [ ] **Demais builtins** - `printErr`, `toString`, `len`, `readLine` (ver [API](controlls/api-bultins.md))

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
