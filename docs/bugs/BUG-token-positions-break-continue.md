# Bug: Token Positions Showing Line 0, Col 0

**Data:** 2026-04-30  
**Status:** Documentado (não corrigido)  
**Severidade:** Baixa (cosmético, mas atrapalha debug)

## Descrição

Erros de `break`, `continue`, `return` e `invalidCondition` estão mostrando posição `Line 0, Col 0` em vez das posições reais no código-fonte.

## Comportamento Esperado

Os erros deveriam mostrar a linha e coluna exatas onde o token `break`, `continue`, `return` ou a condição inválida aparecem.

## Comportamento Atual

```
[INVALID_BREAK] Line 0, Col 0: 'break' can only be used inside a loop
[INVALID_CONTINUE] Line 0, Col 0: 'continue' can only be used inside a loop
[INVALID_RETURN] Line 0, Col 0: 'return' can only be used inside a function
[INVALID_CONDITION] Line 0, Col 0: condition must be boolean
```

## Código Problemático

### 1. BreakStmt/ContinueStmt não têm token no AST

```typescript
// src/ast.ts:170-175
export interface BreakStmt {
  kind: "BreakStmt";
  // FALTA: token?: Token
}

export interface ContinueStmt {
  kind: "ContinueStmt";
  // FALTA: token?: Token
}
```

### 2. Uso de token dummy em TypeChecker.ts

```typescript
// src/semantic/TypeChecker.ts:609-619
private checkBreakStmt(_stmt: Extract<Stmt, { kind: "BreakStmt" }>): void {
  if (this.loopDepth === 0) {
    // PROBLEMA: Token hardcoded
    this.errors.push(Errors.invalidBreak({ line: 0, column: 0, type: 0, value: "break" } as Token));
  }
}

private checkContinueStmt(_stmt: Extract<Stmt, { kind: "ContinueStmt" }>): void {
  if (this.loopDepth === 0) {
    // PROBLEMA: Token hardcoded
    this.errors.push(Errors.invalidContinue({ line: 0, column: 0, type: 0, value: "continue" } as Token));
  }
}
```

### 3. invalidCondition também usa posição incorreta

```typescript
// src/semantic/TypeChecker.ts:579-588
if (stmt.condition) {
  const conditionType = this.checkExpression(stmt.condition);
  
  if (conditionType.kind !== "PrimitiveType" || conditionType.name !== "bool") {
    if (stmt.condition.kind !== "Literal" || (stmt.condition as any).value !== true) {
      // PROBLEMA: stmt.condition pode não ter posição correta
      this.errors.push(Errors.invalidCondition(stmt.condition));
    }
  }
}
```

## Plano de Correção

### Passo 1: Adicionar campo token no AST

```typescript
// src/ast.ts
export interface BreakStmt {
  kind: "BreakStmt";
  token?: Token;  // Adicionar
}

export interface ContinueStmt {
  kind: "ContinueStmt";
  token?: Token;  // Adicionar
}
```

### Passo 2: Atualizar o Parser para capturar tokens

No `src/parser/parser.ts`, ao fazer parse de `break` e `continue`, capturar o token:

```typescript
// Exemplo (precisa verificar implementação atual do parser)
parseBreakStmt(): BreakStmt {
  const token = this.previous();  // ou this.advance()
  return {
    kind: "BreakStmt",
    token: token
  };
}
```

### Passo 3: Usar tokens reais em TypeChecker

```typescript
private checkBreakStmt(stmt: Extract<Stmt, { kind: "BreakStmt" }>): void {
  if (this.loopDepth === 0) {
    const token = stmt.token || { line: 0, column: 0, type: 0, value: "break" };
    this.errors.push(Errors.invalidBreak(token));
  }
}
```

### Passo 4: Corrigir invalidCondition

Verificar como extrair a posição da condição. Pode precisar adicionar `token` ou `line`/`column` nas expressões.

## Arquivos Relacionados

- `src/ast.ts` (linhas 170-175)
- `src/parser/parser.ts` (funções `parseBreakStmt`, `parseContinueStmt`)
- `src/semantic/TypeChecker.ts` (linhas 609-619, 579-588)
- `src/semantic/errors.ts` (funções `invalidBreak`, `invalidContinue`, `invalidCondition`)

## Casos de Teste Afetados

- `test_for_10_blocks.med` - Bloco 6: `break` e `continue` fora de loop
- `test_for_10_blocks.med` - Bloco 9: `return` fora de função
- `test_for_10_blocks.med` - Bloco 2: condições não-bool
