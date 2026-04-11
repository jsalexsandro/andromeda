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
Statement  → ExpressionStmt
           | VariableStmt
           | BlockStmt
           | IfStmt
           | WhileStmt
           | ForStmt
           | FunctionStmt
           | ReturnStmt

BlockStmt  → "{" Statement* "}"

Program    → Statement*
```

---

## 9. Recuperação de Erros

- O parser reporta erros com linha, coluna e ponteiro (^)
- Error deduplication evita mensagens duplicadas
- Recovery automático em caso de erro: pula token problemático e continua

---

## Tokens Reconhecidos

| Tipo | Valor | Descrição |
|------|-------|-----------|
| KEYWORD | var, val, const, func, if, etc | Palavras reservadas |
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

## Em Desenvolvimento (Planejado)

- [ ] Androx (sintaxe JSX nativa)
- [ ] Funções (func, arrow functions)
- [ ] Controle de fluxo (if, while, for)
- [ ] Classes
- [ ] Import/Export
- [ ] Template Literals
- [ ] Operador Ternário
- [ ] Nullish Coalescing
- [ ] Spread Operator
- [ ] Await/Async