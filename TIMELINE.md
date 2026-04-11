# Andromeda - Timeline de Implementações

## Versão 1.0.0

### Concluídos
- [x] 2026-04-10 - Identifiers (x, nome, minha_variavel, camelCase, etc)
- [x] 2026-04-10 - Literals (string, number, boolean, null)
- [x] 2026-04-10 - Operadores Binários (+, -, *, /, %, ==, !=, >, <, >=, <=, &&, ||)
- [x] 2026-04-10 - Grouped Expressions (parênteses: (expr))
- [x] 2026-04-10 - Operadores Unários (-X, +X, !X)
- [x] 2026-04-10 - VariableDeclaration (var, val, const)

#### Funcionalidades testadas:
- Unário negativo: `-5`, `-x`
- Unário positivo: `+5`, `+ +2`
- Unário not: `!true`, `!flag`, `!s`
- Duplo unário: `!!true`, `--5`, `+ - 2`
- Unário após binário: `-10 + -3`, `10 - -2`
- Com parênteses: `-(1 + 2)`, `!(-x)`
- Com binários: `-5 * 2`, `3 + -2`, `-1 * -2`

### Planejados
- [ ] Incremento/Decremento (++, --)
- [ ] Variáveis (var, val, const)
- [ ] Controle de fluxo (if, while, for)
- [ ] Funções (func, arrow functions)
- [ ] Androx (sintaxe JSX nativa)
- [ ] Classes
- [ ] Import/Export
- [ ] Template Literals
- [ ] Operador Ternário
- [ ] Nullish Coalescing
- [ ] Spread Operator
- [ ] Await/Async

---

## Histórico de Releases

### v1.0.0 (2026-04-10)
- Lexer com análise léxica
- Parser com precedence climbing
- AST completo para expressões
- Suporte a Literals, Binários, Unários e Grouped Expressions