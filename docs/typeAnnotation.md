Fase 1 — Base sólida (você já tem parcialmente)

int | string | bool | float | any | void | unknown | undefined | null
TypeReference (Foo)
TypeReference com generics (Array<T>, Map<K, V>)
ArrayType (int[], string[][], T[])
UnionType (int | string | null)
IntersectionType   →  TypeA & TypeB
--


Fase 2 — Tipos compostos estruturais
ObjectLiteralType  →  { name: string; age: int }
[Chcecked]

TupleType          →  [string, int, bool]
FunctionType       →  (x: int, y: int) => bool
ParenthesizedType  →  (int | string)


Fase 3 — Operadores de tipo
keyof T
typeof x
readonly T


Fase 4 — Tipos avançados
IndexedAccessType   →  T[K], T["key"]
ConditionalType     →  T extends U ? X : Y
TypePredicate       →  x is string  (em return types de funções)
TypeQuery           →  typeof foo

Fase 5 — Mapped e Template types
MappedType          →  { [K in keyof T]: T[K] }
TemplateLiteralType →  `${string}-${number}`