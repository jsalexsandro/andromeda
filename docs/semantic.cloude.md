## Ordem completa do Semantic Analyzer

---

```
FASE 1 — INFRAESTRUTURA BASE
│       (sem isso nada funciona)
│
├── 1. Symbol
│       { name, type, kind, mutable, line, column }
│
├── 2. Scope
│       define(symbol)
│       lookup(name) → sobe nos escopos pai
│       lookupLocal(name) → só no escopo atual
│
├── 3. ScopeStack
│       enter() → push novo escopo
│       exit()  → pop escopo
│       current → escopo do topo
│
└── 4. SemanticError
        { message, line, column, snippet }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 2 — SISTEMA DE TIPOS BASE
│
├── 5. TypeKind enum
│       INT, FLOAT, STRING, BOOLEAN,
│       NULL, VOID, ANY, UNKNOWN
│
├── 6. Type interface
│       primitive  → TypeKind
│       array      → Type (element type)
│       function   → params[], returnType
│       class      → name, fields, methods
│       union      → Type[]
│
└── 7. TypeChecker base
        isSameType(a, b): boolean
        isAssignableTo(from, to): boolean

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 3 — LITERAIS E EXPRESSÕES SIMPLES
│
├── 8.  Literal → inferir tipo
│       123      → INT
│       "hello"  → STRING
│       true     → BOOLEAN
│       null     → NULL
│
├── 9.  Identifier → lookup no escopo
│       não existe     → erro "variável não declarada"
│       existe         → retorna type do symbol
│
├── 10. PrefixExpression
│       !expr   → expr deve ser BOOLEAN → retorna BOOLEAN
│       -expr   → expr deve ser INT/FLOAT → retorna mesmo tipo
│       +expr   → idem
│
└── 11. BinaryExpression
        + - * /  → checar tipos compatíveis → retornar tipo
        ==  !=   → qualquer tipo → retorna BOOLEAN
        < > <= >= → INT/FLOAT → retorna BOOLEAN
        &&  ||   → BOOLEAN → retorna BOOLEAN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 4 — DECLARATIONS
│
├── 12. VariableDeclaration
│       val  → mutable: false
│       const → mutable: false (alias)
│       checar: nome já existe no escopo atual → erro
│       checar: tipo anotado bate com valor → erro
│       registrar no escopo atual
│
└── 13. Assignment
        checar: variável existe → erro se não
        checar: variável é val/const → erro "imutável"
        checar: tipo do valor bate com tipo da variável

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 5 — CONTROLE DE FLUXO
│
├── 14. BlockStatement
│       enter() escopo novo
│       analisar cada statement
│       exit() escopo
│
├── 15. IfStatement
│       checar: condição é BOOLEAN → erro se não
│       analisar then block
│       analisar else block se existir
│
├── 16. WhileStatement
│       checar: condição é BOOLEAN
│       marcar: dentro de loop (flag)
│       analisar body
│       desmarcar flag
│
├── 17. ForStatement
│       enter() escopo (val i pertence ao for)
│       checar: init é VarDecl válida
│       checar: condition é BOOLEAN
│       checar: update é expressão válida
│       analisar body com flag de loop
│       exit() escopo
│
├── 18. BreakStatement
│       checar: flag de loop ativo → erro se fora de loop
│
└── 19. ContinueStatement
        idem break

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 6 — FUNÇÕES
│
├── 20. FunctionStatement
│       registrar nome no escopo atual antes de analisar body
│         (permite recursão)
│       enter() escopo da função
│       registrar cada param como symbol
│       marcar: returnType esperado (flag)
│       analisar body
│       checar: todos os caminhos retornam valor (se não void)
│       exit() escopo
│
├── 21. ReturnStatement
│       checar: está dentro de função → erro se não
│       checar: tipo do valor bate com returnType esperado
│       se sem valor → checar se função é void
│
├── 22. CallExpression
│       resolver: callee existe e é callable
│       checar: número de argumentos bate com params
│       checar: tipo de cada argumento bate com param
│       retornar: returnType da função
│
└── 23. ArrowFunction
        idem FunctionStatement mas é expressão
        inferir returnType se não anotado (pelo corpo)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 7 — EXPRESSÕES COMPOSTAS
│
├── 24. MemberExpression
│       checar: objeto existe e tem o campo
│       retornar: tipo do campo
│
├── 25. IndexExpression
│       checar: objeto é array → erro se não
│       checar: índice é INT → erro se não
│       retornar: tipo do elemento do array
│
├── 26. TernaryExpression
│       checar: condição é BOOLEAN
│       checar: then e else têm tipo compatível
│       retornar: tipo unificado dos dois lados
│
└── 27. NullishCoalescing
        checar: lado esquerdo é nullable
        retornar: tipo sem null do lado esquerdo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 8 — ESTRUTURAS DE DADOS
│
├── 28. ArrayLiteral
│       checar: todos os elementos têm tipo compatível
│       retornar: tipo[] do elemento
│
├── 29. ObjectLiteral
│       inferir tipo de cada campo
│       retornar: tipo estrutural { campo: tipo, ... }
│
└── 30. SpreadExpression
        checar: argumento é array (em array/call)
        checar: argumento é object (em object)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 9 — CLASSES
│
├── 31. ClassStatement (primeira passagem)
│       registrar nome da classe no escopo global
│         (permite referências circulares entre classes)
│
├── 32. ClassStatement (segunda passagem)
│       checar: extends → classe pai existe
│       registrar campos no tipo da classe
│       registrar métodos no tipo da classe
│
├── 33. Constructor
│       checar: só um constructor por classe
│       checar: se extends → super() deve ser chamado
│       checar: super() é a primeira chamada
│       registrar params com visibilidade como campos
│
├── 34. ThisExpression
│       checar: está dentro de classe → erro se não
│       retornar: tipo da classe atual
│
├── 35. SuperExpression
│       checar: está dentro de classe com extends
│       checar: método existe na classe pai
│       retornar: tipo do método da classe pai
│
├── 36. NewExpression
│       checar: classe existe
│       checar: argumentos batem com constructor
│       retornar: tipo da classe
│
└── 37. Visibilidade (public/private/protected)
        checar: acesso a private fora da classe → erro
        checar: acesso a protected fora da hierarquia → erro

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 10 — MÓDULOS
│
├── 38. ImportStatement
│       checar: módulo existe (se resolver disponível)
│       registrar símbolos importados no escopo global
│       checar: alias não conflita com nome existente
│
└── 39. ExportStatement
        checar: símbolo exportado existe no escopo
        marcar símbolo como exported: true
        checar: não exportar duas vezes o mesmo nome

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 11 — ASYNC
│
├── 40. AsyncFunction
│       marcar returnType como Promise<T>
│       entrar em contexto async
│
└── 41. AwaitExpression
        checar: está dentro de função async → erro se não
        checar: expressão é Promise<T>
        retornar: T (desembrulha o Promise)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 12 — ERROS
│
├── 42. TryCatchStatement
│       analisar try block
│       registrar param do catch no escopo do catch
│         (e: Error → symbol local ao catch)
│       analisar cada catch block
│       analisar finally se existir
│
└── 43. ThrowStatement
        checar: está dentro de try ou função
        checar: valor é throwable (any por agora)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 13 — TEMPLATE LITERAL
│
└── 44. TemplateLiteral
        analisar cada expressão interpolada
        checar: expressões são válidas
        retornar: STRING sempre

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 14 — ICEX
│
├── 45. IcexElement
│       checar: tag é conhecida ou começa maiúscula (componente)
│       analisar atributos
│       analisar children
│       retornar: tipo IcexElement
│
├── 46. IcexAttribute
│       checar: atributo existe na tag (se tag nativa)
│       checar: tipo do valor bate com tipo esperado do atributo
│
└── 47. IcexExpression (children)
        analisar expressão normalmente
        checar: tipo é renderizável (string, number, IcexElement)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 15 — ANÁLISES GLOBAIS
│       (rodam sobre a AST inteira no final)
│
├── 48. Variáveis declaradas e nunca usadas → warning
├── 49. Imports declarados e nunca usados   → warning
├── 50. Funções que nunca retornam valor    → erro
└── 51. Código após return (unreachable)    → warning
```

---

## A regra de ouro do semântico

Diferente do parser, o semântico precisa de **duas passagens** em alguns casos:

```
Passagem 1 → registrar todos os nomes (funções, classes)
Passagem 2 → analisar os corpos

// sem isso isso quebra:
func a() { b() }   ← b ainda não foi visto
func b() { a() }
```

Começa pela Fase 1 — sem `Scope` e `Symbol` funcionando, nada do resto anda.