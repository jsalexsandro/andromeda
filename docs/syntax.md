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
12. [Operators](#12-operators)
13. [Spread Operator](#13-spread-operator)
14. [Comments](#14-comments)
15. [Examples](#15-examples)

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
| `val` | Immutable | **Yes** | Value that cannot be reassigned (type annotation mandatory) |
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

### Custom Generics (Planned)

```typescript
// Future syntax (not fully implemented)
// typealias Container<T> = T?
// val a: Container<int> = 42
```

---

## 9. Functions

### Syntax

```typescript
func functionName(param1: Type1, param2: Type2): ReturnType {
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

// Function call
val result: int = add(1, 2)
```

---

## 10. Arrow Functions

### Syntax

```typescript
// Single expression
val name: (ParamType) => ReturnType = (param) => expression

// With type annotation
val double: (int) => int = (x) => x * 2
```

### Examples

```typescript
// Simple arrow function
val triple: (int) => int = (x) => x * 3
val result: int = triple(10)  // 30

// Arrow function as variable
val greet: (string) => string = (name) => "Hello, " + name
```

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
typealias UserData = {
  id: ID,
  name: string
}

// Function
func greet(name: string): string {
  return "Hello, " + name
}

// Variables
val userId: ID = 123
var count: int = 0

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

## Planned Features (Not Yet Implemented)

- [ ] **For loops** - `for (val i: int = 0; i < 10; i++)`
- [ ] **Classes** - Object-oriented programming
- [ ] **Androx** - JSX-like syntax native to the language
- [ ] **Import/Export** - Module system
- [ ] **Template Literals** - String interpolation
- [ ] **Ternary Operator** - `condition ? a : b`
- [ ] **Nullish Coalescing** - `??` operator
- [ ] **Async/Await** - Asynchronous programming
- [ ] **Enums** - Enumerated types
- [ ] **Protocols/Interfaces** - Type contracts
- [ ] **Structs** - Value types

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
**Last Updated:** April 2026
