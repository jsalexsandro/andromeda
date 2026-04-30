# Bug: Array Index Type Check Not Working

**Data:** 2026-04-30  
**Status:** Documentado (não corrigido)  
**Severidade:** Média

## Descrição

O `checkIndexExpr` em `src/semantic/TypeChecker.ts` (linhas 1072-1087) não está gerando erros quando o índice do array não é do tipo `int`.

## Comportamento Esperado

Ao acessar um array com um índice não-inteiro (ex: `arr[f]` onde `f` é `float`), o compilador deveria gerar um erro `INVALID_INDEX`.

## Comportamento Atual

Nenhum erro é gerado. O código silenciosamente retorna `{ kind: "PrimitiveType", name: "any" }` quando o tipo do objeto não é reconhecido como `ArrayType`.

## Código Problemático

```typescript
// src/semantic/TypeChecker.ts:1072-1087
private checkIndexExpr(expr: Extract<Expr, { kind: "Index" }>): TypeNode {
  const objectType = this.checkExpression(expr.object);
  const indexType = this.checkExpression(expr.index);

  if (objectType.kind === "ArrayType") {
    if (
      indexType.kind === "PrimitiveType" &&
      indexType.name === "int"
    ) {
      return objectType.elementType;
    }
    this.errors.push(Errors.invalidIndex("Índice de array precisa ser int", ...));
  }

  // PROBLEMA: Retorna 'any' sem erro se não for ArrayType
  return { kind: "PrimitiveType", name: "any" };
}
```

## Caso de Teste que Falha

```javascript
// test_for_10_blocks.med - Bloco 8
val arr: int[] = [1, 2, 3, 4, 5]

for (var f = 0.0; f < 5.0; f += 1.0) {
  val elem = arr[f]  // ERRO ESPERADO: índice deve ser int, não float
}
```

## Causa Raiz

A lógica atual só verifica o tipo do índice **dentro** do `if (objectType.kind === "ArrayType")`. Se o tipo do objeto não for detectado como `ArrayType` (por algum problema na inferência de tipos), o erro nunca é gerado.

## Plano de Correção

1. **Verificar se `arr: int[]` está sendo inferido como `ArrayType`:**
   - Checar `checkVariableStmt` e como tipos explícitos são processados
   - Verificar se `val arr: int[] = [...]` está definindo corretamente o tipo

2. **Melhorar `checkIndexExpr`:**
   ```typescript
   private checkIndexExpr(expr: Extract<Expr, { kind: "Index" }>): TypeNode {
     const objectType = this.checkExpression(expr.object);
     const indexType = this.checkExpression(expr.index);

     if (objectType.kind === "ArrayType") {
       // Verificar se o índice é int
       if (!(indexType.kind === "PrimitiveType" && indexType.name === "int")) {
         this.errors.push(Errors.invalidIndex("Índice de array precisa ser int", expr.index));
       }
       return objectType.elementType;
     }

     // Se não é array, gerar erro de tipo não indexável
     this.errors.push(Errors.invalidIndex("Tipo não suporta indexação", expr.object));
     return { kind: "PrimitiveType", name: "any" };
   }
   ```

3. **Adicionar logs de debug** para verificar o que está sendo inferido como `objectType.kind`.

## Arquivos Relacionados

- `src/semantic/TypeChecker.ts` (linhas 1072-1087)
- `src/semantic/TypeChecker.ts` (função `checkVariableStmt` para declaração de arrays)
- `test_for_10_blocks.med` (Bloco 8, linha 236-239)

## Testes Afetados

- `test_for_10_blocks.med` - Bloco 8: Erro esperado `INVALID_INDEX` não aparece
- Total de erros esperados: 14
- Total de erros atuais: 15 (incluindo erro de tipo float na linha 19)
- Diferença: Bloco 8 deveria gerar 1 erro, mas gera 0
