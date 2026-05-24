# Variância em Type Systems

Variância responde uma pergunta simples: **se `Dog` é subtipo de `Animal`, o que acontece com `Box<Dog>` em relação a `Box<Animal>`?**

A resposta depende do que `Box` faz com `T`.

---

## Os três casos

### Covariância — "read only"

Se você só **lê** `T`, a direção de subtipagem se preserva:

```
Dog <: Animal  →  ReadBox<Dog> <: ReadBox<Animal>
```

Faz sentido: se algo te dá um `Dog`, você pode tratar como `Animal`. Sem problema — você nunca vai receber algo inesperado.

```andromeda
// Seguro: só lê
val dogs: ReadBox<Dog> = ...
val animals: ReadBox<Animal> = dogs  // ✅ covariante
val a: Animal = animals.get()        // sempre um Dog, que é Animal
```

### Contravariância — "write only"

Se você só **escreve** `T`, a direção **inverte**:

```
Dog <: Animal  →  WriteBox<Animal> <: WriteBox<Dog>
```

Parece contra-intuitivo, mas faz sentido: um `Sink<Animal>` aceita qualquer animal. Se você precisa de algo que aceita `Dog`, um `Sink<Animal>` serve — ele aceita *mais* coisas, incluindo `Dog`.

```andromeda
// Seguro: só escreve
val animalSink: Sink<Animal> = ...
val dogSink: Sink<Dog> = animalSink  // ✅ contravariante
dogSink.put(myDog)                   // animalSink recebe Dog → ok
```

### Invariância — "lê e escreve"

Se você **lê e escreve** `T`, não há direção segura. Precisa ser exato:

```
Array<Dog>  ≠  Array<Animal>  (em nenhuma direção)
```

```andromeda
val dogs: Array<Dog> = [rex, fido]
val animals: Array<Animal> = dogs   // ❌ PERIGOSO

animals[0] = Cat("whiskers")        // escreve Cat no array
val d: Dog = dogs[0]                // lê Cat como Dog → 💥
```

Esse é exatamente o bug clássico documentado com `Box<any>`.

---

## Por que `any` como top+bottom é perigoso

O problema do checker hoje:

```typescript
// Linhas 787-788
if (actual === "any") return true   // any encaixa em qualquer expected
if (expected === "any") return true  // qualquer actual encaixa em any
```

A segunda linha faz `any` ser **bottom type** também — significa que `Array<int>` é compatível com `Array<any>` porque `int <: any`. Aí o furo abre.

`any` deveria ser só **top**: você aceita `any` onde esperava algo específico, mas não o contrário.

```typescript
// Correto
if (expected === "any") return true   // ✅ top: qualquer coisa serve pra any
// REMOVER:
// if (actual === "any") return true  // ❌ isso faz any ser bottom também
```

---

## A regra das funções

Funções têm variância **mista** por natureza:

```
(Animal) => Dog
```

- No **parâmetro** (posição de entrada): contravariante
- No **retorno** (posição de saída): covariante

```
(Animal) => Dog  <:  (Dog) => Animal ?
```

Verifica:
- Parâmetro: `Dog <: Animal`? Sim. Contravariante: `Animal <: Dog`? ✅
- Retorno: `Dog <: Animal`? ✅

```andromeda
val fn: (Dog) => Animal = (a: Animal): Dog => rex
//       ^^^contrav.         ^^^mais geral    ^^^mais específico
```

Se o parâmetro fosse covariante, o chamador poderia passar um `Cat` onde a função esperava `Dog` — crash.

---

## Mapa mental rápido

```
posição de OUTPUT → covariante  (preserva direção)
posição de INPUT  → contravariante (inverte direção)
input + output    → invariante  (exige igualdade)
```

Array mutável tem ambas as posições (`arr[0]` lê, `arr[0] = x` escreve), então é **invariante** — o caso mais restritivo.

---

## O que mudar no checker

Resumindo em ordem de prioridade:

**1. Remover `any` como bottom** — tira a linha que faz `actual === any → true`. Mantém só `expected === any → true`.

**2. `Array<T>` invariante** — na comparação de `GenericType`, se o nome for `Array`, exige igualdade exata nos args, não subtipagem.

**3. Function params contravariantes** — ao checar `(A) => R <: (B) => R`, inverte a comparação nos parâmetros: verifica `B <: A` (não `A <: B`).

**4. Futuramente: anotações `out`/`in`** — permite que o usuário declare variância explícita em aliases genéricos, como Swift e Kotlin fazem com `out`/`in`.

A ordem importa porque 1 fecha o furo imediato de segurança, enquanto 2 e 3 refinam a corretude do sistema, e 4 adiciona expressividade.
