# API da Linguagem — Builtins

Builtins são o que a linguagem dá pronto: sem `func`, sem declaração, disponíveis
em qualquer escopo. Compõem a API pública e são implementadas pelo runtime
Andromeda.

**Implementado:** `print`, métodos de `int`, `float`, `string` e `bool`.

| Seção | Conteúdo |
|-------|----------|
| [print](#print) | escrita em stdout |
| [Contrato de formatação](#contrato-de-formatação) | como cada valor é impresso |
| [Stringable](#stringable) | struct controlando a própria formatação |
| [Métodos de primitivos](#métodos-de-primitivos) | `int`, `string`, `float`, `bool` |
| [Aliases globais](#aliases-globais) | `Integer`, `String`, `Boolean`, … |
| [Interconexão](#interconexão) | cadeias entre tipos |
| [Regras de operador](#regras-de-operador) | divisão inteira e concatenação |
| [O que não existe](#o-que-não-existe) | e por quê |
| [Proteção contra redefinição](#proteção-contra-redefinição) | builtins não podem ser sobrescritos |
| [AndromedaAPI](#andromedaapi) | o objeto global do runtime |
| [Implementação](#implementação) | onde cada coisa mora |

---

## print

```typescript
print(...values: any[]): void
```

Escreve os argumentos em **stdout**, separados por **um espaço**, sempre
seguidos de quebra de linha (`\n`).

```typescript
print("Andromeda")              // Andromeda
print(42)                       // 42
print(3.14)                     // 3.14
print(true)                     // true
print(null)                     // null
print()                         // (linha vazia)

print("multiplos", "args", 1)   // multiplos args 1

val nums: int[] = [1, 2, 3]
print(nums)                     // [1, 2, 3]
```

| Regra | Comportamento |
|-------|---------------|
| Newline | sempre, inclusive em `print()` |
| Separador | um espaço entre argumentos |
| Argumentos | qualquer valor (`any`) — nunca há `TYPE_MISMATCH` |
| Retorno | `void`, não pode ser usado como valor |
| Escopo | global, visível dentro de structs e funções |
| Sobrescrita | proibida — ver [Proteção](#proteção-contra-redefinição) |

`print` nunca lança exceção: mesmo com valor não imprimível, sempre produz saída.

Ser variádica dispensa concatenação na maioria dos casos:

```typescript
print("cidade:", city.name, "zip:", addr.zip)   // cidade: Recife zip: 52000
```

---

## Contrato de formatação

`print` usa o mesmo formatador para todos os argumentos. As regras valem para
argumentos de topo e para valores aninhados.

| Valor | Saída | Exemplo |
|-------|-------|---------|
| `null` | `null` | `print(null)` → `null` |
| `undefined` | `undefined` | `undefined` |
| `bool` | `true` / `false` | `print(true)` → `true` |
| `int` | `String(n)` | `print(42)` → `42` |
| `float` | `String(n)` | `print(3.14)` → `3.14` |
| `string` (topo) | o texto, sem aspas | `print("oi")` → `oi` |
| `string` (aninhada) | entre aspas | `print(["a"])` → `["a"]` |
| `int[]` | elementos separados por `, ` | `[1, 2, 3]` |
| array aninhado | recursivo | `[[1, 2], [3, 4]]` |
| struct | `Nome { campo: valor }` | `User { name: "Alice", age: 30 }` |
| struct com `toString` | resultado do método | `User(Alice)` |
| ciclo | `[Circular]` | `Node { next: [Circular] }` |
| profundidade > 6 | `[Depth]` | — |
| mais de 100 itens | `... +N more` | `[1, 2, ... +98 more]` |
| função | `[Function: nome]` | `[Function: main]` |

O nome do struct vem do construtor no JavaScript gerado — structs são classes,
então o nome é o próprio nome do tipo.

**Garantias:**

- **Nunca lança**: erro de formatação vira `[Unprintable: ...]` na saída.
- **Sem ANSI/cores**: saída segura em pipe, arquivo e CI.
- **Ciclos** protegidos por rastreamento de referências — `print` sempre termina.
- **Tamanho limitado**: 6 níveis de profundidade e 100 itens por coleção.

---

## Stringable

Structs controlam a própria formatação implementando `toString()`:

```typescript
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
print(u)                              // User(Alice)
print([u])                            // [User(Alice)]
```

O runtime chama `toString()` por *duck typing*: declarar `implements` é opcional
para funcionar, mas sem o protocol no arquivo não há checagem em compile time.
**`Stringable` ainda não é nativo** — é preciso declarar o protocol no arquivo.

> **Por que `toString()` e não `print()`?** Um protocol `func print(): void`
> obriga o struct a imprimir por conta própria e não serve para concatenação nem
> para interpolação. `toString(): string` é uma regra só para todos os usos.

O runtime ignora `Object.prototype.toString` — todo objeto JavaScript herda esse
método, e sem esse guard o formatador entraria em recursão infinita.

---

## Métodos de primitivos

Primitivos têm métodos, com receiver explícito ou inferido:

```typescript
val age: int = -10
age.toString()            // receiver com tipo anotado

val test = 1
test.isOdd()              // receiver inferido do literal
```

O receiver é **implícito**: não aparece na assinatura, e os argumentos começam no
primeiro parâmetro real.

Método inexistente gera `UNKNOWN_METHOD` com a lista do que existe:

```typescript
val x: int = age.abs()
// ERROR: type 'int' has no method 'abs' — available: toString, toFloat, isEven, isOdd
```

Usar um método como valor (`val f = age.isEven`) **não** é suportado: o JS gerado
fica `age.isEven` e o Bun acusa `is not a function`. Falha alto de propósito —
silenciar devolvendo valor seria pior.

### int

| Método | Retorno |
|--------|---------|
| `toString()` | `string` |
| `toFloat()` | `float` |
| `isEven()` | `bool` |
| `isOdd()` | `bool` |

```typescript
val age: int = -10
age.toString()        // "-10"
age.isEven()          // true  (-10 % 2 === 0)
age.toFloat()         // -10.0

val n: int = 7
n.isOdd()             // true
```

### string

| Entrada | Params | Retorno | Nota |
|---------|--------|---------|------|
| `length` | — | `int` | **propriedade** — `s.length`, não `s.length()` |
| `upper()` | — | `string` | |
| `lower()` | — | `string` | |
| `trim()` | — | `string` | |
| `isEmpty()` | — | `bool` | ver [nota](#isempty-e-a-exceção-à-regra) |
| `contains(value)` | `string` | `bool` | não existe operador `in` na linguagem |
| `indexOf(value)` | `string` | `int` | `-1` quando não encontra |
| `substring(from, to)` | `int, int` | `string` | `from` inclusivo, `to` exclusivo |
| `split(separator)` | `string` | `string[]` | |
| `replace(old, new)` | `string, string` | `string` | **troca todas** as ocorrências |
| `toInt()` | — | `int?` | `null` quando não é número |
| `toFloat()` | — | `float?` | `null` quando não é número |

```typescript
val nome: string = "  Ana Silva  "

nome.trim()                 // "Ana Silva"
nome.trim().upper()         // "ANA SILVA"
nome.trim().lower()         // "ana silva"
nome.trim().length          // 9 — propriedade, sem ()
nome.contains("Silva")      // true
nome.indexOf("Ana")         // 2
nome.trim().substring(0, 3) // "Ana"
"a,b,c".split(",")          // ["a", "b", "c"]
"banana".replace("an", "X") // "bXXa" — todas, não só a primeira
nome.trim().isEmpty()      // false
"".isEmpty()               // true
```

**`isEmpty` é a exceção à regra.** `s == ""` resolveria a operação, então pela
regra geral `isEmpty()` não deveria existir. Ele existe porque a forma com
operador quebra justamente na negação — `!` liga mais forte que `==`, então negar
a comparação exige parênteses:

```typescript
if (!(s == "")) { }      // tem que parentesar
if (!s.isEmpty()) { }    // lê direto
```

O que decide é a **forma sem operador**, não a operação: `isEven` também é
sintaxe pura para algo que `n % 2 == 0` expressa, e foi mantido pelo mesmo
motivo.

**`length` é propriedade.** No JavaScript já é `.length`, então o codegen não
precisa de nada: o typechecker devolve `int` e o acesso sai natural. Chamar
`s.length()` dá `INVALID_CALL`.

**`replace` troca todas as ocorrências.** O `replace` nativo do JavaScript só
troca a primeira — usar `replaceAll` por baixo com o nome `replace` segue
Kotlin/Python e evita a armadilha clássica.

**Conversão devolve `Optional`.** `toInt()` e `toFloat()` devolvem `int?` /
`float?` com `null` em falha, em vez de `NaN` com tipo `int` — a mesma mentira
que a divisão inteira corrigiu:

```typescript
val n: int? = "42".toInt()
if val v = n {
  print(v.isEven())   // v já é int — Optional desembrulhado
} else {
  print("não era número")
}

"".toInt()            // null, e não 0
"3.7".toInt()         // 3 — trunca, não arredonda
```

O runtime usa `Number.isFinite`, então `NaN` e `Infinity` também viram `null`.
A conversão aceita o que o JavaScript aceita: `"0x10".toInt()` dá `16` e
`"1e3".toInt()` dá `1000`.

### float

| Método | Retorno | Nota |
|--------|---------|------|
| `toString()` | `string` | mesmo formatador do `print` |
| `toInt()` | `int` | trunca: `3.14 → 3`, `2.99 → 2`, `-3.14 → -3` |

Só conversão. Um `float` **é** um número — nunca "não é número" — então,
diferente do `string.toInt()`, devolve `int` direto, sem `Optional`. O que pode
perder é a parte fracionária, e truncar é o comportamento certo.

```typescript
val pi: float = 3.14
pi.toString()             // "3.14"
pi.toInt()                // 3
pi.toInt().isEven()       // false — 3 é ímpar
2.toFloat().toString()    // "2"
```

### bool

| Método | Retorno | Nota |
|--------|---------|------|
| `toString()` | `string` | `"true"` / `"false"` |

Só a conversão, para que todo primitivo tenha `toString()`.

### any e unknown

Os dois são escape hatches, e se comportam diferente de propósito:

| | Member access | Quando |
|---|---|---|
| `any` | **passa** e devolve `any` | o tipo real só se sabe em runtime |
| `unknown` | **rejeitado** (`INVALID_MEMBER_ACCESS`) | exige estreitamento antes de operar |

```typescript
val x: any = 7
val a: any = x.toString()       // passa no checker
val b: any = x.qualquerCoisa()  // também passa — `any` não checa

val y: unknown = 7
val c: unknown = y.toString()   // ERROR: cannot access member on non-object type
```

> **`any` não conhece os nomes de método de Andromeda.** A reescrita
> `s.upper()` → `s.toUpperCase()` depende de o checker saber que o tipo é
> `string`. Com `any` não há template, então o nome é repassado ao JavaScript:
> `s.trim()` funciona, `s.upper()` dá `t.upper is not a function` em runtime.
> Use `any` para valores cujo tipo você não controla; use o tipo concreto quando
> quiser a API da linguagem.

`void`, `null` e `unknown` não têm métodos — não são valores, ou exigem
estreitamento.

---

## Interconexão

Os métodos devolvem primitivos, então as cadeias fluem entre os tipos:

```typescript
"  Ana  ".trim().lower().length.isEven()      // string → string → int → bool
42.toString().upper().length.isEven()         // int → string → string → int → bool
2.toFloat().toString().length.isEven()        // int → float → string → int → bool

const n = ""
print(n.length.isEven())                      // "" → 0 → 0 é par → true

val m: int? = "16".toInt()
if val v = m {
  print(v.toFloat())                          // string → int? → float
}
```

---

## Regras de operador

| Regra | Comportamento |
|-------|---------------|
| `int / int` | **divisão inteira**, truncada em direção a zero (`10 / 3 == 3`, `-10 / 3 == -3`) |
| `int % int` | resto, com sinal do dividendo (`-10 % 3 == -1`) |
| `int` por zero | **erro** — `DIVISION_BY_ZERO` em compilação se o divisor for literal, exceção em runtime se for variável |
| `float` em qualquer lado | divisão real (`10.0 / 3 == 3.333…`) |
| `float` por zero | segue IEEE-754: `Infinity`, `-Infinity`, `NaN`. **Não** é erro |
| `string + primitivo` | concatena (`"idade: " + 10`), e o simétrico (`10 + " anos"`) |
| `string + string` | concatena |

A divisão inteira existe porque o tipo `int` promete `int`; o runtime trunca para
cumprir a promessa. Misturar com `float` devolve `float`.

### Divisão por zero

`int` promete `int`, então não pode entregar `Infinity` nem `NaN` — seria a mesma
mentira que a divisão truncação corrigiu. Duas camadas:

```typescript
print(10 / 0)         // ERROR: [DIVISION_BY_ZERO] division by zero

val zero: int = 0
print(10 / zero)      // runtime: Error: division by zero
```

O compilador pega o caso que dá para provar (divisor literal `0`, mesmo entre
parênteses). Quando o divisor é uma variável, o valor não é conhecido em tempo de
compilação, e quem protege é `AndromedaAPI.divInt` / `AndromedaAPI.modInt`, que
lançam antes de devolver qualquer coisa.

**`float` por zero não é erro.** `Infinity` é a resposta padrão da aritmética de
ponto flutuante, e é o que Rust, JavaScript e Java fazem. Silenciar isso seria
inventar semântica que o tipo `float` não promete.

`string + struct` ainda é rejeitado — só entra struct que implementa `toString()`,
e isso depende do `Stringable` ser nativo.

---

## O que não existe

A regra que decide o que vira método:

> **Método só existe quando a forma com operador é ruim de escrever.**

`isEven` é `n % 2 == 0` reescrito. `isPositive` não existe porque `age > 0` já
está pronto. `isEmpty` existe em `string` — ver a
[exceção](#isempty-e-a-exceção-à-regra).

| Ausente | Por quê |
|---------|---------|
| `abs`, `isPositive`, `isZero`, `min`, `max` | já existe operador: `age > 0`, `age == 0`, `<`, `>` |
| `pow(exp)` | `2.pow(-1)` dá `0.5` em JS, mas o tipo prometeria `int` — a mesma mentira da divisão |
| `isPrime()` | exige loop no runtime e definição para `1` e negativos |
| `sqrt`, `floor`, `ceil`, `round` | matemática de `float` fica com os operadores por ora |
| `len()` | `length` é propriedade — `s.length`, `arr.length` |
| `charAt`, `startsWith`, `endsWith`, `repeat` | planejados |
| métodos de array | `T[]` ainda não tem API |

Planejados, fora do que já existe: `printErr`, variante de `print` sem `\n`
(nome em aberto), `toString` global, `readLine`, interpolação de string.

---

## Proteção contra redefinição

Builtins são protegidos: não podem ser sobrescritos pelo programa.

```typescript
func print(msg: string): void { }
// ERROR: [CANNOT_REDEFINE_BUILTIN] Cannot redefine built-in 'print'
```

Vale para `func`, `val`, `struct`, `protocol` e `typealias`. Assim `print`
significa sempre o mesmo em qualquer programa. O mesmo vale para
[`AndromedaAPI`](#andromedaapi), que pertence ao runtime.

---

## Implementação

| Peça | Arquivo | Papel |
|------|---------|-------|
| Declarações | `src/builtins/index.ts` | fonte única (nome, params, retorno, nome JS, aliases) |
| Métodos de primitivos | `src/builtins/methods.ts` | tabelas declarativas por primitivo |
| Registro semântico | `src/semantic/Environment.ts` | cria os símbolos no escopo global |
| Runtime | `src/transpiler/runtime/runtime.ts` | implementação canônica de `AndromedaAPI` |
| Emissão | `src/transpiler/Codegen.ts` | sempre prepende o runtime no JS gerado |
| Reescrita | `src/transpiler/ExprVisitor.ts` | `print(...)` → `AndromedaAPI.print(...)`, método → template JS |

O codegen não tem informação de tipo, então o type checker anota a AST: métodos
de primitivo recebem `jsTemplate` no nó `Member`, e divisão inteira recebe
`truncateDivision` no nó `Binary`. Quem decide é sempre o checker.

## Aliases globais

Todo primitivo tem um alias com nome capitalizado, disponível sem declarar nada:

| Alias | Tipo | Alias | Tipo |
|-------|------|-------|------|
| `Integer` | `int` | `Void` | `void` |
| `Float` | `float` | `Null` | `null` |
| `String` | `string` | `Any` | `any` |
| `Boolean` | `bool` | `Unknown` | `unknown` |

```typescript
val i: Integer = 42
val s: String = "Andromeda"
val b: Boolean = true

print(i.isEven())          // true — resolve para int
print(s.upper())           // "ANDROMEDA"

func escreve(m: String): Void {
  print(m)
}
```

São **transparentes**: `Integer` **é** `int`, intercambiável nos dois sentidos.

```typescript
val i: Integer = 42
val j: int = i              // ok
val k: Integer = 42         // ok
```

Não é preciso `typealias` — os aliases já estão no ambiente global, como
`Array<T>` e `Optional<T>`. `Any` e `Unknown` mantêm o comportamento descrito
em [any e unknown](#any-e-unknown).

**Erros citam o tipo resolvido.** Se o código usa `Integer`, a mensagem fala
`int`:

```typescript
val x: Integer = 42
x.sqrt()
// ERROR: type 'int' has no method 'sqrt' — available: toString, toFloat, isEven, isOdd
```

Os 8 nomes são **reservados** — `struct String`, `typealias Integer`,
`func Void()` e `val Any` dão `CANNOT_REDEFINE_BUILTIN`. É o preço de ocupar
nomes-blocked: esses identificadores não podem mais ser usados no código do
usuário.

---

## AndromedaAPI

Todo o runtime vive num único objeto global:

```javascript
const AndromedaAPI = (() => { /* ... */ return { toString, print, toInt, toFloat }; })();
```

| Membro | Uso |
|--------|-----|
| `AndromedaAPI.print(...)` | alvo da reescrita de `print(...)` |
| `AndromedaAPI.toString(v)` | o formatador único — usado por `print` e pelos métodos `toString()` |
| `AndromedaAPI.toInt(s)` | `string` → `int` ou `null` |
| `AndromedaAPI.toFloat(s)` | `string` → `float` ou `null` |
| `AndromedaAPI.divInt(a, b)` | divisão inteira truncada; lança se `b == 0` |
| `AndromedaAPI.modInt(a, b)` | resto inteiro; lança se `b == 0` |

Tudo o mais (`MAX_DEPTH`, `MAX_ITEMS`, `hasCustomToString`, `toNumber`) fica no
closure do IIFE — invisível de fora, e portanto incapaz de colidir com uma
variável do programa. Se fosse emitido no escopo global, um `val MAX_DEPTH = 1`
do usuário viraria `SyntaxError` de `const` duplicado.

O nome `AndromedaAPI` é **reservado**:

```typescript
val AndromedaAPI = 5
// ERROR: [CANNOT_REDEFINE_BUILTIN] Cannot redefine built-in 'AndromedaAPI'
```

É o mesmo mecanismo que protege `print`: `AndromedaAPI` é do runtime, não do
programa.

## Testes

| Arquivo | Cobertura |
|---------|-----------|
| `builtins/print-01.med` | 0/1/N argumentos, primitivos, null, arrays, nesting, struct |
| `builtins/print-stringable.med` | `Stringable`, struct aninhado, ciclo, array de structs |
| `builtins/print-error-redefine.med` | `CANNOT_REDEFINE_BUILTIN` |
| `builtins/reserved-namespace.med` | `CANNOT_REDEFINE_BUILTIN` em `AndromedaAPI` |
| `builtins/int-methods.med` | `int`, receiver inferido, encadeamento |
| `builtins/int-methods-error.med` | `UNKNOWN_METHOD` em `int` e em `bool` |
| `builtins/int-division.med` | truncamento, negativos, `%`, mistura com `float`, zero em float |
| `builtins/int-division-error.med` | `DIVISION_BY_ZERO` em divisor literal e em runtime |
| `builtins/string-concat.med` | `string + primitivo` nos dois sentidos |
| `builtins/string-methods.med` | trim, caixa, length, busca, substring, split, replace, `toInt`/`toFloat` |
| `builtins/string-methods-error.med` | `UNKNOWN_METHOD`, `TYPE_MISMATCH`, `ARGUMENT_COUNT_MISMATCH`, `INVALID_CALL` |
| `builtins/float-bool-methods.med` | conversão em `float` e `bool`, ida e volta `int ↔ float` |
| `builtins/primitive-chains.med` | cadeias entre primitivos |
| `builtins/any-escape.med` | `any` deixa member access passar e despacha em runtime |
| `builtins/any-unknown.med` | `any` aceita, `unknown` rejeita |
| `builtins/global-aliases.med` | os 8 aliases em anotação, receiver, função e interoperabilidade |
| `builtins/global-aliases-error.med` | `CANNOT_REDEFINE_BUILTIN` nos 8 nomes |

## Limitações conhecidas

| Limitação | Impacto |
|-----------|---------|
| `Stringable` não é nativo | é preciso declarar o protocol no arquivo |
| `string + struct` barrado | só entra struct com `toString()`, o que depende do `Stringable` nativo |
| Arrays sem API | `arr.length` e `arr.push` não existem |
| `float` e `bool` só convertem | sem `sqrt`, `abs`, `floor`, `ceil`, `round`, sem predicados |
| Sem `toString` global | para converter explicitamente, use o método do tipo |
| `any` perde os nomes de método | `any.upper()` não vira `toUpperCase()` — o dispatch é JS puro |
| Sem interpolação | não existe `"valor: ${x}"` |
| 8 nomes globais reservados | `Integer`, `Float`, `String`, `Boolean`, `Void`, `Null`, `Any`, `Unknown` não podem ser `struct`/`protocol`/`typealias`/`func`/`val` |
| Erro cita o tipo resolvido | código escrito com `Integer` recebe mensagem falando `int` |
| Erro de aridade em método reporta `Line 0, Col 0` | bug pré-existente do token de fallback em `checkCallExpr` |