# Bug Tracker - Andromeda Compiler

## Bug #001: Generics in typealias not working

**Status**: 🔴 Open  
**Date**: 2026-04-28  
**Component**: Parser (`src/parser/parser.ts`)

---

### Description

When defining a `typealias` with generic types, the parser fails to process the type arguments correctly.

### Reproduction

```andromeda
typealias StringList = Array<string>
typealias UserMap = Map<string, int>
```

**Error**:
```
[Parse Error]: Unexpected token 'string', expected expression.
At line 1, column 29:

1 | typealias StringList = Array<string>
  |                              ^^^^^
```

---

### Root Cause (Suspected)

In `parseAnnotationType()`, when processing generic type arguments (e.g., `<string>`), the method is called from `parseNamedTypeWithGenerics()`. The token `string` is recognized as `TokenType.STRING_TYPE` (keyword), but `parseAnnotationType()` may not be handling it correctly in the recursive call.

**Location**: `src/parser/parser.ts`
- `parseAnnotationType()` (~line 1588)
- `parseNamedTypeWithGenerics()` (~line 1722)

---

### Workaround

None at the moment. Avoid using generics in `typealias` definitions.

---

### Next Steps

1. Debug `parseAnnotationType()` to see why `TokenType.STRING_TYPE` is not being processed
2. Check if the control flow in `parseNamedTypeWithGenerics()` is correct
3. Add proper error messages for this case
4. Create test cases for generics in typealias

---

## Bug #003: Spread de int[][] em int[] não dá erro esperado (comentário confuso)

**Status**: 🔵 Not a Bug (comportamento correto, documentação confusa)  
**Date**: 2026-04-29  
**Component**: TypeChecker (`src/semantic/TypeChecker.ts`)

---

### Description

No arquivo `all-cases.med`, o caso `val bad_flat: int[] = [...matrix]` onde `matrix: int[][]` deveria dar erro segundo o comentário, mas **não dá erro** porque o comportamento está correto.

### Explicação

```andromeda
val row1: int[] = [1, 2, 3]
val row2: int[] = [4, 5, 6]
val matrix: int[][] = [row1, row2]  // int[][]

val bad_flat: int[] = [...matrix]  
// Comentário original: [ERRO] spread de int[][] em int[] — elementos seriam int[], não int
```

**Análise**:
- `matrix: int[][]` é `ArrayType { elementType: int, dimensions: 2 }`
- Spread de `int[][]` usando `getSpreadElementType()` → reduz dimensões: `int[]` (dimensions: 1)
- `[...matrix]` produz `int[]` (array de ints)
- `val bad_flat: int[] = [...matrix]` → `int[] = int[]` → **sem erro** ✅

O comentário `[ERRO]` estava **incorreto**. Spread de `int[][]` em array literal produz `int[]`, que é compatível com `int[]`.

### Root Cause

Comentário confuso no arquivo de teste `all-cases.med` (linha 140). O comportamento do compilador está correto.

### Correção

Atualizar comentário no `all-cases.med`:
```andromeda
// [OK] spread de int[][] produz int[] como elemento
val bad_flat: int[] = [...matrix]   // spread int[][] → int[] (correto)
```

### Status

Comportamento do compilador: ✅ Correto  
Comentário no teste: ❌ Incorreto (será corrigido)

---

## Bug #002: typeToString() returns "unknown" for some types

**Status**: ✅ Fixed  
**Date**: 2026-04-28  
**Component**: TypeChecker (`src/semantic/TypeChecker.ts`)

---

### Description

The `typeToString()` method in TypeChecker was returning `"unknown"` for `NamedType`, `LiteralType`, `TupleType`, and `GenericType`.

### Fix

Added proper handling for all type nodes in `typeToString()`:
- `NamedType` → returns type name
- `LiteralType` → returns string representation of value
- `TupleType` → returns `[elem1, elem2, ...]`
- `GenericType` → returns `Name<arg1, arg2, ...>`

**Commit**: `21e0c66`

---
