# Bug Report: Type Inference Issues

**Dates:** April 29, 2026 — May 12, 2026  
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

## Bug #10: Parser — Explicit `Array<T>` Source Syntax in typealias RHS Not Supported

**File:** `src/lexer/lexer.ts` (ANDROX_TAG mode)
**Severity:** Low

### Description
`Array<T>` and `Optional<T>` **funcionam** em contexto de anotação de tipo (antes de `=`), mas **falham** em typealias RHS (após `=`) porque o lexer ativa ANDROX_TAG ao encontrar `<` após `=`.

### Funciona ✅
```typescript
var x: Array<int> = [1, 2, 3]
var y: Optional<int> = 10
func f(arr: Array<int>): int { return arr[0] }
var z: Optional<Array<int>> = null
typealias X = int[]   // açúcar funciona
```

### Falha ❌
```typescript
typealias X = Array<int>     // Parse Error: ANDROX_TAG
typealias Y = Optional<int>  // Parse Error: ANDROX_TAG
```

### Root Cause
O lexer (linha ~40, ~648–838) entra em modo ANDROX_TAG quando encontra `<` após `=`. O `<` é consumido como abertura de tag XML, e o identificador seguinte (`int`) é tratado como nome de tag.

### Fix
Desativar ANDROX_TAG em contextos de tipo ou refatorar o lexer para ser sensível a contexto. Alternativa: mudar a sintaxe de genéricos (ex: `Array[int]` em vez de `Array<int>`).

---

---

## Bug #11: Type Parameter Scope Collision — Generic Arrow Inside Generic Call

**File:** `src/semantic/TypeChecker.ts` — `checkArrowFunctionExpr` / `checkCallExpr`
**Severity:** 🟡 Medium
**Status:** Open — Backlog

### Description

Quando uma arrow function genérica é passada como argumento para uma função genérica, os type parameters da arrow têm escopo independente dos type parameters da função envelope. Eles não são unificados.

### Reproduction

```typescript
func swap<A, B>(pair: (A, B) => B, a: A, b: B): B { return pair(a, b) }
swap(<A, B>(a: A, b: B): B => b, 1, "hello")
// ❌ TYPE_MISMATCH: argument 2: expected 'A', got 'int'
```

### Funciona ✅ (caso simples já tratado)

```typescript
func apply<T>(x: T, fn: (T) => T): T { return fn(x) }
apply(10, <T>(x: T): T => x)  // ✅ T da arrow inferido como int via mapeamento posicional
```

### Root Cause

`tryInferTypeArgs` → `unify` processa params em ordem. Quando unifica `(A, B) => B` da arrow contra o parâmetro `pair: (A, B) => B`:

1. `unify(A_swap, A_arrow)` → `mapping["A"] = A_arrow` (NamedType)
2. `unify(B_swap, B_arrow)` → `mapping["B"] = B_arrow` (NamedType)
3. `unify(A_swap, int)` (do arg `1`) → mapping["A"] já existe, **first-binding-wins** → `int` descartado!

**Problema**: o "first-binding-wins" impedia que tipos concretos (`int`, `string`) sobrescrevessem mappings NamedType criados pela unificação de FunctionType.

### Solução Implementada

Em `tryInferTypeArgs` → `unify`, quando o binding existente é `NamedType` (type param de outro escopo), permitir que um tipo mais concreto o substitua:

```typescript
if (existing.kind === "NamedType") {
  mapping.set(name, argType); // sobrescreve com tipo concreto
}
```

Isso preserva:
- **swap case**: `A_arrow` → substituído por `int` do arg `1` ✅
- **shadowing (outer<T>/inner<T>)**: `T_outer` → mantido (não chega tipo mais concreto) ✅  
- **apply case**: `T = int` (concreto) → FunctionType matching não sobrescreve (existing não é NamedType) ✅

---

## Bug #12: `normalizeType` — UnionType with `null` Not Treated as Optional **[FIXED]**

**File:** `src/semantic/TypeChecker.ts:58` — `normalizeType()`  
**Severity:** 🔴 High  
**Status:** ✅ **Fixed** — May 12, 2026  

### Description

