# Protocol Implementation Guide

### ProtocolStmt
- [ ] Registrar `name` no escopo de tipos
- [ ] Validar métodos do protocol (sem corpo, apenas assinatura)
- [ ] Detectar métodos duplicados no protocol
- [ ] Registrar protocol como type symbol
- [ ] Suporte a `TypeParameterNode` (protocol genérico)


- [ ] Checar que `protocols` declarados em `implements` existem no escopo
- [ ] Verificar conformance: struct implementa todos métodos do protocol

# Até aqui no semantic
---

FASE 1.0 — PROTOCOL TYPES
│
├── 1. Parser base do protocol
│      1.1 Reconhecer keyword `protocol`
│      1.2 Parser do nome do protocol
│      1.3 Parser do corpo `{ ... }` (apenas assinaturas)
│      1.4 Criar AST ProtocolStmt
│      1.5 Registrar protocol na symbol table
│      1.6 Detectar protocols duplicados
│      1.7 Permitir protocol vazio
│
├── 2. Protocol Methods
│      2.1 Parser de assinaturas (sem corpo)
│             func print(): void
│             func equals(other: Self): bool
│      2.2 Semantic: validar que não tem corpo
│      2.3 Detectar métodos duplicados
│      2.4 Suporte a `Self` type (referência ao próprio protocol)
│      2.5 Suporte a type params no método
│      2.6 Herdar possibilidades de ParserTypeAnnotation
│
├── 3. Struct implements Protocol
│      3.1 Parser: `struct User implements Printable { ... }`
│      3.2 Semantic: verificar protocol existe
│      3.3 Verificar conformance: todos métodos implementados
│      3.4 Validar assinaturas compatíveis (params, return type)
│      3.5 Permitir múltiplos protocols: `implements A, B`
│      3.6 Struct genérico implementa protocol genérico
│
├── 4. Protocol Conformance (Type Checker)
│      4.1 Protocol como tipo em anotações: `val p: Printable`
│      4.2 Assignment: `val p: Printable = User { ... }`
│      4.3 Protocol genérico: `val p: Container<int>`
│      4.4 Upcast implícito: struct → protocol
│      4.5 Downcast / type assertion (futuro)
│
├── 5. Protocol Generics
│      5.1 `protocol Container<T> { func get(): T }`
│      5.2 Registrar type params
│      5.3 Substituição em conformance
│      5.4 Nested generics
│      5.5 GENERIC_ARG_COUNT
│      5.6 Duplicate type params

   [ATÉ AQUI FEITO]
│
├── 6. Protocol Extension (futuro)
│      6.1 `extend Printable for User { ... }`
│      6.2 Default implementations
│      6.3 Conflitos de extensão
│ 
├── 7. Protocol Inheritance (futuro)
│      7.1 `protocol A extends B`
│      7.2 Multiple inheritance
│      7.3 Diamond problem handling
│
├── 8. Associated Types (futuro)
│      8.1 `protocol Iterator { type Item; func next(): Item? }`
│      8.2 Type inference em conformance
│
├── 9. Existential Types (futuro)
│      9.1 `any Printable` (type erasure)
│      9.2 `some Printable` (opaque type)
│      9.3 Boxing/unboxing
│
├── 10. Protocol Composition (futuro)
│       10.1 `typealias PrintableCloneable = Printable & Cloneable`
│       10.2 Intersection types
│       10.3 Where clauses: `func foo<T: Printable>(x: T)`

---

### Diagnostics
- [ ] PROTOCOL_NOT_FOUND — protocol referenciado não existe
- [ ] MISSING_PROTOCOL_METHOD — struct não implementa método requerido
- [ ] PROTOCOL_METHOD_MISMATCH — assinatura incompatível
- [ ] DUPLICATE_PROTOCOL_METHOD — método duplicado no protocol
- [ ] CIRCULAR_PROTOCOL — herança circular (futuro)
- [ ] SELF_TYPE_MISUSE — `Self` usado fora de protocol
- [ ] GENERIC_ARG_COUNT_PROTOCOL — args genéricos errados
- [ ] DUPLICATE_PROTOCOL_TYPE_PARAM — type param duplicado
- [ ] PROTOCOL_CONFORMANCE_FAILED — falha geral de conformance

