# 10. Struct Constructors

---

## 10.1 Dois modos de construtor

Um struct opera em exatamente um dos dois modos, determinado pela presença ou ausência de `init`:

- **Auto-init** — nenhum `init` declarado. O compilador gera o construtor automaticamente a partir dos campos.
- **Custom init** — um `init` declarado. O construtor automático não existe; o desenvolvedor controla tudo.

Os dois modos são mutuamente exclusivos. Declarar `init` desativa o auto-init completamente.

```
struct User {          // auto-init
  mut name: string
  mut age:  int
}

struct Token {         // custom init
  mut value: string
  init(raw: string) {
    self.value = raw.trim()
  }
}
```

---

## 10.2 Auto-init — argumentos nomeados

No modo auto-init, a chamada construtora usa **somente argumentos nomeados**, independente de ordem.
Argumentos posicionais são sempre erro — não existe ordem canônica de campos para o compilador assumir.

```
const u = User(name: 'James', age: 90)   // ok
const u = User(age: 90, name: 'James')   // ok — ordem não importa
const u = User('James', 90)              // error: positional arguments not allowed in struct constructor
```

---

## 10.3 Auto-init — campos obrigatórios e opcionais

Um campo é **obrigatório** no construtor se não tiver valor default.
Um campo é **opcional** no construtor se tiver valor default — o compilador usa o default silenciosamente quando ausente.

```
struct Config {
  mut host:    string
  mut port:    int    = 8080   // opcional
  mut timeout: int    = 30     // opcional
}

const c = Config(host: 'localhost')              // ok — port=8080, timeout=30
const c = Config(host: 'localhost', port: 3000)  // ok — timeout=30
const c = Config(port: 3000)                     // error: missing argument 'host'
```

A verificação de campos ausentes acontece somente sobre os campos sem default.

---

## 10.4 Auto-init — validação de argumentos

O compilador valida os argumentos fornecidos nesta ordem, parando no primeiro erro por argumento:

**1. Duplicatas** — mesmo nome aparece mais de uma vez na chamada.

```
const u = User(name: 'James', name: 'Bond', age: 90)
// error: duplicate argument 'name' in call to 'User'
```

**2. Desconhecidos** — nome não corresponde a nenhum campo do struct.

```
const u = User(name: 'James', age: 90, xp: 100)
// error: unknown argument 'xp' in call to 'User'
```

**3. Ausentes** — campo obrigatório não foi fornecido.

```
const u = User(name: 'James')
// error: missing argument 'age' in call to 'User'
```

**4. Tipos** — valor fornecido não é assignable ao tipo do campo. Reutiliza o type-checker normal.

```
const u = User(name: 'James', age: 'noventa')
// error: cannot assign 'string' to field 'age' of type 'int'
```

---

## 10.5 Auto-init — inferência de generic params

Quando o struct é genérico e nenhuma anotação de tipo é fornecida, o compilador infere os type params a partir dos valores dos argumentos.

```
struct Box<T> {
  mut value: T
}

const b = Box(value: 10)      // infere Box<int>
const b = Box(value: 'hello') // infere Box<string>
const b = Box<float>(value: 10) // anotação explícita também é válida
```

O algoritmo de inferência ocorre **antes** da validação de tipos (10.4), pois os tipos concretos dos campos só existem após substituir os type params.

**Passos:**

1. Para cada argumento `field: expr`, obter o tipo de `expr`.
2. Localizar o campo no struct. Se o tipo do campo é um type param (`T`), registrar `T → tipo_inferido`.
3. Se dois argumentos mapeiam para o mesmo `T` com tipos incompatíveis → erro de conflito.
4. Se um `T` não receber nenhuma informação → exigir anotação explícita.

```
const b = Box(value: ???)
// error: cannot infer type parameter 'T' for 'Box' — provide an explicit annotation: Box<Type>(...)

struct Pair<A, B> {
  mut first:  A
  mut second: B
}

const p = Pair(first: 1, second: 'x')  // infere Pair<int, string>
```

---

## 10.6 Custom init — sintaxe e comportamento

No modo custom init, o construtor é uma função `init` declarada dentro do corpo do struct.
A chamada usa **argumentos posicionais** (como uma função normal) — não nomeados.

```
struct User {
  mut name: string
  init(n: string) {
    self.name = n
  }
}

const u = User('James')   // ok
const u = User(n: 'James') // error: named arguments not allowed in custom init call
```

