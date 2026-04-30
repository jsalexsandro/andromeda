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
        9.1  suporte a tipagem (any, null, [int, string, float, bool], ou qualuqer_tipo -> o semantic verifica se é valido)
        9.2 Criar o ParserTypeAnotation (dependendo o contexto após ":" é um tipagem )
        9.3 Suporte a objetos types e arrays types { name: string, values: string[] } ou string[] int[][]
        9.4 Adicionar suporte a union types (string | null)
        9.5 adicionar supoerte a uninion multiples types string | null | bool
      
      (isso já está muito bom)

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
│   -> suporte a tipagem reaproveitar o ParserTypeAnotation, tanto para tipagem de parametos e funções
    funções sem nomeação que usam o nome da varivel
    const pow = func(x: int): int = { return x * x }
    
├── 20. ArgumentList            (a: int, b: string)
├── 21. FunctionStatement       func foo() {}
        Anotação func foo(): int {} [OK]
 
├── 22. ReturnStatement         return expr
└── 23. ArrowFunction           x => x  /  (x) => x + 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 5 — ESTRUTURAS DE DADOS
│
├── 24. ArrayLiteral            [1, 2, 3]
├── 25. ObjectLiteral           {a: 1, b: 2}
└── 26. SpreadExpression        ...expr
- o spread operator em uma função deve ser feito sempre no ultimo do parametros

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



FASE 6 — CONTROLE AVANÇADO
│
├── 
├── 28. BreakStatement          break
└── 29. ContinueStatement       continue
├── 27. ForStatement            for (val i = 0; ...)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE TYPEALIAS
 TypeAliasStatement
 typealias <keyword> = <annotation-type>
            ^^^^^^^     ^
            |           |> reutilizar o parser annotation
            |
            |> espera uma keyword

[ate aqui feito]

FASE 6.5 - CONTROLS TYPES
1. ProtocolStatement
    Func aceita em protocols

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


FASE 13:
  Desconstrutores
  default params