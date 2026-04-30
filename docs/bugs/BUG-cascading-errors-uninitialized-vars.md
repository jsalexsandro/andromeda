# Bug: Cascading Errors for Uninitialized Variables

**Data:** 2026-04-30  
**Status:** Documentado (não corrigido)  
**Severidade:** Baixa (cosmético, mas afeta UX)

## Descrição

Quando uma variável `var` ou `const` é declarada sem inicializador, o erro `UNINITIALIZED_VAR` é gerado corretamente. Porém, como a variável **não é registrada no ambiente**, todos os usos subsequentes geram erros em cascata (`UNDEFINED_VARIABLE` + `TYPE_MISMATCH`).

## Comportamento Atual

```javascript
// test_declaration_without_init.med
var a
val x = a + 1
```

**Erros gerados (3):**
```
[UNINITIALIZED_VAR] Line 5, Col 4: 'a' must be initialized. Use 'var a = <value>' or declare it outside the loop.
[UNDEFINED_VARIABLE] Line 5, Col 8: 'a' is not declared
[TYPE_MISMATCH] Line 5, Col 10: invalid operands for operator '+'
```

## Comportamento Esperado (Ideal)

Apenas o erro de inicialização deveria aparecer. Os usos subsequentes deveriam ser ignorados ou tratados como `any`:

```
[UNINITIALIZED_VAR] Line 5, Col 4: 'a' must be initialized. Use 'var a = <value>' or declare it outside the loop.
```

## Código Problemático

```typescript
// src/semantic/TypeChecker.ts:88-94
if ((stmt.declarationType === "var" || stmt.declarationType === "const") && !stmt.initializer) {
  this.errors.push(Errors.varRequiresInitializer(name, stmt.name));
  return;  // ← PROBLEMA: variável não é registrada no ambiente
}
```

## Causa Raiz

A função `checkVariableStmt` dá `return` sem registrar a variável no ambiente (`this.currentEnv.define(...)`). Isso faz com que:
1. O erro `UNINITIALIZED_VAR` seja gerado
2. A variável não exista no escopo
3. Qualquer uso de `a` depois disso resulte em `UNDEFINED_VARIABLE`

## Plano de Correção (Opção A - Recomendada)

### Modificar `checkVariableStmt` para registrar como `any`:

```typescript
if ((stmt.declarationType === "var" || stmt.declarationType === "const") && !stmt.initializer) {
  this.errors.push(Errors.varRequiresInitializer(name, stmt.name));
  // Registra como any para evitar erros em cascata
  const type = stmt.type || { kind: "PrimitiveType", name: "any" };
  this.currentEnv.define(name, createSymbol(name, type, "variable", true, stmt.name));
  return;
}
```

**Prós:**
- Elimina erros em cascata (`UNDEFINED_VARIABLE`, `TYPE_MISMATCH`)
- Usuário vê apenas o erro principal
- Código continua sendo verificado com tipo `any` (sem quebras)

**Contras:**
- Variável é registrada com tipo `any` (menos seguro)
- Pode mascarar outros erros reais

## Plano de Correção (Opção B - Alternativa)

### Modificar para parar a verificação do bloco atual:

```typescript
if ((stmt.declarationType === "var" || stmt.declarationType === "const") && !stmt.initializer) {
  this.errors.push(Errors.varRequiresInitializer(name, stmt.name));
  // Define um "flag" para ignorar usos da variável no escopo atual
  this.ignoredVariables.add(name);
  return;
}
```

E depois, ao verificar usos de variáveis:
```typescript
if (this.ignoredVariables.has(name)) {
  return { kind: "PrimitiveType", name: "any" }; // ou skip
}
```

**Prós:**
- Não registra a variável de forma falsa
- Mais "correto" semanticamente

**Contras:**
- Requer mudanças em múltiplos lugares (checkVariableExpr, etc.)
- Mais complexo de implementar

## Solução Adotada Temporariamente

Manter comportamento atual (erros em cascata) até decidir qual abordagem seguir. O erro principal (`UNINITIALIZED_VAR`) é claro, os demais são "ruído" aceitável.

## Arquivos Relacionados

- `src/semantic/TypeChecker.ts` (linhas 88-94)
- `src/semantic/errors.ts` (função `varRequiresInitializer`)
- `test_declaration_without_init.med` - Teste que demonstra o bug

## Casos de Teste Afetados

### Teste do Bug
Arquivo: `test_declaration_without_init.med`
```javascript
var a
val x = a + 1  // Gera 3 erros (1 principal + 2 cascata)
```

**Resultado atual:** 3 erros
**Resultado esperado (após correção):** 1 erro (`UNINITIALIZED_VAR`)

---

**Nota:** Este é um problema de UX (User Experience). A correção é recomendada mas não é crítica. O comportamento atual não está "errado", apenas gera saída verbosa para o usuário.
