# Bug #14: Generic Arrow Function — Nullable Parameter Types Not Preserved

**Data:** 2026-05-12  
**Status:** Open — needs investigation  
**Severidade:** 🔴 Alta  

## Descrição

Em arrow functions genéricas, parâmetros com tipo `T?` perdem o wrapper `Optional<T>` dentro do corpo da função. `if val` não reconhece a variável como optional.

## Reprodução

```typescript
val final = <T>(
  value: T?,
  transform: ((T) => T)?,
  fallback: (() => T)?
): MaybeBox<T> => {
  if val v = value {        // ❌ INVALID_BINDING_TYPE
    if val fn = transform {  // ❌ INVALID_BINDING_TYPE
      return fn(v)           // ❌ INVALID_CALL
    }
  }
  if val fb = fallback {    // ❌ INVALID_BINDING_TYPE
    return fb()             // ❌ INVALID_CALL
  }
  return null
}
```

## Funciona ✅ (função normal)

```typescript
func normal<T>(x: T?): T? {
  if val v = x {    // ✅ OK
    return v
  }
  return null
}
```

## Hipótese

O tipo do parâmetro `value` dentro do corpo da arrow function não é `Optional<T>`. Pode ser:
- `NamedType("T")` — o `?` foi ignorado
- `T?` cru — a anotação não foi normalizada para `Optional<T>`

## Investigação Necessária

1. Comparar o tipo armazenado no symbol table para `x` em:
   - `func normal<T>(x: T?)` → deve ser `Optional<T>` (GenericType)
   - `val arrow = <T>(x: T?) => ...` → qual tipo está armazenado?

2. Verificar `checkArrowFunctionExpr` em `src/semantic/TypeChecker.ts`:
   - Como os parâmetros são registrados no ambiente?
   - O `parseTypeAnnotation()` é chamado para cada parâmetro?
   - O resultado é normalizado antes de armazenar?

3. Verificar `parseArrowFunction` em `src/parser/parser.ts`:
   - Como `T?` em parâmetro de arrow function é parseado?
   - Difere de `parseFunctionDeclarator`?

## Arquivos Relevantes

| Arquivo | Função |
|---------|--------|
| `src/semantic/TypeChecker.ts` | `checkArrowFunctionExpr` — registra params no ambiente |
| `src/parser/parser.ts` | `parseArrowFunction` / `parseArrowFunctionRest` — parseia params |
| `src/lexer/lexer.ts` | `readIdentifier()` — tratamento de `?` como `QUESTION` |
