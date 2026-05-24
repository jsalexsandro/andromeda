# Andromeda Language Quick Reference

Condensed spec for use during test writing. For the full reference, see the
official docs at `docs/` in the project repository.

---

## CLI

```bash
bun src/main.ts run     <file>.med   # run (lex + parse + semantic + execute)
bun src/main.ts compile <file>.med   # lex + parse + semantic only
bun src/main.ts ast     <file>.med   # dump AST
bun src/main.ts tokens  <file>.med   # dump token stream
```

---

## Variables

```
val <name>[: Type] = <expr>    // immutable
var <name>[: Type] = <expr>    // mutable
const <name>[: Type] = <expr>  // immutable (alias for val)
```

---

## Primitive Types

`int` `float` `string` `bool` `null` `void` `any` `unknown`

---

## Composite Types

```
int[]          // array
int[][]        // 2-d array
int?           // nullable  (shorthand for int | null)
int | string   // union
(int) => bool  // function type
Optional<T>    // built-in nullable generic
```

---

## Typealias

```
typealias Name = Type                  // simple alias
typealias Name<T> = ...                // generic alias  (NEW — v1.0.2+)
typealias Name<A, B> = ...             // multi-param generic alias
```

Generic aliases may reference: primitives, arrays, unions, function types,
`Optional<T>`, other aliases, and the alias's own type parameters.

**NOT allowed:**
- Self-reference: `typealias X<T> = X<T>`          → CIRCULAR_TYPE
- Indirect cycles: `typealias A<T> = B<T>` + reverse → CIRCULAR_TYPE
- Wrong arg count at usage site                      → GENERIC_ARG_COUNT
- Duplicate type param in declaration                → ALREADY_DECLARED

---

## Functions

```
func name<T>(param: T): T { return param }    // generic function
func name(a: int, b: int): int { return a+b } // regular function
func name(...args: int[]): int { return 0 }   // rest params
```

---

## Arrow Functions

```
val f: (int) => int = (x) => x + 1
val f = (x: int): int => x + 1
val f = <T>(x: T): T => x             // generic arrow
val f = <A, B>(a: A, b: B): B => b    // multi-param generic arrow
```

---

## Generic Inference Order

1. From argument types
2. From return-type context (bidirectional — annotation on the left drives inference)
3. From explicit `<Type>` args

Fails with `GENERIC_INFERENCE_FAILED` if all three sources are insufficient.

---

## Control Flow

```
if (cond) { } else { }

if val x = optExpr { }         // optional binding — x is non-nullable inside
if val x = a, val y = b { }    // chained binding

while (cond) { break / continue }
for (var i: int = 0; i < n; i = i + 1) { }
```

---

## Optional Binding Rules

- The bound expression **must** be nullable (`T?` or `T | null`)
- Inside the then-branch, the binding is non-nullable `T`
- Annotation `if val x: T = expr` is valid — T must match the unwrapped type
- The bound variable is **not** in scope in the `else` branch

---

## Operators

Arithmetic: `+ - * / %`  
Comparison: `== != < > <= >=`  
Logical: `&& || !`  
Assignment: `= += -= *= /= %=`  
Spread: `...arr` (valid only inside array literals and call args)  
Nullish coalescing: `??`  
Ternary: `cond ? a : b`

for more infors see,  docs/syntax.md in root file of project