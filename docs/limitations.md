# Limitações Identificadas

## Corrigidos ✅

### 1. Type Annotation com null (JA CORRIGIDO)
```med
var n: null = null  // null não é tipo válido
```
**Status:** ✅ CORRIGIDO - Agora suportado

### 2. Block Expression como initializer (JA CORRIGIDO)
```med
var blockResult = { var a = 1; a + b }
```
**Status:** ✅ CORRIGIDO - Block permitido como expression initializer

### 3. String Concatenation (JA CORRIGIDO)
```med
var full = greeting + " " + name
```
**Status:** ✅ CORRIGIDO - Operador + com strings implementado

### 4. Precedência de Nullable vs Array (JA CORRIGIDO)
```med
val a1: int?[]        // array de nullable int (esperado)
val a2: int[]?        // nullable de array int (ok)
val a3: User?[]       // array de nullable User (esperado)
val a4: string[][]?   // nullable de array de arrays (ok)
val a5: int?[][]      // array de arrays de nullable int (esperado)
```
**Status:** ✅ CORRIGIDO

**Correção aplicada:** Modificada a ordem de parsing em `parseAnnotation` e `parseAnnotationType`:
- `?` agora é verificado antes de `[]`
- Verifica `?` duas vezes (antes e depois de `[]`) para suportar `int?[]?`

### 5. Nullable com Generics (JA CORRIGIDO)
```med
val x2: Map<string?, int[]?>?
val g1: Map<string?, int>
val g2: Map<string?, int[]>
val g3: Map<string, int?>
val g4: List<int?>?
```
**Status:** ✅ CORRIGIDO

---

## Pendentes ❌

### 6. Optional Parameters em Funções (BUG)

### 6. Optional Parameters em Funções (BUG)
```med
func test(x?: int): void {}
func test2(x: int?): void {}
```
**Status:** BUG - Não suporta optional/nullable params

| Código | Status |
|--------|--------|
| `func foo(x?: int)` | ❌ Falha no parser |
| `func foo(x: int?)` | ❌ Falha no parser |
| `func foo(x: int)` | ❌ Falha no parser (mesmo com tipo!) |

**Problema:** O parser de função (`parseFunctionStatement`) não processa type annotations em parâmetros. Ele só guarda o nome, não o tipo.

```typescript
// Código atual (linha ~846)
const params: { name: Token; isRest?: boolean }[] = []
// Deveria ser:
const params: { name: Token; type?: TypeNode; isRest?: boolean; isOptional?: boolean }[] = []
```

### 7. Optional Parameters em Protocol (BUG)
```med
protocol Proto {
  func foo(x?: int): void
  func bar(x: int?): void
}
```
**Status:** BUG - Mesmo problema da função, não suporta type annotations nos parâmetros do protocol.

**Problema:** `parseProtocolMethod` usa lógica similar e também não suporta tipos.