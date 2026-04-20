# Bug: Rest Parameters em Funções

## Descrição
O parser não suporta rest parameters com tipo em funções.

## Código que falha
```andromeda
func sum(...nums: int[]): int { return 0 }
func greet(...names: string[]) {}
```

## Erro
```
[Parse Error]: Expected parameter name
[Parse Error]: Expected ')' after parameters
[Parse Error]: Expected '{' before function body
```

## Status
- [ ] Não implementado
- [ ] Teste necessário

## Análise
O parser de função (`parseFunctionStatement`) precisa ser atualizado para reconhecer:
1. Token `SPREAD` (`...`) antes do nome do parâmetro
2. Tipo opcional após o nome: `...nome: tipo`
3. O parâmetro rest deve ser o último

## Referências
- Arquivo: `src/parser/parser.ts`
- Método: `parseFunctionStatement`
- Linha aproximada: ~847

## Relacionado
- Spread em arrays: ✅ Funciona (`[...arr, 1, 2]`)
- Spread em objetos: ✅ Funciona (`{...obj1, ...obj2}`)
- Tuple rest: ✅ Funciona (`[...rest: string[]]`)
- Spread em chamadas: ✅ Funciona (`f(...args)`)

---

# Bug: keyof T aninhado após readonly array type

## Descrição
O parser falha ao processar `keyof T` quando aninhado após um array type com `readonly`.

## Código que falha

```andromeda
type Foo = readonly { name: string }[]
type Keys = keyof Foo
```

## Erro
```
[Parse Error]: Expected type
[Parse Error]: Expected ';' after type annotation
```

## Status
- [x] Analisado
- [ ] Corrigido

## Análise

O problema está no lexer, não no parser:

1. O método `readAndroxChildrenMode()` não verifica se o caractere atual é um identificador válido antes de chamar `readIdentifier()`
2. Quando o lexer encontra `keyof` após `readonly { ... }[]`, ele treats tudo como texto (modo ANDROX_CHILDREN)
3. O lexer precisa verificar `isLetter()` antes de chamar `readIdentifier()` no modo ANDROX_CHILDREN

### Tentativa de correção (revertida)

A correção envolvia:
1. Adicionar verificação `isLetter()` antes de `readIdentifier()` em `readAndroxChildrenMode()`
2. Lidar com `expectingGenericParams` — indica que parâmetros Generic esperados
3. O problema: generic params como `T` são identificados corretamente, mas quando há `readonly { ... }[]` antes, o modo muda para ANDROX_CHILDREN e o lexer não lê identificadores

### Por que foi revertida
A correção tornou-se muito complexa karena:
1. Interação problemática com `expectingGenericParams` 
2. Múltiplos modos do lexer que precisam ser sincronizados
3. Risco de quebrar outras funcionalidades

## Referências
- Arquivo: `src/lexer/lexer.ts`
- Método: `readAndroxChildrenMode()`
- Linha aproximada: ~400-500

## Relacionado
- `keyof T` simples: ✅ Funciona
- `readonly { ... }` sem keyof: ✅ Funciona
- `{ [key: string]: T }` com generic: ❌ Não implementado (Fase 4/5)

---

# Feature: Mapped Types com Spread em Object Types

## Descrição
Implementar spread em object types (anotações de tipo) para criar mapped types.

## Diferença com Object Literal Spread

```andromeda
// Object LITERAL (expressão) - já funciona ✅
val merged = { ...obj1, ...obj2 }

// Object TYPE (tipo) - NÃO funciona ❌
val x: { ...TypeA, newProp: int }
```

## Sintaxe TypeScript equivalente

```typescript
// Adicionar propriedades
type Extended<T> = { ...T, newProp: string }

// Mapped type básico
type Readonly<T> = {
  readonly [K in keyof T]: T[K]
}

// Remover propriedades
type Without<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never: P]: T[P]
}
```

## Status
- [ ] Não implementado
- [ ] Design necessário

## Referências
- Arquivo potencial: `src/parser/parser.ts`
- Método: `parseObjectLiteralType`

## Exemplos desejados
```andromeda
type WithId<T> = { ...T, id: int }
type Readonly<T> = { readonly ...T }
type Optional<T> = { ...T, [K in keyof T]?: T[K] }
```