# Erros Detectados pelo Semantic Analyzer

## Visão Geral

O Semantic Analyzer valida o significado e a consistência dos tipos após a análise sintática do Parser.

---

## Erros Implementados

### 1. UNDEFINED_VARIABLE
**Descrição:** Variável usada sem ter sido declarada

**Código:**
```med
x + 5
```

**Erro:**
```
[Semantic]: Variable 'x' is not defined
At line 2, column 0
```

---

### 2. ALREADY_DECLARED
**Descrição:** Variável redeclarada no mesmo escopo

**Código:**
```med
var x = 10
var x = 20
```

**Erro:**
```
[Semantic]: Variable 'x' is already declared
At line 3, column 4
```

---

### 3. TYPE_MISMATCH
**Descrição:** Tipos incompatíveis em operação

**Código:**
```med
var x: int = 10
var y: string = "hi"
x + y
```

**Erro:**
```
[Semantic]: Operator '+' requires same types
At line 4, column 4
```

---

### 4. VAL_REQUIRES_TYPE
**Descrição:** `val` sem(type annotation

**Código:**
```med
val x = 10
```

**Erro (detected no Parser):**
```
[Parse Error]: Type annotation is required for 'val' declarations
```

---

### 5. INVALID_OPERATION
**Descrição:** Operação inválida (ex: logical com não-boolean)

**Código:**
```med
var x: int = 10
var y: int = 20
x && y
```

**Erro:**
```
[Semantic]: Logical operators require boolean operands
```

---

## Erros Futuros (Não Implementados)

- READ_ONLY - Atribuição a `val` ou `const`
- CANNOT_ASSIGN - Atribuição de tipo incompatível
- INVALID_FUNCTION_CALL - Chamada de função inválida
- INVALID_ARRAY_INDEX - Índice de array inválido

---

## Fluxo de Validação

```
AST
  │
  ▼
TypeChecker.checkStatement()
  │
  ├─► VariableStmt
  │     ├─► Verifica se já existe → ALREADY_DECLARED
  │     ├─► Valida tipo de val → VAL_REQUIRES_TYPE
  │     ├─► Infere tipo do inicializador
  │     └─► Registra na Symbol Table
  │
  ├─► ExpressionStmt
  │     └─► checkExpression()
  │           ├─► Identifier → resolve → UNDEFINED_VARIABLE
  │           ├─► Binary → verifica tipos → TYPE_MISMATCH
  │           └─► Unary → valida operação
  │
  ▼
Erros Coletados
```

---

## Testando os Erros

```powershell
.\andro.bat run test-error.med
```

Se houver erros semânticos, serão exibidos após a análise sintática:

```
> Syntax pass completed: AST generated with N statements.

> Semantic errors found:
[Semantic]: <mensagem>
At line N, column M
```