---

### Test Cases Required

> **Nota sobre o exemplo `Printable`:** estes casos usam `Printable { func print(): void }`
> como exemplo de protocol. O `print` que aparece dentro do corpo (`print(self.name)`)
> é o [builtin](../controlls/api-bultins.md), enquanto `u.print()` é o método — são
> coisas diferentes. Para formatação de structs a linguagem usa
> `Stringable { func toString(): string }`, que o `print` respeita automaticamente.

#### 1.1 Protocol Básico
```andromeda
protocol Stringable {
  func toString(): string
}

struct User implements Stringable {
  name: string
  func toString(): string {
    return "User(" + self.name + ")"
  }
}

val u = User { name: "Alice" }
print(u)  // User(Alice)
```

#### 1.2 Protocol com Self
```andromeda
protocol Equatable {
  func equals(other: Self): bool
}

struct UserId implements Equatable {
  value: int
  func equals(other: Self): bool {
    return self.value == other.value
  }
}

val a = UserId { value: 1 }
val b = UserId { value: 1 }
val eq = a.equals(b)  // true
```

#### 1.3 Múltiplos Protocols
```andromeda
protocol Printable { func print(): void }
protocol Serializable { func serialize(): string }

struct User implements Printable, Serializable {
  name: string
  func print(): void { print(self.name) }
  func serialize(): string { return self.name }
}
```

#### 2.1 Protocol Genérico
```andromeda
protocol Container<T> {
  func get(): T
  func set(value: T): void
}

struct Box<T> implements Container<T> {
  mut value: T
  func get(): T { return self.value }
  func set(value: T): void { self.value = value }
}

val box = Box<int> { value: 42 }
val v: int = box.get()  // 42
```

#### 2.2 Nested Generics
```andromeda
protocol Collection<T> {
  func add(item: T): void
  func get(index: int): T
}

struct List<T> implements Collection<T> {
  mut items: T[] = []
  func add(item: T): void { self.items = [...self.items, item] }
  func get(index: int): T { return self.items[index] }
}
```

#### 3.1 Protocol como Tipo (Upcast)
```andromeda
protocol Printable { func print(): void }

struct User implements Printable {
  name: string
  func print(): void { print(self.name) }
}

val p: Printable = User { name: "Alice" }  // upcast implícito
p.print()

func printAll(items: Printable[]) {
  for item in items { item.print() }
}
printAll([User { name: "A" }, User { name: "B" }])
```

#### 3.2 Protocol Genérico como Tipo
```andromeda
protocol Container<T> { func get(): T }

struct Box<T> implements Container<T> { ... }

val c: Container<int> = Box<int> { value: 10 }
val x: int = c.get()  // 10
```

#### 4.1 Error: Missing Method
```andromeda
protocol Printable { func print(): void; func debug(): void }

struct User implements Printable {
  name: string
  func print(): void { print(self.name) }
  // ERROR: missing method 'debug()' for protocol 'Printable'
}
```

#### 4.2 Error: Signature Mismatch
```andromeda
protocol Printable { func print(): void }

struct User implements Printable {
  name: string
  func print(msg: string): void { ... }
  // ERROR: method 'print' signature mismatch: expected (), got (string)
}
```

#### 4.3 Error: Protocol Not Found
```andromeda
struct User implements NonExistent {
  // ERROR: protocol 'NonExistent' not found
}
```

#### 4.4 Error: Duplicate Method in Protocol
```andromeda
protocol Printable {
  func print(): void
  func print(): string  // ERROR: duplicate method 'print'
}
```

