FASE 6.5 — CONTROL TYPES
│
├── StructStatement
│
├── 1. Parser base do struct
│      1.1 Reconhecer keyword `struct`
│      1.2 Parser do nome do struct
│      1.3 Parser do corpo `{ ... }`
│      1.4 Criar AST StructStatement
│      1.5 Registrar struct na symbol table
│      1.6 Detectar structs duplicados
│      1.7 Permitir struct vazio
│
├── 2. Struct Fields
│      2.1 Parser de propriedades
│             mut name: string
│             mut age: int
│             pi: float = 3.14
│      detectar a keyword 'mut' ela informa que aquela proprieda é mutavel!
│      2.2 Reutilizar ParserTypeAnnotation (para anotações)
│      2.3 Permitir arrays nos campos
│      2.4 Permitir union types
│      2.5 Permitir nullable fields
│      2.6 Herdaremos todas as possibiliadades de anotação de ParserTypeAnnotation
│      2.7 Detectar campos duplicados
       2.8 propriedae com atribuição
       mut id: string = 'abcd1fg2h123'
       name: string = "Jonny"
│


# FEito até aqui!

### StructStmt
- [ ] Registrar `name` no escopo de tipos
- [ ] Validar o tipo de cada campo
- [ ] Verificar que todos os métodos dos protocols estão implementados
- [ ] Detectar campos duplicados
│      3.1 Resolver tipos dos campos
│      3.2 Verificar tipos inexistentes
│      3.3 Permitir self-reference indireta
│      3.4 Detectar circularidade inválida
│      3.5 Registrar struct como type symbol
- [ ] Verificar a keyword 'mut' ela informa que aquela propriedade é mutavel 

# Até aqui no semantic

- [ ] Suporte a `TypeParameterNode`
- [ ] Checar que `protocols` declarados existem no escopo

│
├── 4. Struct Literal
│      4.1 Parser de literal:
│
│             User {
│               name: "rui",
│               age: 18
│             }
│
│      4.2 Inferir tipo do literal
│      4.3 Validar campos obrigatórios
│      4.4 Detectar campos extras
│      4.5 Detectar tipos incompatíveis
│      4.6 Validar ordem semântica dos campos
│
├── 5. Property Access
│      5.1 Parser MemberExpression
│             user.name
│      5.2 Resolver tipo da propriedade
│      5.3 Detectar propriedade inexistente
│      5.4 Permitir chained access
│             user.address.street
       5.5 verificar se propriedade é 'mut' (mutável)
│      5.6 Nullable property access futuramente
│
├── 6. Struct Generic
│      6.1 Parser generic params
│
│             struct Box<T>
│
│      6.2 Registrar generic params
│      6.3 Resolver generic substitution
│      6.4 Permitir nested generics
│
│             Box<Array<string>>
│
│      6.5 Detectar GENERIC_ARG_COUNT
│      6.6 Detectar duplicate generic params
│
├── 7. Struct Methods
│      7.1 Parser methods dentro do struct
│
│             func greet(): string {}
│
│      7.2 Resolver `self`
│      7.3 Resolver tipos de retorno
│      7.4 Resolver generics nos methods
│      7.5 Detectar métodos duplicados
│
├── 8. Extension Methods
│      8.1 Parser `extend`
│
│             extend Array<T> {}
│
│      8.2 Resolver tipo extendido
│      8.3 Registrar métodos externos
│      8.4 Detectar conflitos
│      8.5 Permitir builtin extensions
│
├── 9. Builtin Struct Types
│      9.1 Registrar Array<T> builtin
│      9.2 Registrar String builtin
│      9.3 Registrar Function builtin
│      9.4 Resolver methods builtin
│
│             push
│             pop
│             get
│             clear
│
│      9.5 Implementar syntax sugar:
│
│             int[] -> Array<int>
│
├── 10. Struct Constructors
│      10.1 Constructor automático
│      10.2 Validar argumentos
│      10.3 Inferir generic params
│
│             Box { value: 10 }
│
│      10.4 Constructors custom futuramente
│
├── 11. Struct Equality
│      11.1 Definir igualdade estrutural
│      11.2 Comparação de fields
│      11.3 Nullable comparison
│
├── 12. Struct Mutability
│      12.1 Permitir fields mutáveis
│
│             var name: string
│
│      12.2 Impedir mutação em `val`
│      12.3 Semantic de assignment
│
├── 13. Struct Recursive Types
│      13.1 Permitir recursive structs válidos
│
│             struct Tree<T> {
│               value: T
│               children: Tree<T>[]
│             }
│
│      13.2 Detectar recursion infinita inválida
│
├── 14. Struct Runtime Layout
│      14.1 Definir representação interna
│      14.2 Heap allocation
│      14.3 Property offset
│      14.4 GC integration futuramente
│
├── 15. Diagnostics
│      15.1 UNKNOWN_PROPERTY
│      15.2 DUPLICATE_FIELD
│      15.3 TYPE_MISMATCH
│      15.4 INVALID_STRUCT_LITERAL
│      15.5 GENERIC_ARG_COUNT
│      15.6 UNKNOWN_STRUCT
│      15.7 CIRCULAR_STRUCT
│
└── 16. Future Features
       16.1 Interfaces / traits
       16.2 Protocol conformance
       16.3 Operator overloading
       16.4 Reflection
       16.5 Serialization
       16.6 Pattern matching
       16.7 Visibility modifiers
       16.8 Static methods
       16.9 Computed properties