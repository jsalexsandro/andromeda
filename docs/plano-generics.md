# Plano: NamedTypeNode com Generics

## Situação Atual

### Tokens (Funcionando)
```
val items: Array<int>
```
Tokeniza corretamente:
- `val` → KEYWORD
- `items` → IDENTIFIER
- `:` → COLON
- `Array` → IDENTIFIER (tipo customizado)
- `<` → LESS_THAN
- `int` → INT_TYPE
- `>` → GREATER_THAN

### Parser (Parcial)
- `val items: Array` → **Funciona** (NamedTypeNode)
- `val items: Array<int>` → **Erro** ("Unexpected token '<'")

---

## Função Principal: parseGenericType()

Nova função que será chamada por `parseAnnotation()` quando detectar `<` após um tipo.

###assinatura:
```typescript
/**
 * Parses a generic type annotation.
 * Examples:
 *   Array<int>        → GenericTypeNode { name: "Array", args: [PrimitiveTypeNode] }
 *   Map<K, V>         → GenericTypeNode { name: "Map", args: [NamedType, NamedType] }
 *   Array<Array<T>>   → GenericTypeNode { name: "Array", args: [GenericType] }
 *
 * @returns {TypeNode} The parsed generic type node.
 */
private parseGenericType(typeName: Token): TypeNode
```

###Lógica:
1. Recebe o nome do tipo (`Array`, `Map`, etc.)
2. Faz advance para `<`
3. Parsa argumentos separados por `,`
4. Para cada argumento: chama `parseAnnotation()` recursivamente
5. Verifica `>` para fechar
6. Retorna GenericTypeNode com args

---

## Modificações Necessárias

### 1. Modificar parseAnnotation()
Adicionar verificação para `LESS_THAN` após IDENTIFIER:

```typescript
// Após parseNamedTypeNode():
if (typeToken.type === TokenType.IDENTIFIER) {
  const typeName = typeToken
  this.advance() // consume identifier

  // Check for generic parameters: Array<T>
  if (this.check(TokenType.LESS_THAN)) {
    return this.parseGenericType(typeName)
  }

  console.log(`DEBUG - [${typeName.value}]`)
  return { kind: "NamedType", name: typeName }
}
```

### 2. Nova função parseGenericType()

```typescript
private parseGenericType(typeName: Token): TypeNode {
  this.advance() // consume '<'

  const args: TypeNode[] = []

  while (!this.check(TokenType.GREATER_THAN) && !this.isAtEnd()) {
    // Parse each type argument recursively
    const typeArg = this.parseAnnotation()
    if (typeArg) {
      args.push(typeArg)
    }

    if (this.check(TokenType.COMMA)) {
      this.advance() // consume ','
    } else {
      break
    }
  }

  if (!this.check(TokenType.GREATER_THAN)) {
    this.error("Expected '>' to close generic type", this.peek())
    return { kind: "NamedType", name: typeName }
  }

  this.advance() // consume '>'

  console.log(`DEBUG - [${typeName.value}<${args.map(a => (a as any).name || (a as any).kind).join(', ')}>]`)
  return {
    kind: "GenericType",
    name: typeName,
    args
  }
}
```

---

## Testes Esperados

| Código | Resultado |
|--------|---------|
| `val items: Array<int>` | DEBUG - [Array<int>] |
| `val users: List<User>` | DEBUG - [List<User>] |
| `val pairs: Map<string, int>` | DEBUG - [Map<string, int>] |
| `val matrix: Array<Array<float>>` | DEBUG - [Array<Array<float>>] |

---

## Dependencies

- `parseAnnotation()` precisa ser chamada recursivamente para parsear argumentos
- já existe no parser: tokens para `<` (LESS_THAN) e `>` (GREATER_THAN)
- AST já suporta GenericTypeNode

---

## Riscos / Complexidade

1. **Generic nesting** (`Array<Array<T>>`) - o parser precisa consumir `>` corretamente
2. **Multiple args** (`Map<K, V>`) - separar por vírgula
3. **Recursion** - parseAnnotation() precisa ser recursivo para generics aninhados