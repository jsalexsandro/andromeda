# BUG: Sem promoção implícita de `int` para `float`

**Data:** 2026-05-07
**Status:** Confirmado
**Tipo:** Limitação de design (type checker)

## Descrição

O type checker não promove `int` para `float` implicitamente. Quando uma variável
é declarada como `int` e usada em operação com `float`, o resultado da operação
é `float`, mas a atribuição de volta para a variável `int` falha.

## Exemplo

```andromeda
for (var i = 0; i < 10; i = i + 0.5) {
    val x: float = i
}
```

## Erros gerados

1. `TYPE_MISMATCH: Cannot assign 'float' to 'i' (int)` — na linha `i = i + 0.5`
2. `TYPE_MISMATCH: type 'float' is incompatible with initializer 'int'` — na linha `val x: float = i`

## Causa

Em `checkBinaryExpr`, a operação `int + float` é aceita e retorna `float`
(linha 805-807):

```typescript
return leftType.name === "int" && rightType.name === "int"
    ? { kind: "PrimitiveType", name: "int" }
    : { kind: "PrimitiveType", name: "float" };
```

Mas `checkAssignStmt` valida a compatibilidade do tipo retornado com o tipo
da variável. `float` não é compatível com `int`, gerando o erro de atribuição.

## Workaround

Declarar a variável explicitamente como `float`:

```andromeda
for (var i: float = 0; i < 10; i = i + 0.5) {
    val x: float = i
}
```

## Impacto

- Baixo: apenas afeta casos onde `int` e `float` são misturados em assignments
- Não afeta operações aritméticas puras (ex: `1 + 2.0` funciona e retorna `float`)
- Não afeta variáveis declaradas com tipo explícito `float`
