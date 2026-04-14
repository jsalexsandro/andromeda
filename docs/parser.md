── 1. Literais
│       number, string, boolean, null
│
├── 2. Identifier
│       x, nome, variavel
│
├── 3. GroupedExpression
│       (expr)
│
├── 4. PrefixExpression
│       -x  +x  !x
│
├── 5. BinaryExpression
│       +  -  *  /  %
├── 6. Comparison
│       ==  !=  <  >  <=  >=
├── 7. LogicalExpression
│       &&  ||
│
└── 8. Precedence Table + Pratt Parser
        montar o loop de precedência

FASE 2 — STATEMENTS SIMPLES
│
├── 9.  VariableDeclaration     val x = expr
├── 10. BlockStatement          { ... }
├── 11. IfStatement             if/else
├── 12. WhileStatement          while
└── 13. ExpressionStatement     expr como statement
FASE 3 — EXPRESSÕES COMPOSTAS
│       (precisam de expr e statement prontos)
│
├── 14. Assignment              x = 10
|       Atribuição composta: (x += 1, x -= 1, *=, /= , %=)
        Atibuição ++ --
        Concantenação de strings "" + "" | var_str + var_2_str
        var_str += ""
        
        
├── 15. CallExpression          fn(a, b) 

├── 16. MemberExpression        obj.prop (falta o semantic)   - Requer OBJECTS
├── 17. IndexExpression         arr[0]  (falta o semantic) - Requer ARRAYS
├── 18. TernaryExpression       a ? b : c
└── 19. NullishCoalescing       a ?? b

FASE 4 — FUNÇÕES
│
├── 20. ArgumentList            (a: int, b: string)
├── 21. FunctionStatement       func foo() {}
├── 22. ReturnStatement         return expr
└── 23. ArrowFunction           x => x  /  (x) => x + 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 5 — ESTRUTURAS DE DADOS
│
├── 24. ArrayLiteral            [1, 2, 3]
├── 25. ObjectLiteral           {a: 1, b: 2}
└── 26. SpreadExpression        ...expr

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ate aqui feito]

FASE 6 — CONTROLE AVANÇADO
│
├── 27. ForStatement            for (val i = 0; ...)
├── 28. BreakStatement          break
└── 29. ContinueStatement       continue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 7 — CLASSES
│
├── 30. ClassStatement          class Foo {}
├── 31. ThisExpression          this.x
├── 32. SuperExpression         super()
└── 33. NewExpression           new Foo()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 8 — MÓDULOS
│
├── 34. ImportStatement         import { x } from mod
└── 35. ExportStatement         export { x }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 9 — ASYNC
│
├── 36. AsyncFunction           async func
├── 37. AsyncArrow              async x => x
└── 38. AwaitExpression         await expr

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 10 — ERROS
│
├── 39. TryCatchFinally         try {} catch {}
└── 40. ThrowStatement          throw expr

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 11 — AÇÚCAR SINTÁTICO
│
├── 41. TemplateLiteral         $`hello {name}`
└── 42. NullishCoalescing       (já na fase 3, refinar)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 12 — ICEX (por último)
│       (depende de tudo acima)
│
├── 43. Elemento básico         <div/>
├── 44. Com atributos           <div id="x">
├── 45. Com expressões          <div id={x}>
├── 46. Children texto          <div>Hello</div>
├── 47. Children expressão      <div>{name}</div>
├── 48. Children aninhado       <div><span/></div>
└── 49. Object em atributo      <div style={{color:"red"}}>
