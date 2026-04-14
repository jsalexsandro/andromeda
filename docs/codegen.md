FASE 1 — INFRAESTRUTURA
│
├── 1. CodeWriter
│       write(str)
│       writeLine(str)
│       indent() / dedent()
│       getOutput(): string
│
├── 2. CodegenContext
│       targetModule: "esm" | "cjs"
│       sourceMap: boolean
│       tempVarCounter → gera nomes únicos _t0, _t1...
│
└── 3. Codegen base
        visit(node) → dispatcher
        visitEach(nodes[])

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 2 — LITERAIS E EXPRESSÕES BASE
│
├── 4.  NumberLiteral      123        → "123"
├── 5.  StringLiteral      "hello"    → '"hello"'
├── 6.  BooleanLiteral     true       → "true"
├── 7.  NullLiteral        null       → "null"
├── 8.  Identifier         x          → "x"
├── 9.  PrefixExpression   -x  !x     → "-x"  "!x"
└── 10. BinaryExpression   a + b      → "a + b"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 3 — STATEMENTS SIMPLES
│
├── 11. Program             → emite cada statement
├── 12. ExpressionStatement → "expr;\n"
├── 13. BlockStatement      → "{\n" indent stmts dedent "}"
├── 14. VariableDeclaration
│         val  → "let"
│         const → "const"
│         val x = 10  → "let x = 10;"
          var -> "var"
│
└── 15. Assignment          x = 10  → "x = 10;"
        Atibuição ++ --
        Concantenação de strings "" + "" | var_str + var_2_str
        var_str += ""
        

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 4 — CONTROLE DE FLUXO
│
├── 16. IfStatement
│         sem else  → "if (cond) { ... }"
│         com else  → "if (cond) { ... } else { ... }"
│         else if   → "else if (cond) { ... }"
│
├── 17. WhileStatement     → "while (cond) { ... }"
├── 18. ForStatement       → "for (let i = 0; ...) { ... }"
├── 19. BreakStatement     → "break;"
└── 20. ContinueStatement  → "continue;"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


FASE 5 — EXPRESSÕES COMPOSTAS
│
├── 21. GroupedExpression   (a + b)    → "(a + b)"

├── 22. MemberExpression    obj.prop   → "obj.prop"
├── 23. IndexExpression     arr[0]     → "arr[0]"
├── 24. CallExpression      fn(a, b)   → "fn(a, b)"
├── 25. TernaryExpression   a ? b : c  → "a ? b : c"
└── 26. NullishCoalescing   a ?? b     → "a ?? b"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 6 — FUNÇÕES
│
├── 27. FunctionStatement
│         func foo(a: int): int { }
│         → "function foo(a) { ... }"
│         tipos somem, JS não tem
│
├── 28. ReturnStatement    → "return expr;"
│
└── 29. ArrowFunction
          x => x * 2         → "(x) => x * 2"
          (x: int) => x      → "(x) => x"
          x => { return x }  → "(x) => { return x; }"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// coden so funciona ate aqui

FASE 7 — ESTRUTURAS DE DADOS
│
├── 30. ArrayLiteral
│         [1, 2, 3]     → "[1, 2, 3]"
│
├── 31. ObjectLiteral
│         {a: 1, b: 2}  → "({a: 1, b: 2})"
│         parênteses evitam ambiguidade com BlockStatement
│
└── 32. SpreadExpression
          ...arr         → "...arr"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


FASE 8 — BUILTINS
│
├── 33. Mapeamento de builtins Ice → JS
│
│     Ice Lang          JavaScript
│     ─────────────     ──────────────────
│     print(x)      →   console.log(x)
│     printLn(x)    →   console.log(x)
│     input(x)      →   prompt(x)         ← browser
│     toInt(x)      →   parseInt(x)
│     toFloat(x)    →   parseFloat(x)
│     toString(x)   →   String(x)
│     toBool(x)     →   Boolean(x)
│     math.abs      →   Math.abs
│     math.floor    →   Math.floor
│     math.ceil     →   Math.ceil
│     math.round    →   Math.round
│     math.min      →   Math.min
│     math.max      →   Math.max
│     math.pow      →   Math.pow
│     math.sqrt     →   Math.sqrt
│     math.random   →   Math.random
│
└── 34. BuiltinTransformer
          no visitCall, antes de emitir:
          if (callee é builtin) → emite o JS equivalente
          else → emite normalmente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 9 — CLASSES
│
├── 35. ClassStatement
│         class User extends Person { }
│         → "class User extends Person { }"
│         JS tem class nativo, é 1:1
│
├── 36. Constructor
│         constructor(public name: string)
│         → constructor(name) { this.name = name; }
│         param visibility vira assignment automático
│
├── 37. ClassProperty
│         name: string = "default"
│         → name = "default";   (field JS)
│         sem tipo, tipos somem
│
├── 38. ClassMethod
│         getName(): string { }
│         → getName() { }
│
├── 39. StaticProperty     → "static x = value;"
├── 40. StaticMethod       → "static method() { }"
├── 41. ThisExpression     → "this"
├── 42. SuperExpression    → "super"
└── 43. NewExpression      → "new Foo(a, b)"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 10 — MÓDULOS
│
├── 44. ImportStatement
│         import { pow } from math
│         → 'import { pow } from "math.js";'
│
│         import math as m
│         → 'import * as m from "math.js";'
│
└── 45. ExportStatement
          export { foo, bar }
          → "export { foo, bar };"

          export const x = 1
          → "export const x = 1;"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 11 — ASYNC
│
├── 46. AsyncFunction
│         async func fetch() { }
│         → "async function fetch() { }"
│
├── 47. AsyncArrow
│         async x => x
│         → "async (x) => x"
│
└── 48. AwaitExpression
          await fetch()
          → "await fetch()"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 12 — ERROS
│
├── 49. TryCatchStatement
│         try { } catch (e: Error) { }
│         → "try { } catch (e) { }"
│         tipo do catch some
│
└── 50. ThrowStatement
          throw new Error("msg")
          → "throw new Error('msg');"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 13 — TEMPLATE LITERAL
│
└── 51. TemplateLiteral
          $`hello {name}`
          → `hello ${name}`
          troca $` por ` e { por ${ 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 14 — ICEX
│
├── 52. IcexElement → JSX direto (se target suporta)
│         <div id="app">Hello</div>
│         → '<div id="app">Hello</div>'
│
│         ou sem JSX:
│         → 'h("div", { id: "app" }, "Hello")'
│
├── 53. IcexAttribute   → prop normal ou prop={expr}
├── 54. IcexText        → string filho
└── 55. IcexExpression  → {expr} → ${expr} ou expr direto