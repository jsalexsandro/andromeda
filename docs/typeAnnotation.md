Fase 1 — Base sólida (você já tem parcialmente)

int | string | bool | float | any | void | unknown | undefined | null
TypeReference (Foo)
TypeReference com generics (Array<T>, Map<K, V>)
ArrayType (int[], string[][], T[])
  - Spread em Array Type
UnionType (int | string | null)
IntersectionType   →  TypeA & TypeB
--


Fase 2 — Tipos compostos estruturais
ObjectLiteralType  →  { name: string; age: int }
TupleType          →  [string, int, bool]
  - Spread em TupleType
  
FunctionType       →  (x: int, y: int) => bool
  - ArrowTypes
ParenthesizedType  →  (int | string)

---
  
*  Funções com tipo reaproveitando a Api de Anotações
    func app(): <annotation>{}

* Parametro de funções reaproveitando a Api de Anotações
    func app(name:<annotation>): <annotation>{}

* Spread parametro nas anotações de tipo

---

-- testar paramentro com opicionais ? ex: (id?: int) [ok]
-- testar spread opicional ex (...args: int[]) [ok]

  

Fase 3 — Operadores de tipo
keyof T
typeof x
readonly T


Fase 3.5 - Suporte completo a generics
Generics Annotation
Generics Function
Generics Call
Generics Arrow Function

[Chcecked]


Fase 4 — Tipos avançados
IndexedAccessType   →  T[K], T["key"]
ConditionalType     →  T extends U ? X : Y
TypePredicate       →  x is string  (em return types de funções)
TypeQuery           →  typeof foo
NullableTypes

Fase 5 — Mapped e Template types
MappedType          →  { [K in keyof T]: T[K] }
TemplateLiteralType →  `${string}-${number}`

--

Generics Implements
const sum = <T: Addable & Compareble>(a: T, b: T) => a + b
const sum = <T implements Addable & Compareble>(a: T, b: T) => a + b

shortHands Func:
func add(a: int, b: int): int => a + b