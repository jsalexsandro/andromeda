# Plano: ArrayType (`int[]`, `string[][]`, `T[]`)

## Situação Atual

**O que já existe no AST:**

```typescript
// T[], string[], User[]
export interface ArrayTypeNode {
  kind: "ArrayType"
  elementType: TypeNode
}
```

**Problema:** Não armazena o número de dimensões.

---

## Modificação no AST

```typescript
export interface ArrayTypeNode {
  kind: "ArrayType"
  elementType: TypeNode
  dimensions: number   // 1 para [], 2 para [][] , etc.
}
```

---

## Tokens (precisam ser verificados)

O lexer tokeniza `[]` corretamente:
- `[` → LBRACKET
- `]` → RBRACKET

---

## Nova função: `parseArrayType()`

Local: parser.ts, próxima às outras funções de tipo

```typescript
/**
 * Parses an array type expression.
 * Examples:
 *   int[]         → ArrayTypeNode { elementType: PrimitiveType, dimensions: 1 }
 *   string[][]    → ArrayTypeNode { elementType: ArrayTypeNode, dimensions: 2 }
 *   User[]       → ArrayTypeNode { elementType: NamedType, dimensions: 1 }
 *   T[]          → ArrayTypeNode { elementType: NamedType, dimensions: 1 }
 *
 * @param {TypeNode} elementType - O tipo base do array
 * @returns {TypeNode} O tipo array com dimensões corretas
 */
private parseArrayType(elementType: TypeNode): TypeNode {
  let dimensions = 1
  
  while (this.check(TokenType.RBRACKET)) {
    this.advance() // consume ']'
    dimensions++
    
    if (this.check(TokenType.LBRACKET)) {
      this.advance() // consume '['
      // Continua para próximos []
    }
  }
  
  console.log(`DEBUG - [${elementType.name || elementType.kind}${']'.repeat(dimensions)}]`)
  
  return {
    kind: "ArrayType",
    elementType,
    dimensions
  }
}
```

---

## Modificação em `parseAnnotation()`

Adicionar verificação para LBRACKET após tipo:

```typescript
// ArrayType - int[], string[][], User[], etc.
if (this.check(TokenType.LBRACKET)) {
  this.advance() // consume '['
  return this.parseArrayType(baseType)
}
```

---

## Testes Esperados

| Código | Resultado |
|--------|----------|
| `val arr: int[]` | DEBUG - [int[]] |
| `val matrix: string[][]` | DEBUG - [string[]][]] |
| `val users: User[]` | DEBUG - [User[]] |
| `val 3d: int[][][]` | DEBUG - [int[]][][]] |