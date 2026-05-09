# Bug Report: Type Inference Issues

**Dates:** April 29, 2026 — May 9, 2026  
**Version:** 1.0.2  
**Status:** Open  

---

## Bug #1: Array Type vs Generic Type Mismatch

### Description
The semantic analyzer does not unify `Array<T>` with `T[]`. They are treated as different types.

### Reproduction
```typescript
val a: Array<int> = [1, 2, 3]  // ERROR: type 'Array<int>' is incompatible with initializer 'int[]'
val b: int[] = [1, 2, 3]        // OK
```

### Expected Behavior
`Array<int>` should be equivalent to `int[]`.

### Actual Behavior
Semantic error: `type 'Array<int>' is incompatible with initializer 'int[]'`

### Notes
Preliminary fix in progress: parser normalizes `T[]` → `GenericType<Array<T>>` with `isBuiltin: true`, but `areTypesCompatible` still has cross-compat fallbacks for `ArrayType ↔ GenericType<Array>` during transition.

---

## Bug #2: Spread Creates Incorrect Union Types

### Description
When using spread operator inside array literals with mixed types (spread arrays + primitive elements), the compiler creates incorrect union types.

### Reproduction
```typescript
val arr1: int[] = [1, 2, 3]
val arr2: int[] = [4, 5, 6]
val combined: int[] = [...arr1, ...arr2, 7, 8]  // ERROR: type 'int[]' is incompatible with initializer '(int[] | int)[]'
```

### Root Cause
The parser is creating `SpreadExpr` nodes, but when the semantic analyzer processes them, it's treating the spread result as `int[]` type, and then combining with `int` literals creates `(int[] | int)[]` instead of correctly flattening to `int[]`.

### Expected Behavior
`[...int[], ...int[], int, int]` should infer as `int[]`, not `(int[] | int)[]`.

---

## Bug #3: Empty Array Inference

### Description
Empty arrays without explicit type annotation are inferred as `unknown[]` instead of a more useful type.

### Reproduction
```typescript
val empty = []              // Inferred as unknown[]
val withSpread: int[] = [...empty, 1, 2]  // ERROR: type 'int[]' is incompatible with initializer 'unknown[]'
```

### Expected Behavior
Empty arrays should either:
- Be inferred from context (preferred)
- Default to `never[]` or similar bottom type

---

## Bug #4: Multi-Dimensional Array Type Mismatch

### Description
Complex array types with unions are not properly validated.

### Reproduction
```typescript
val matrix: int[][] = [[1, 2], [3, 4]]  // OK
val unionArr: (int | string)[] = [1, "a"]  // May have issues
```

---

## Bug #5: `getTypeNodeName` (parser) — Missing Switch Cases for GenericType, TupleType, LiteralType

**File:** `src/parser/parser.ts:2348`
**Severity:** Low (only affects debug output)

### Description
The second overload of `getTypeNodeName` (used in `parseTypeAliasStatement` for debug printing) is missing cases for `GenericType`, `TupleType`, and `LiteralType`. The `default` branch returns `"unknown"`, making all aliased arrays/tuples/literals display as `unknown` in DEBUG output.

The **first** overload (line 2149) handles these correctly — but `parseTypeAliasStatement` calls the wrong one.

### Symptom
```
DEBUG - [typealias] T3 = unknown     ← T3 = T2[], GenericType cai no default
DEBUG - [typealias] Pair = unknown   ← Pair = [string, int], TupleType cai no default
DEBUG - [typealias] ScoreList = unknown  ← ScoreList = Score[] = int[]
```

### Expected
```
DEBUG - [typealias] T3 = int[]
DEBUG - [typealias] Pair = [string, int]
DEBUG - [typealias] ScoreList = int[]
```

### Fix
Add missing cases to the second overload:

```typescript
case "GenericType":
  return `${type.name.value}<${type.args.map(a => this.getTypeNodeName(a)).join(", ")}>`;
case "TupleType":
  return `[${type.elements.map(e => this.getTypeNodeName(e)).join(", ")}]`;
case "LiteralType":
  return String(type.value);
```

---

## Bug #6: `checkBinaryExpr` — `resolveAlias` Not Called Before PrimitiveType Kind Checks **[FIXED]**

**File:** `src/semantic/TypeChecker.ts:929`
**Severity:** High
**Fix Date:** May 9, 2026

### Description
All binary operator checks (`+`, `-`, `*`, `/`, `%`, `<`, `>`, `<=`, `>=`, `==`, `!=`, `&&`, `||`) checked `leftType.kind === "PrimitiveType"` and `rightType.kind === "PrimitiveType"` without first calling `resolveAlias`. When either operand came from a variable annotated with a `typealias` (e.g. `Num = int`), its type was `NamedType`, not `PrimitiveType`, and the operation failed.

### Fix
Added `this.resolveAlias()` wrapping both `leftType` and `rightType` at the top of `checkBinaryExpr`. All operator branches now operate on resolved types.

---

## Bug #7: `checkUnaryExpr` — `resolveAlias` Not Called Before Kind Check **[FIXED]**

**File:** `src/semantic/TypeChecker.ts:1020`
**Severity:** High
**Fix Date:** May 9, 2026

