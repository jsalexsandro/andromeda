int => int


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




Generics Annotation
Generics Function
Generics Call
Generics Arrow Function
Generics Implements (T implements Addable) ou (T: Addable)
Generic Defaults (T = int)



## Ordem de Implementação — Type Annotations Nominais

## Fase 1 — Base (o que já funciona, só simplificar)

# Nominal Types
Tipos primitivos nativos: int | string | bool | float | any | void | unknown | undefined | null 
NamedTypeNode (Foo) 
NamedTypeNode com generics (Array<T>, Map<K, V>) (generic por nome)
LiteralsTypes
ArrayType (int[], string[][], T[])
UnionType (int | string | null)
TupleType          →  [string, int, bool, Array<int>]
Grouping Type ()
(T) => U     function type 


--

```

## Fase 2 — Nullable (essencial no nominal)

```
T?           nullable — açúcar para T | null
int?         nullable int
string?      nullable string  
User?        nullable named type
List<T>?     nullable generic
```

Isso é fundamental em Swift/KT/Rust — tipos não são nullable por padrão.

---

[ATE AQUI tudo feito.]

## Fase 3 — Type declarations

```
type UserId = int
type Name = string
type Handler = (Request) => Response
type Pair<T, U> = [T, U]
type Nullable<T> = T | null
```

Adiciona `TypeStmt` ao parser de statements. Aqui começa o nominal de verdade — tipos têm **nome e identidade**.

---

## Fase 4 — Struct (produto nominal)

```
struct User {
  id: int
  name: string
  email: string?
  createdAt: int
}

struct Point<T> {
  x: T
  y: T
}
```

Diferente de object literal — `struct` cria um **tipo nominal**. Dois structs com os mesmos campos são tipos **diferentes**.

---

## Fase 5 — Enum (soma nominal)

```
enum Direction {
  North
  South
  East
  West
}

enum Result<T> {
  Ok(T)
  Err(string)
}

enum Status {
  Active
  Inactive
  Pending(string)
}
```

Enums com e sem payload associado.

---

## Fase 6 — Protocol / Interface (contratos nominais)

```
protocol Printable {
  func print(): void
}

protocol Collection<T> {
  func add(item: T): void
  func get(index: int): T?
  func size(): int
}
```

Diferente de interface estrutural — um tipo só implementa um `protocol` se **declarar explicitamente**.

---

## Fase 7 — Implementação explícita

```
struct User implements Printable {
  id: int
  name: string

  func print(): void {
    print(name)
  }
}
```

O `implements` é o coração do nominal — sem declaração explícita, não há conformidade.

---

## Fase 8 — Type aliases avançados

```
// Opaque types (Rust/Swift style)
opaque type UserId = int    // UserId ≠ int fora do módulo

// Newtype pattern
type Meters = float
type Seconds = float
// Meters e Seconds são incompatíveis mesmo sendo float

// Constrained generics
type NonEmpty<T> = List<T>  // where len > 0 (checar em runtime)
```

