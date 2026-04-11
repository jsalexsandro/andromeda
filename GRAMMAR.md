# Gramática do Andromeda

## Versão 1.0.0

---

## 1. Literais

```
Literal     → NUMBER | STRING | BOOLEAN | NULL
NUMBER     → [0-9]+ ("." [0-9]+)?
STRING     → "\"" ... "\""
BOOLEAN    → "true" | "false"
NULL       → "null"
```

---

## 2. Identificadores

```
Identifier → [a-zA-Z_][a-zA-Z0-9_]*
```

---

## 3. Operadores Unários

```
Unary      → ("-" | "+" | "!") Expression
```

---

## 4. Operadores Binários

### 4.1 Aritméticos
```
Arithmetic → ("+" | "-" | "*" | "/" | "%") Expression
```

### 4.2 Comparação
```
Comparison → ("==" | "!=" | ">" | "<" | ">=" | "<=") Expression
```

### 4.3 Lógicos
```
Logical   → ("&&" | "||") Expression
```

---

## 5. Agrupamento

```
Group     → "(" Expression ")"
```

---

## 6. Precedência de Operadores (do menor para maior)

```
1.  OR           ||
2.  AND          &&
3.  EQUALS       ==  !=
4.  LESSGREATER  >   <   >=  <=
5.  SUM          +   -
6.  PRODUCT      *   /   %
7.  PREFIX      -X  +X  !X
8.  CALL        ()
9.  INDEX       []
10. MEMBER       .
```

---

## 7. Declaração de Variáveis

```
VariableDecl → ("var" | "val" | "const") Identifier (":" Type)? ("=" Expression)?

Type        → "int" | "float" | "bool" | "string" | "void" | Identifier
```

### Regras:
- `var`   → mutável, tipo opcional (inferido)
- `val`   → **imutável, tipo obrigatório** ⚠️
- `const` → imutável, tipo opcional (inferido)

### Exemplos:
```andromeda
var x = 10           // mutável, tipo inferido
var y: int = 20      // mutável, tipo int
val z: string = "hi" // imutável, tipo string (obrigatório)
const PI = 3.14      // imutável
```

---

## 8. Statements

```
Statement     → ExpressionStmt
              | VariableStmt
              | BlockStmt
              | IfStmt
              | WhileStmt
              | BreakStmt
              | ContinueStmt
              | ForStmt
              | FunctionStmt
              | ReturnStmt

BlockStmt  → "{" Statement* "}"

Program    → Statement*
```

### 8.1 Block Statement
```
BlockStmt  → "{" Statement* "}"
```
Abre novo escopo léxico para variáveis.

### 8.2 If Statement
```
IfStmt     → "if" "(" Expression ")" Statement ("else" Statement)?
```
- Suporta `if (condição) { ... }`
- Suporta `if ... else { ... }`
- Suporta `else if` (aninhado)

### Exemplos:
```andromeda
if (true) { x = 1 }
if (x > 0) { ... } else { ... }
if (a > 10) { ... } else if (a > 5) { ... } else { ... }
```

### 8.3 While Statement
```
WhileStmt  → "while" "(" Expression ")" Statement
```
- Loop condicional
- Cria novo escopo para variáveis

### Exemplos:
```andromeda
while (condicao) { ... }
while (i < 10) {
  i
}
```

### 8.4 Break & Continue
```
BreakStmt    → "break"
ContinueStmt → "continue"
```
- Só podem ser usados dentro de loops (`while`, `for`)
- Erro semântico se usados fora de loops

### Exemplos:
```andromeda
while (true) {
  if (condicao) break
  if (outra) continue
  x
}
```

---

## 9. Semantic Analyzer

O Semantic Analyzer é executado após o Parser e valida o significado do código.

### 9.1 Escopos (Scope)

Sistema de escopos léxicos aninhados:
- **Escopo Global**: escopo principal
- **Escopo Local**: criado por BlockStmt, if, while, for, função

Cada símbolo é pesquisado primeiro no escopo atual, depois nos pais.

### 9.2 Type Inference

O type checker infere tipos ausente:
```andromeda
var x = 10      // infere: int
var y: int = 20 // explícito: int
```

### 9.3 Erros Semânticos Detectados

| Código | Descrição |
|--------|----------|
| UNDEFINED_VARIABLE | Variável referenciada mas não declarada |
| ALREADY_DECLARED | Nome já usado no mesmo escopo |
| TYPE_MISMATCH | Tipos incompatíveis em operação |
| VAL_REQUIRES_TYPE | `val` sem type annotation |
| INVALID_OPERATION | Operação inválida (ex: logical com não-boolean) |
| INVALID_BREAK | `break`/`continue` usado fora de loop |

---

## 10. Recuperação de Erros

- O parser reporta erros com linha, coluna e ponteiro (^)
- Error deduplication evita mensagens duplicadas
- Recovery automático em caso de erro: pula token problemático e continua

---

## Tokens Reconhecidos

| Tipo | Valor | Descrição |
|------|-------|-----------|
| KEYWORD | var, val, const, func, if, else, while, break, continue | Palavras reservadas |
| IDENTIFIER | nomes | Identificadores |
| NUMBER | 42, 3.14 | Números |
| STRING | "texto" | Strings |
| BOOLEAN | true, false | Booleanos |
| NULL | null | Nulo |
| ASSIGN | = | Atribuição |
| COLON | : | Dois pontos |
| PLUS, MINUS | +, - | Aritméticos |
| STAR, SLASH, MODULO | *, /, % | Aritméticos |
| EQUAL, NOT_EQUAL | ==, != | Comparação |
| LESS_THAN, GREATER_THAN | <, > | Comparação |
| LESS_EQUAL, GREATER_EQUAL | <=, >= | Comparação |
| AND, OR | &&, \|\| | Lógicos |
| LPAREN, RPAREN | ( ) | Agrupamento |
| LBRACE, RBRACE | { } | Bloco |

---

## Histórico de Implementações

| Versão | Data | Features |
|--------|------|-----------|
| 1.0.0 | 2026-04-10 | Lexer, Parser, AST, Literals, Binários, Unários |
| 1.0.1 | 2026-04-11 | Semantic Analyzer, Type Checker, Escopos |
| 1.0.2 | 2026-04-11 | Block Statement, IfStatement |
| 1.0.3 | 2026-04-11 | WhileStatement, BreakStmt, ContinueStmt |

---

## Em Desenvolvimento (Planejado)

- [ ] ForStatement
- [ ] Funções (func, arrow functions)
- [ ] Androx (sintaxe JSX nativa)
- [ ] Classes
- [ ] Import/Export
- [ ] Template Literals
- [ ] Operador Ternário
- [ ] Nullish Coalescing
- [ ] Spread Operator
- [ ] Await/Async