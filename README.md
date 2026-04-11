# Andromeda Programming Language

> Uma linguagem de programação moderna em construção.

## Status

**Versão:** 1.0.2  
**Build:** Experimental

---

## Instalação

```bash
# Clone o repositório
git clone https://github.com/jsalexsandro/andromeda.git

# Entre no diretório
cd andromeda

# Instale as dependências (Bun)
bun install
```

---

## Uso

```bash
# Executar um arquivo .med
.\andro.bat run arquivo.med

# Ver tokens
.\andro.bat tokens arquivo.med

# Ajuda
.\andro.bat help
```

---

## Sintaxe

### Variáveis

```andromeda
var x = 10                    // mutável, tipo inferido
var y: int = 20              // mutável, tipo explícito
val z: string = "hello"      // imutável, tipo obrigatório
const PI = 3.14159           // constante
```

### Expressões

```andromeda
// Operadores aritméticos
x + y * z - 10 / 2

// Operadores de comparação
x == y
x > y
x <= y

// Operadores lógicos
a && b
x || !y

// Agrupamento
(1 + 2) * 3
```

### Statements

```andromeda
// Blocos (criam escopo)
{
  var x = 10
  var y = 20
}

// If/Else
if (x > 10) {
  var result = "maior"
} else {
  var result = "menor"
}

// Else If
if (x > 90) {
  // excellent
} else if (x > 70) {
  // good  
} else {
  // needs improvement
}
```

---

## Features Implementadas

| Feature | Status |
|---------|--------|
| Literals (int, float, string, bool, null) | ✅ |
| Identifiers | ✅ |
| Operadores Unários (-, +, !) | ✅ |
| Operadores Binários (+, -, *, /, %, ==, !=, >, <, >=, <=) | ✅ |
| Operadores Lógicos (&&, \|\|) | ✅ |
| Agrupamento (parênteses) | ✅ |
| Precedência de Operadores | ✅ |
| VariableDeclaration (var, val, const) | ✅ |
| Type Annotation | ✅ |
| BlockStatement (escopos) | ✅ |
| IfStatement (if/else/else if) | ✅ |
| Semantic Analyzer | ✅ |
| Type Checker | ✅ |
| Escopos Aninhados | ✅ |
| Error Recovery | ✅ |

---

## Features Planejadas

- [ ] WhileStatement
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

---

## Arquitetura

```
Source Code
    │
    ▼
  ┌──────┐
  │Lexer │  → Tokenização
  └──────┘
    │
    ▼
  ┌───────┐
  │Parser│  → Análise Sintática (Pratt Parser)
  └───────┘
    │
    ▼
    AST
    │
    ▼
  ┌──────────────┐
  │Semantic     │  → Análise Semântica
  │Analyzer     │    - Type Checking
  └──────────────┘    - Scope Management
```

---

## Documentação

- [GRAMMAR.md](GRAMMAR.md) - Gramática completa
- [TIMELINE.md](TIMELINE.md) - Histórico de implementações

---

## Contribuindo

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/name`)
3. Commit suas mudanças (`git commit -m 'feat: add feature'`)
4. Push para a branch (`git push origin feature/name`)
5. Abra um Pull Request

---

## Licença

MIT License

---

## Autor

jsalexsandro - https://github.com/jsalexsandro
