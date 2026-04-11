# Design do Lexer - Androx (JSX-like)

## Modos do Lexer

O lexer usa uma **stack de modos** para trackear o contexto:

```typescript
type LexerMode = 'NORMAL' | 'ANDROX_TAG' | 'ANDROX_CHILDREN' | 'ANDROX_EXPR'
```

### Transições de Modo

```
NORMAL ─[see < letter ]──→ ANDROX_TAG
ANDROX_TAG ─[see > ]──────→ ANDROX_CHILDREN
ANDROX_TAG ─[see /> ]────────→ NORMAL (pop)
ANDROX_CHILDREN ─[see < ]──→ ANDROX_TAG (push)
ANDROX_CHILDREN ─[see { ]──→ ANDROX_EXPR (push)
ANDROX_CHILDREN ─[see </]──→ ANDROX_CLOSE (→ NORMAL pop)
ANDROX_EXPR ─[braceDepth 0]──→ ANDROX_CHILDREN (pop)
```

## Tokens Androx

| Token | Value | Descrição |
|-------|-------|-----------|
| `ANDROX_OPEN` | `<` | Abre tag |
| `ANDROX_TAG_NAME` | Nome da tag | Nome da tag |
| `ANDROX_TAG_END` | `>` | Fecha tag openings |
| `ANDROX_CLOSE_OPEN` | `</` | Abre closing tag |
| `ANDROX_CLOSE_TAG_NAME` | Nome da tag | Nome no closing |
| `ANDROX_CLOSE_END` | `>` | Fecha closing tag |
| `ANDROX_SELF_CLOSE` | `/>` | Tag self-closing |
| `ANDROX_ATTR_NAME` | Nome | Nome do atributo |
| `ANDROX_ATTR_STR` | String | Valor string do atributo |
| `ANDROX_ATTR_TRUE` | true | Atributo sem valor |
| `ANDROX_TEXT` | Texto | Texto livre em children |
| `ANDROX_EXPR_OPEN` | `{` | Abre expressão |
| `ANDROX_EXPR_CLOSE` | `}` | Fecha expressão |

## Decisão do lexer após `=`

```typescript
// modo ANDROX_TAG, após ver ATTR_NAME + ASSIGN
if (peek() === '"' || peek() === "'") {
  emit ANDROX_ATTR_STR, stay in ANDROX_TAG
} else if (peek() === '{') {
  emit ANDROX_EXPR_OPEN, push ANDROX_EXPR
} else {
  // Attribute.name sem valor = boolean true
  emit ANDROX_ATTR_TRUE, stay in ANDROX_TAG
}
```

## Profundidade de chaves (Brace Depth)

Em modo ANDROX_EXPR, `{` e `}` podem ser:
1. Object literals `{a: 1}`
2. Expressões `{count + 1}`

```typescript
// modo ANDROX_EXPR
if (ch === '{') {
  braceDepth++
  emit LBRACE, stay
} else if (ch === '}') {
  braceDepth--
  if (braceDepth === 0) {
    emit ANDROX_EXPR_CLOSE, pop mode
  } else {
    emit RBRACE, stay
  }
}
```

## Exemplos de Output

### `<div>Hello World</div>`
```
KEYWORD     | val
IDENT      | html
ASSIGN     | =
ANDROX_OPEN | <
ANDROX_TAG_NAME | div
ANDROX_TAG_END | >
ANDROX_TEXT | Hello World
ANDROX_CLOSE_OPEN | </
ANDROX_CLOSE_TAG_NAME | div
ANDROX_CLOSE_END | >
```

### `<div id="app">Content</div>`
```
ANDROX_OPEN | <
ANDROX_TAG_NAME | div
ANDROX_ATTR_NAME | id
ASSIGN | =
ANDROX_ATTR_STR | app
ANDROX_TAG_END | >
ANDROX_TEXT | Content
ANDROX_CLOSE_OPEN | </
ANDROX_CLOSE_TAG_NAME | div
ANDROX_CLOSE_END | >
```

### `<div id={userId}>`
```
ANDROX_OPEN | <
ANDROX_TAG_NAME | div
ANDROX_ATTR_NAME | id
ASSIGN | =
ANDROX_EXPR_OPEN | {
IDENT | userId
ANDROX_EXPR_CLOSE | }
ANDROX_TAG_END | >
```

### `<div style={{color: "red"}}>`
```
ANDROX_OPEN | <
ANDROX_TAG_NAME | div
ANDROX_ATTR_NAME | style
ASSIGN | =
ANDROX_EXPR_OPEN | {
LBRACE | {
IDENT | color
COLON | :
STRING | red
COMMA | ,
IDENT | padding
COLON | :
NUMBER | 10
RBRACE | }
ANDROX_EXPR_CLOSE | }
ANDROX_TAG_END | >
```

### `<ul><li>Item 1</li></ul>`
```
ANDROX_OPEN | <
ANDROX_TAG_NAME | ul
ANDROX_TAG_END | >
ANDROX_OPEN | <
ANDROX_TAG_NAME | li
ANDROX_TAG_END | >
ANDROX_TEXT | Item 1
ANDROX_CLOSE_OPEN | </
ANDROX_CLOSE_TAG_NAME | li
ANDROX_CLOSE_END | >
ANDROX_CLOSE_OPEN | </
ANDROX_CLOSE_TAG_NAME | ul
ANDROX_CLOSE_END | >
```

### `<img src="photo.jpg"/>`
```
ANDROX_OPEN | <
ANDROX_TAG_NAME | img
ANDROX_ATTR_NAME | src
ASSIGN | =
ANDROX_ATTR_STR | photo.jpg
ANDROX_SELF_CLOSE | />
```

## Atributos no AST

```typescript
interface AndroxAttribute {
  name: string
  value: string | boolean | Expr
}
```

- `id="app"` → `{ name: "id", value: "app" }`
- `disabled` → `{ name: "disabled", value: true }`
- `id={userId}` → `{ name: "id", value: Identifier("userId") }`
- `style={{color: "red"}}` → `{ name: "style", value: ObjectExpr(...) }`

## Casos especiais

1. **Atributo booleano**: `<input disabled/>` → `value: true`
2. **Expressão dupla**: `{{` no atributo = `{` abre expr + `{` object literal
3. **Aninhamento**: stack permite `<ul><li></li></ul>` corretamente
4. **Texto com espaços**: Em ANDROX_CHILDREN, texto vira ANDROX_TEXT (espaços preservados)