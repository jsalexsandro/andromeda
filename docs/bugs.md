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