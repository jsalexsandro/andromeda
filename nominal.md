amanha testa cases mais complexos e implementar func 

Resultado:
- val s: "" = "" → ❌ "Literal types is not supported"
- val pi: 3.14 = 3.14 → ❌ "Literal types is not supported"
- val status: "active" = "active" → ❌ "Literal types is not supported"
- val code: 200 = 200 → ❌ "Literal types is not supported"
- val enabled: true = true → ❌ "Literal types is not supported"
- val disabled: false = false → ❌ "Literal types is not supported"
O parser agora rejeita literal types com erro específico, alinhado com o objetivo de simplicidade + segurança.
Tipos aceitos agora:
- ✅ Primitivos: int, float, string, bool, void, null, any, unknown
- ✅ Named: User, Product
- ✅ Generics: Array<int>, Map<string, int>
- ✅ Arrays: int[], string[][]
- ✅ Nullable: int?, User?
- ✅ Function: (int) => string
- ✅ Union: int | string
- ✅ Grouping: (int | string)
- ❌ Literal types: "active", 3.14, true (rejeitados)
- ❌ Inline objects: {name: string} (rejeitados)


NamedType pode ser
  typealias 
  type
  enum
  struct
  protocol
  
-- Cada case desse possui um comportamente diferente.
-- Na defnição do ast, o parser indetifica cada um deles.