O `init` pode ter qualquer assinatura. Múltiplos `init` (overloads) são permitidos futuramente — por ora, apenas um por struct.

---

## 10.7 Custom init — regra de inicialização de campos

Esta é a regra central do custom init, inspirada no modelo do Swift:

> Um campo sem valor default **deve ser atribuído no escopo raiz do `init`** — não dentro de `if`, `for`, ou qualquer outro bloco aninhado.

O compilador não faz análise de fluxo (definite assignment analysis) através de branches. A regra é estrutural e simples: a atribuição `self.campo = ...` precisa estar diretamente no corpo do `init`, como um statement de nível raiz.

**Escapa do erro de duas formas:**

- Declarar o campo com valor default: `mut x: int = 0`
- Atribuir `self.x = ...` no escopo raiz do `init`

```
struct Button {
  mut title: string
  mut x: int           // error: property 'x' has no default value
  mut y: int           //        and is not initialized at the root of 'init'

  init(title: string) {
    self.title = title
    // self.x e self.y nunca são atribuídos no escopo raiz
  }
}
```

**O erro é reportado na declaração do campo, não dentro do `init`.**

---

## 10.8 Custom init — atribuições condicionais não contam

Atribuições dentro de `if`, `else`, `for`, `while` ou qualquer bloco aninhado **não satisfazem** a regra do 10.7.
O compilador não analisa se ambos os ramos cobrem o campo — a atribuição deve ser incondicional.

```
struct Rect {
  mut width:  int
  mut height: int

  init(w: int, h: int) {
    if w > 0 {
      self.width = w    // não conta — está dentro de if
    }
    self.height = h     // ok — escopo raiz
  }
}
// error: property 'width' has no default value and is not initialized at the root of 'init'
```

**Correção esperada do desenvolvedor** — mover a atribuição para o escopo raiz:

```
init(w: int, h: int) {
  self.width = 0        // atribuição raiz — satisfaz a regra
  if w > 0 {
    self.width = w      // refinamento condicional — permitido
  }
  self.height = h
}
```

Ou declarar com default:

```
mut width: int = 0      // campo opcional no init
```

---

## 10.9 Implementação — ordem de passos

A ordem abaixo minimiza retrabalho, pois cada passo depende do anterior.

**Passo 1 — Parser**

Reconhecer `TypeName(...)` como *constructor call* quando `TypeName` resolve para um struct.
Diferenciar de function call na AST — o nó deve carregar se os argumentos são nomeados ou posicionais.

**Passo 2 — Resolver modo**

No type-checker, ao visitar o nó de constructor call:
- Verificar se o struct declara `init` → modo custom
- Caso contrário → modo auto-init

**Passo 3 — Auto-init: inferência de generics (10.5)**

Antes de qualquer validação de tipos, inferir os type params a partir dos argumentos.
Substituir `T → tipo_concreto` em todos os campos do struct para esta instância.

**Passo 4 — Auto-init: validação de argumentos (10.4)**

Com os tipos concretos disponíveis, executar os quatro checks na ordem: duplicatas → desconhecidos → ausentes → tipos.

**Passo 5 — Custom init: verificação de inicialização (10.7)**

Ao analisar a declaração do struct (não a call site), coletar os `self.campo = ...` que estão no **depth 0** do body do `init` (nenhum nó pai entre o statement e o bloco raiz).
Comparar com os campos sem default. O que sobrar → erro na linha de declaração do campo.

Este passo roda uma única vez por struct, na fase de análise de declarações, antes de processar qualquer call site.

---

## 10.10 Struct literals — campos opcionais com default

A regra de campos opcionais com `defaultValue` também se aplica a struct literals (`{}`), não apenas a construtores auto-init.

Um campo é **opcional** no literal se tiver valor default — o compilador usa o default silenciosamente quando ausente.
Um campo é **obrigatório** no literal se não tiver valor default.

```
struct Config {
  host:   string = "localhost"
  port:   int    = 8080
  secure: bool   = true
}

val c1 = Config { host: "server" }              // ok — port=8080, secure=true
val c2 = Config { host: "server", port: 3000 }  // ok — secure=true
val c3 = Config { port: 3000 }                  // error: missing required field 'host'
```

Isso elimina a inconsistência entre `Config(host: "server")` (auto-init constructor) e `Config { host: "server" }` (struct literal) — ambos aceitam a omissão de campos com default.

**Implementação:** em `checkStructLiteralExpr`, o loop que verifica campos faltantes (`seenKeys`) pula campos que possuem `f.defaultValue`.