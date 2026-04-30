# Limitação: Variável sem Inicialização no For Loop

**Data:** 2026-04-30  
**Status:** Documentado (limitação conhecida)  
**Severidade:** Baixa (gera erro semântico)

## Descrição

Declarar uma variável com `var` sem inicialização no inicializador do `for` causa erros semânticos ao tentar usar a variável na condição ou no update.

## Comportamento Atual

O código abaixo gera erros de `TYPE_MISMATCH`:

```javascript
for (var i; i < 5; i = i + 1) {
  val x: int = i
}
```

**Erros gerados:**
```
[TYPE_MISMATCH] Line 1, Col 14: invalid operands for operator '<'
[TYPE_MISMATCH] Line 1, Col 25: invalid operands for operator '+'
```

## Causa Raiz

Quando `var i` é declarada sem inicialização:
1. O tipo de `i` não é definido (fica como `unknown` ou tipo inválido)
2. Na condição `i < 5`, o tipo de `i` é desconhecido, gerando erro
3. No update `i = i + 1`, o mesmo problema ocorre

## Exemplos que Funcionam

### Com inicialização (recomendado):
```javascript
for (var i = 0; i < 5; i = i + 1) {
  val x: int = i
}
```

### Com inicialização em escopo externo:
```javascript
var i = 0
for (; i < 5; i = i + 1) {
  val x: int = i
}
```

## Possíveis Soluções para o Futuro

### 1. Proibir `var i` sem inicialização (Simples)
- Adicionar verificação em `checkVariableStmt` ou no parser
- Erro: "Variable must be initialized"
- **Prós:** Simples de implementar, previne erros
- **Contras:** Menos flexível

### 2. Inferir tipo no primeiro uso (Complexo)
- Precisa de análise de fluxo de dados (data-flow analysis)
- Exemplo: `i = 0` definiria o tipo como `int`
- **Prós:** Mais flexível, permite códigos como `var i; i = 0;`
- **Contras:** Complexo, requer mudanças significativas no TypeChecker

### 3. Permitir e tratar como `any` (Flexível, menos seguro)
- Variáveis não inicializadas seriam tratadas como tipo `any`
- **Prós:** Muito flexível
- **Contras:** Menos seguro, perde benefícios de tipagem estática

## Recomendação Atual

Manter o comportamento atual (gerar erro de tipo inválido) e incentivar os usuários a:
1. Sempre inicializar variáveis no `for`: `for (var i = 0; ...)`
2. Ou declarar fora do `for`: `var i = 0; for (; i < 5; ...)`

## Arquivos Relacionados

- `src/semantic/TypeChecker.ts` - `checkForStmt` (linhas 569-607)
- `src/semantic/TypeChecker.ts` - `checkVariableStmt` (onde poderia ser adicionada a verificação)
- `test_var_without_init.med` - Teste que demonstra a limitação

## Casos de Teste

### Teste da Limitação
Arquivo: `test_var_without_init.med`
```javascript
for (var i; i < 5; i = i + 1) {
  val x: int = i
}
```

**Resultado esperado:** 2 erros `TYPE_MISMATCH` (condição e update)

---

**Nota:** Esta é uma limitação conhecida e documentada. O comportamento atual é considerado aceitável pois:
1. Gera erros claros de tipo inválido
2. O código correto (com inicialização) funciona perfeitamente
3. Mudanças para suportar `var i` sem inicialização têm baixa prioridade
