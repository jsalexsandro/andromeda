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