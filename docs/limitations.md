# Limitações Identificadas

## Para Corrigir Futuramente

### 1. Type Annotation com null
```med
var n: null = null  // null não é tipo válido
```
**Status:** Parser rejeita - `null` não é reconhecido como type annotation

### 2. Block Expression como initializer
```med
var blockResult = { var a = 1; a + b }
```
**Status:** Parser rejeita - Block não é permitido como expression initializer

### 3. String Concatenation
```med
var full = greeting + " " + name
```
**Status:** Semantic erro - operador + com strings não implementado

### 4. Precedência de Nullable vs Array (BUG)
```med
val a1: int?[]        // array de nullable int (esperado)
val a2: int[]?        // nullable de array int (ok)
val a3: User?[]       // array de nullable User (esperado)
val a4: string[][]?   // nullable de array de arrays (ok)
val a5: int?[][]      // array de arrays de nullable int (esperado)
```
**Status:** BUG - A precedência está invertida

| Código | Esperado | Obtido |
|--------|--------|-------|
| `int?[]` | Array de Nullable | Nullable de Array ❌ |
| `int[]?` | Nullable de Array | OK |
| `User?[]` | Array de Nullable | Nullable de Array ❌ |
| `int?[][]` | Array de Array de Nullable | Nullable de Array ❌ |

** Problema:** O parser está aplicando `?` antes de `[]`, invertendo a semântica.
- `T?[]` deveria ser `(NullableType T)[]`
- Atualmente está sendo parseado como `NullableType(T[])`

### 5. Nullable com Generics (BUG)
```med
val x2: Map<string?, int[]?>?
```
**Status:** BUG - Generics com nullable dentro

| Código | Status |
|--------|--------|
| `Map<string?, int>` | ❌ Falha no parser |
| `Map<string?, int[]>` | ❌ Falha no parser |
| `Map<string, int?>` | ✅ OK |
| `List<int>?` | ✅ OK |

**Problema:** O parser não suporta `?` como type argument dentro de generics (`<T?>`).