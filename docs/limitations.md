# Limitações Identificadas

## Para Corrigir Futuramente

### 1. Type Annotation com null
```med
var n: null = null  // null não é tipo válido
```
**Status:** Parser rejeita - `null` não é reconhecido como type annotation

### 2. Block Expression como initializer
```med
var blockResult = { var a = 1; a + b }
```
**Status:** Parser rejeita - Block não é permitido como expression initializer

### 3. String Concatenation
```med
var full = greeting + " " + name
```
**Status:** Semantic erro - operador + com strings não implementado

---

## Como Testar Novamente

```bash
.\andro.bat run <arquivo>.med
```

### Testes de Stress Anteriores
- 41 statements com 0 erros ✅
- 73 statements com 1 erro (string concat) ✅