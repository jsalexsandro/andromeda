# Bug Report: Type Inference Issues

**Date:** April 29, 2026  
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

## Test Cases to Investigate

### Case 1: Basic spread
```typescript
val a: int[] = [1, 2]
val b: int[] = [...a, 3]  // Should be int[]
```

### Case 2: Multiple spreads
```typescript
val a: int[] = [1]
val b: int[] = [2]
val c: int[] = [...a, ...b]  // Should be int[]
```

### Case 3: Spread with elements
```typescript
val a: int[] = [1, 2]
val b: int[] = [...a, 3, 4]  // Should be int[]
```

### Case 4: Nested spread
```typescript
val a: int[] = [1]
val b: int[] = [...a, 2]
val c: int[] = [...b, 3]  // Should be int[]
```

---

## Priority
- **High:** Bug #2 (spread creates incorrect union) - affects common use case
- **Medium:** Bug #1 (Array<T> vs T[]) - affects generic usage
- **Low:** Bug #3 (empty array inference) - can be worked around with type annotation

---

## Related Files
- `src/semantic/TypeChecker.ts` - Type checking logic
- `src/parser/parser.ts` - Spread expression parsing
- `src/ast.ts` - SpreadExpr definition

---

**Last Updated:** April 29, 2026
