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