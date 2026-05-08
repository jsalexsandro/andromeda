To tendo dificuldade com alguns aspectos da minha linguagem
É uma linguagem nominal e segura.

1. Caso que devo proibir:
// var example: (string | int)[] = ['A', 1]
- Devo proibir isso, pois isso ta estrutural e dinámico.
- Quando o programdor quiser isso, deverá usar enums

2. Conceituar o Generic para Tudo.
// var names: string[] = ['Jonny', 'James']
//            ^^^^^^^^ -> isso deve ser 'sugar' para isso Array<String>
// --- 
// transformar tudo em generics assim como o padrão das novas lingaugem
// 

3. Api bonitas
// 'string' é a keyword nativa para strings
// Entretando String, é a sua definição de API, primeira letra maiúscula.
// String == string, pro compilador (são a nesma coisa, o que muda, string é mais profundo)
// String é o alias de string

// extends String {  
//   func trnucar(){
    
//   }
// }

// string.truncar
// String.truncar