`normalizeType` only recognizes `Optional<T>` (GenericType with name `"Optional"`) as an optional type. When a generic type alias resolves to `T | null` (UnionType), `if val` binding detection fails.

### Reproduction

```typescript
typealias Optional<T> = T | null

func unwrap<T>(x: Optional<T>): Optional<T> {
  if val value = x {    // ❌ INVALID_BINDING_TYPE
    return value
  }
  return null
}
```

### Root Cause

The `if val` check in `_checkIfVariableBinding` (line 1132):

```
resolveAlias(initType) → expande Optional<T> → T | null  (UnionType)
normalizeType(...)     → UnionType: só normaliza membros, NÃO detecta null
normalized.kind === "NullableType"? → FALSE
→ INVALID_BINDING_TYPE 💥
```

`normalizeType` handles `UnionType` at line 75–79 but only recurses into its members — it never checks if one member is `null` to convert to `NullableType`.

### Contrast: `Nullable<T> = T?` works

| Alias | resolve p/ | normalizeType | Resultado |
|-------|-----------|---------------|-----------|
| `Nullable<T> = T?` | `Optional<T>` (GenericType) | `isOptional()` → true | `NullableType(T)` ✅ |
| `Optional<T> = T \| null` | `T \| null` (UnionType) | `isOptional()` → false | UnionType ❌ |

### Fix

In `normalizeType`, detect UnionType containing `null`:

```typescript
if (type.kind === "UnionType") {
  const nullMember = type.types.find(
    t => t.kind === "PrimitiveType" && t.name === "null"
  );
  if (nullMember && type.types.length === 2) {
    const other = type.types.find(t => t !== nullMember)!;
    return { kind: "NullableType", type: this.normalizeType(other) };
  }
  // ...existing union normalization
}
```

---

## Bug #13: `checkSpreadExpr` — `resolveAlias` Not Called Before Array Check

**File:** `src/semantic/TypeChecker.ts:2384` — `checkSpreadExpr()`  
**Severity:** 🟡 Medium  
**Status:** Open  

### Description

When spreading a variable whose type is a generic type alias for an array, the spread check fails because `resolveAlias` is not called before checking if the type is an array.

### Reproduction

```typescript
typealias ArrayBox<T> = T[]

func clone<T>(arr: ArrayBox<T>): ArrayBox<T> {
  return [...arr]    // ❌ INVALID_SPREAD: cannot spread non-array/non-object type
}
```

### Root Cause

`checkSpreadExpr` at line 2387:

```typescript
if (!this.isArray(argType) && argType.kind !== "ArrayType" && argType.kind !== "Object") {
  this.errors.push(Errors.invalidSpread(token));
}
```

`argType` is `ArrayBox<T>` (GenericType). `isArray()` checks `type.name.value === "Array"` — `"ArrayBox" !== "Array"` → false. `argType.kind` is `"GenericType"`, not `"ArrayType"` → false. **INVALID_SPREAD**.

### Fix

Call `resolveAlias` before the array kind checks:

```typescript
private checkSpreadExpr(expr: Extract<Expr, { kind: "Spread" }>): TypeNode {
  const argType = this.resolveAlias(this.checkExpression(expr.argument));
  // agora argType pode ser T[], não ArrayBox<T>
  if (!this.isArray(argType) && argType.kind !== "ArrayType" && argType.kind !== "Object") {
    this.errors.push(Errors.invalidSpread(token));
  }
  return argType;
}
```

---

## Bug #14: Generic Arrow Function — Nullable Parameter Types Not Preserved in Body

**File:** `src/semantic/TypeChecker.ts` / `src/parser/parser.ts`  
**Severity:** 🔴 High  
**Status:** Open — requires investigation  

### Description

In generic arrow functions, parameter types annotated with `T?` lose their `Optional<T>` wrapper inside the function body. As a result, `if val` binding fails because the variable is not recognized as optional.

### Reproduction

```typescript
val final = <T>(
  value: T?,
  transform: ((T) => T)?,
  fallback: (() => T)?
): MaybeBox<T> => {
  if val v = value {        // ❌ INVALID_BINDING_TYPE
    if val fn = transform {  // ❌ INVALID_BINDING_TYPE
      return fn(v)           // ❌ INVALID_CALL: non-function
    }
  }
  if val fb = fallback {    // ❌ INVALID_BINDING_TYPE
    return fb()             // ❌ INVALID_CALL: non-function
  }
  return null
}
```