### Description
Same pattern as Bug #6 but for unary operators (`-`, `!`, `++`, `--`). `checkUnaryExpr` called `operandType.kind === "PrimitiveType"` without resolving the alias first.

### Fix
Added `this.resolveAlias()` wrapping the operand type at the top of `checkUnaryExpr` and inside the `++`/`--` branch for `symbol.type`.

---

## Bug #8: `inferLiteralType` — `resolveAlias` Not Called on contextualType for Float Coercion **[FIXED]**

**File:** `src/semantic/TypeChecker.ts:912`
**Severity:** Medium
**Fix Date:** May 9, 2026

### Description
The float contextual coercion in `inferLiteralType` checked `this.contextualType?.kind === "PrimitiveType"` without resolving aliases first. When the contextual type was a `NamedType` alias (e.g. `typealias MeuFloat = float`), the check failed and the literal `42` was typed as `int` instead of `float`. `areTypesCompatible` handled it via int→float widening, but the literal lost precision metadata.

### Fix
Extract `this.resolveAlias(this.contextualType)` into a local variable before the kind check:

---

## Bug #9: `checkReturnStmt` — Token Fake (`{line:0,col:0}`) Instead of `getExprToken` **[FIXED]**

**File:** `src/semantic/TypeChecker.ts:715`
**Severity:** Medium
**Fix Date:** May 9, 2026

### Description
When a return type mismatch error occurred and the return value expression was not an `Identifier`, the error was reported with `{line: 0, column: 0}` instead of the actual source position.

### Fix
Replaced the ternary `stmt.value.kind === "Identifier" ? ... : {line:0,col:0}` with `this.getExprToken(stmt.value) ?? {line:0,col:0}`.

---

## Bug #10: Parser — Explicit `Array<T>` Source Syntax Not Supported

**File:** `src/parser/parser.ts:1825`
**Severity:** Low

### Description
The parser normalizes `T[]` to `GenericType<Array<T>>` internally, but the explicit syntax `Array<int>` in source code doesn't parse — `Array` is consumed as a `NamedType` identifier, and `<int>` is parsed as the less-than comparison operator.

### Reproduction
```typescript
typealias BoxInt = Array<int>  // Parse Error
```

### Expected Behavior
`Array<int>` should be a valid type annotation equivalent to `int[]`, since `GenericTypeNode` with `name: "Array"` is the canonical form.

---

## Priority Matrix

| Bug | Severity | Impact | Status |
|-----|----------|--------|--------|
| #6 — checkBinaryExpr resolveAlias | 🔴 High | All arithmetic/comparison/logic with typealiased variables | ✅ **Fixed** |
| #7 — checkUnaryExpr resolveAlias | 🔴 High | All unary ops with typealiased variables | ✅ **Fixed** |
| #8 — inferLiteralType resolveAlias | 🟡 Medium | Float coercion with typealiased float type | ✅ **Fixed** |
| #9 — checkReturnStmt getExprToken | 🟡 Medium | Error positions for return type mismatches | ✅ **Fixed** |
| #5 — getTypeNodeName missing cases | 🟡 Medium | Debug output only | ✅ **Fixed** |
| #10 — Parser Array<T> syntax | 🟢 Low | Edge case syntax | P3 |
| #1 — Array<T> vs T[] mismatch | 🟡 Medium | Mixed representation during transition | Ongoing |
| #2 — Spread union types | 🟡 Medium | Array spread inference | Backlog |
| #3 — Empty array inference | 🟢 Low | UX improvement | Backlog |
| #4 — Multi-dimensional array validation | 🟢 Low | Edge case | Backlog |

---

## Pattern Analysis

**9 of 10 bugs** follow the same root pattern: **`resolveAlias` not called before checking `.kind` on a type that could be a `NamedType` alias**. This is a systemic gap in the type checker, not an isolated mistake.

### Already Fixed (9 occurrences)
1. `checkCallExpr` — calleeType before kind check
2. `checkIndexExpr` — objectType before kind check
3. `checkAssignToIndex` — objectType before kind check
4. `checkArrayExpr` — ctx before kind check (resolve + nullable unwrap)
5. `checkCallExpr` — expectedType before kind/contextual use
6. `checkArrowFunctionExpr` — unwrapped before kind check (defense)
7. `checkBinaryExpr` — left/right types before primitive checks
8. `checkUnaryExpr` — operandType before primitive check
9. `inferLiteralType` — contextualType before float coercion check

### Still Unfixed (0 occurrences — all resolveAlias gaps closed)

---

## Related Files

| File | Purpose |
|------|---------|
| `src/semantic/TypeChecker.ts` | Main type checker — bugs #1, #2, #3, #4, #6, #7, #8, #9 |
| `src/parser/parser.ts` | Parser — bugs #5, #10 |
| `src/ast.ts` | AST node definitions — GenericTypeNode, ArrayTypeNode |
| `src/semantic/errors.ts` | Error codes and factory |
| `src/semantic/Environment.ts` | Scope management |

---

**Last Updated:** May 9, 2026 (Bugs #6, #7, #8, #9 fixed)
