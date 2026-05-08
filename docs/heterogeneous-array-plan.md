# Heterogeneous Array & Tuple Implementation Plan

## Rules

```andromeda
var s = ['James', 1]              → ERRO: array heterogêneo sem anotação
var s: (string | int)[] = [...]   → OK: union explícita
var tup: [string, int] = ['J', 1] → OK: tupla, posições tipadas
var y: string[] | int[] = [1]     → OK: array inteiro é string[] OU int[]
```

## Changes

### 1. `errors.ts` — New error codes
- `HETEROGENEOUS_ARRAY`
- `TUPLE_SIZE_MISMATCH`
- `TUPLE_IMMUTABLE`
- `SPREAD_IN_TUPLE`

### 2. `checkArrayExpr` — Refactor
- Empty array: `unknown[]` (no ctx); `T[]` (array ctx); `TUPLE_SIZE_MISMATCH` (tuple ctx)
- Tuple context → `checkArrayAsTuple`
- No context + mixed types → `HETEROGENEOUS_ARRAY` error
- Keep union creation only when contextual type allows it

### 3. `checkArrayAsTuple` — New method
- Reject spread elements
- Validate element count
- Validate each position's type
- Return tupleType on success

### 4. `areTypesCompatible` — Add Tuple rules
- `TupleType` vs `TupleType`: element-wise structural
- `TupleType` vs `ArrayType`: incompatible both ways

### 5. `checkIndexExpr` — Stricter tuple indexing
- Only literal int indexes for tuples
- Dynamic index → error "must be a literal integer"
- Out of bounds → error

### 6. `checkAssignToIndex` — Block tuple mutation
- Tuple element assignment → `TUPLE_IMMUTABLE` error

### 7. `checkAssignStmt` / `checkAssignExpr` — Tuple re-assignment
- `t = [2, "b"]` still works (variable reassignment, not element mutation)
- Uses `areTypesCompatible` with new TupleType rules

### 8. Token positions
- Use `getExprToken` for all error tokens (real line/col)
- Never use `{line:0,col:0}` fake tokens
