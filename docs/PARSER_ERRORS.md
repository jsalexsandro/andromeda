# Parser Error Handling - Known Issues

## Problemas Identificados

### 1. Erros em Cascata (Cascade Errors)
Quando o parser encontra um erro de sintaxe, frequentemente gera múltiplos erros relacionados. Isso ocorre porque o parser continua tentando parsear mesmo após detectar um erro.

**Exemplo**: Colchete não fechado
```andromeda
var arr = [1, 2, 3
print(arr)
```
**Resultado**: 2 erros são reportados:
- "Expected ',' or ']' after array element"
- "Expected ']' to close array literal"

**Causa raiz**: O parser não faz "panic mode" recovery corretamente - após detectar que falta `]`, ele continua no loop e reporta erro adicional.

### 2. Operador sem Operando Direito
Expressões como `1 +` (operador binário sem operando direito) não reportam erro no parsing.

**Causa raiz**: O parser chama `parseExpression` recursivamente que retorna null, e o resultado é simplesmente descartado.

**Solução**: Este tipo de erro deve ser capturado na análise semântica ou em runtime.

## Comportamento Correto

Os seguintes casos são tratados corretamente:
- ✅ Parênteses não fechado - erro na posição correta
- ✅ If/While sem parênteses - "Expected '(' after 'if/while'"
- ✅ Bloco não fechado - "Expected '}' to close block"
- ✅ Vírgula faltando em array/objeto

## Melhorias Sugeridas

1. **Implementar Panic Mode Recovery**: Quando um erro crítico é encontrado, fazer synchronize() imediatamente para evitar erros cascata.

2. **Verificação de Operandos**: Adicionar checagem em operadores binários para garantir que o operando direito existe.

3. **Melhor Posicionamento de Erros**: Alguns erros ainda mostram posição incorreta (apontando para token errado).