### Root Cause (hypothesis)

When the arrow function environment is created, parameter types are registered. For `value: T?`:
- The parser should produce `Optional<T>` (GenericType) from `T?`
- But the type stored in the symbol table may be `NamedType("T")` instead of `GenericType("Optional", [NamedType("T")])`

This could happen if:
1. `parseArrowFunction` handles `T?` differently from `parseFunctionDeclarator`
2. The type annotation is lost during environment creation in `checkArrowFunctionExpr`
3. The nullable normalization (`T?` → `Optional<T>`) doesn't apply in arrow parameter context

### Verification Needed

Compare the stored parameter type for `func normal<T>(x: T?)` vs `val arrow = <T>(x: T?) => ...` by inspecting the symbol table entry for `x` inside each function body.

---

## Priority Matrix

| Bug | Severity | Impact | Status |
|-----|----------|--------|--------|
| #6 — checkBinaryExpr resolveAlias | 🔴 High | All arithmetic/comparison/logic with typealiased variables | ✅ **Fixed** |
| #7 — checkUnaryExpr resolveAlias | 🔴 High | All unary ops with typealiased variables | ✅ **Fixed** |
| #8 — inferLiteralType resolveAlias | 🟡 Medium | Float coercion with typealiased float type | ✅ **Fixed** |
| #9 — checkReturnStmt getExprToken | 🟡 Medium | Error positions for return type mismatches | ✅ **Fixed** |
| #5 — getTypeNodeName missing cases | 🟡 Medium | Debug output only | ✅ **Fixed** |
| #10 — Array<T>/Optional<T> syntax in typealias RHS | 🟢 Low | typealias edge case with ANDROX_TAG | P3 |
| #1 — Array<T> vs T[] mismatch | 🟡 Medium | Mixed representation during transition | ✅ **Fixed** (normalizeType) |
| #2 — Spread union types | 🟡 Medium | Array spread inference | Backlog |
| #3 — Empty array inference | 🟢 Low | UX improvement | Backlog |
| #4 — Multi-dimensional array validation | 🟢 Low | Edge case | Backlog |
| #11 — Type param scope collision (arrow in generic call) | 🟡 Medium | Generic arrow as argument with multi type params | ✅ **Fixed** |
| #12 — normalizeType Union null detection | 🔴 High | if val with T \| null aliases | ✅ **Fixed** |
| #13 — checkSpreadExpr resolveAlias | 🟡 Medium | Spread with typealiased arrays | **Open** |
| #14 — Arrow generic nullable params | 🔴 High | if val in generic arrows with T? | **Open** |

---

## Pattern Analysis

**11 of 14 bugs** follow the same root pattern: **`resolveAlias` not called before checking `.kind` on a type that could be a `NamedType` or `GenericType` alias**. This is a systemic gap in the type checker, not an isolated mistake.

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

### Still Unfixed (2 occurrences)
1. **Bug #13** — `checkSpreadExpr`: needs `resolveAlias` before isArray/kind check
2. **Bug #14** — Arrow generic nullable params (different pattern — environment registration issue)

---

## Related Files

| File | Purpose |
|------|---------|
| `src/semantic/TypeChecker.ts` | Main type checker — bugs #1, #2, #3, #4, #6, #7, #8, #9 |
| `src/parser/parser.ts` | Parser — bugs #5, #10 (partial: parseNamedTypeWithGenerics) |
| `src/lexer/lexer.ts` | Lexer ANDROX_TAG mode — bug #10 (root cause) |
| `src/ast.ts` | AST node definitions — GenericTypeNode, ArrayTypeNode, NullableTypeNode |
| `src/semantic/errors.ts` | Error codes and factory |
| `src/semantic/Environment.ts` | Scope management |
| `tests/test_generic_explicit.med` | Test suite for explicit generic syntax |

---

**Last Updated:** May 10, 2026 (Bug #10 updated with ANDROX_TAG findings; Bug #1 marked Fixed via normalizeType in TypeChecker)