#### 5.1 Struct Genérico implementa Protocol Genérico
```andromeda
protocol Comparable<T> {
  func compare(other: T): int
}

struct Point implements Comparable<Point> {
  x: float; y: float
  func compare(other: Point): int { ... }
}
```

---

### Ordem de Implementação Recomendada

**Passo 1 — Parser Protocol Base** (1.1-1.7)
- Adicionar `implements` no `parseStructStatement`
- Parser `protocol` já existe, validar apenas assinaturas

**Passo 2 — Semantic Protocol Registration** (1.5-1.6)
- Registrar protocol no env como `kind: "protocol"`
- Validar duplicatas

**Passo 3 — Protocol Methods Semantic** (2.1-2.4)
- Validar que métodos não têm corpo
- Registrar métodos no symbol do protocol
- Implementar `Self` type resolution

**Passo 4 — Struct Implements Parser** (3.1)
- Parse `implements ProtocolName` após nome do struct
- Suportar lista: `implements A, B, C`

**Passo 5 — Conformance Checking** (3.2-3.4)
- Em `checkStructStmt`, verificar cada protocol
- Checar existência do protocol
- Validar todos métodos implementados com assinaturas compatíveis

**Passo 6 — Protocol as Type** (4.1-4.4)
- Permitir protocol em type annotations
- Upcast implícito: struct → protocol
- Protocol genérico com type args

**Passo 7 — Protocol Generics** (5.1-5.6)
- Type params no protocol
- Substituição em conformance
- Error cases

---

### Estrutura AST (já existe em `ast.ts`)

```typescript
// ProtocolStmt (linha 522)
export interface ProtocolStmt {
  kind: "ProtocolStmt"
  name: Token
  typeParameters?: TypeParameterNode[]
  methods: ProtocolMethod[]
}

export interface ProtocolMethod {
  name: Token
  params: FunctionStmtParam[]
  returnType?: TypeNode
}

// StructStmt tem campo protocols (linha 473)
protocols?: Token[]          // implements Printable, Comparable
```

---

### Symbol Kind
Adicionar em `semantic/types.ts`:
```typescript
export type SymbolKind = 
  | "variable" | "function" | "type" | "struct" 
  | "enum" | "protocol" | "parameter" | "typeParam" | "builtin";
```

Protocol symbol:
```typescript
{
  name: "Printable",
  type: ProtocolTypeNode,  // ou NamedTypeNode
  kind: "protocol",
  methods: ProtocolMethod[],
  typeParameters: TypeParameterNode[],
  initialized: true
}
```

---

### Type Checker Helpers Necessários

```typescript
// Em TypeChecker.ts

// 1. Verificar se um tipo implementa um protocol
private implementsProtocol(structType: TypeNode, protocolName: string): boolean

// 2. Validar conformance de um struct contra protocol
private checkProtocolConformance(structName: string, protocolSymbol: Symbol): void

// 3. Resolver Self type
private resolveSelfType(protocolSymbol: Symbol): TypeNode

// 4. Verificar assinatura de método
private checkMethodSignature(
  implMethod: StructMethod, 
  protocolMethod: ProtocolMethod
): boolean

// 5. Substituir type params em protocol genérico
private substituteProtocolTypeParams(
  protocolSymbol: Symbol, 
  typeArgs: TypeNode[]
): Symbol
```

---

###[ATE AQUI FEITO]  (marcar conforme implementação avança)

---

    ---FUTURE---
    - Protocol inheritance: `protocol A extends B`
    - Multiple inheritance com diamond resolution
    - Associated types: `protocol Iterator { type Item; func next(): Item? }`
    - Existential types: `any Printable`, `some Printable`
    - Protocol composition: `typealias PrintableCloneable = Printable & Cloneable`
    - Where clauses: `func foo<T: Printable>(x: T)`
    - Default implementations: `protocol Printable { func print(): void = print("default") }`
    - Retroactive conformance: `extend Printable for User { ... }`
    - Conditional conformance: `Array<T>: Equatable where T: Equatable`
    ---