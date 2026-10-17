import { TypeNode } from "../ast";
import type { PrimitiveTypes } from "../types";

export interface PrimitiveMethodDecl {
  name: string;
  params: { name: string; type: TypeNode }[];
  returnType: TypeNode;
  /**
   * Template de emissao em JavaScript.
   *   $self  = receiver (ex.: a variavel que teve o metodo chamado)
   *   $ARGS  = argumentos ja formatados, com a virgula inicial (o template
 *           traz os parenteses)
   * Metodos sem parametro nao usam $ARGS.
   * Propriedades ignoram o template: o nome ja e o do JavaScript.
   */
  js: string;
  /** Propriedade lida sem chamada: `s.length`, nao `s.length()`. */
  property?: true;
}

const primitive = (name: PrimitiveTypes): TypeNode => ({
  kind: "PrimitiveType",
  name,
});

const nullable = (name: PrimitiveTypes): TypeNode => ({
  kind: "NullableType",
  type: primitive(name),
});

const arrayOf = (name: PrimitiveTypes): TypeNode => ({
  kind: "ArrayType",
  elementType: primitive(name),
  dimensions: 1,
});

// ============================================================
// Metodos de int
//
// Criterio: so existe metodo quando nao ha operador para expressar
// a operacao. abs, isPositive, min, max e pow NAO entram aqui â€”
// `abs` volta em float, onde o operador unario tambem nao existe
// e a operacao e realmente comum.
// ============================================================

export const INT_METHODS: PrimitiveMethodDecl[] = [
  { name: "toString", params: [], returnType: primitive("string"), js: "AndromedaAPI.toString($self)" },
  { name: "toFloat", params: [], returnType: primitive("float"), js: "Number($self)" },
  { name: "isEven", params: [], returnType: primitive("bool"), js: "$self % 2 === 0" },
  { name: "isOdd", params: [], returnType: primitive("bool"), js: "$self % 2 !== 0" },
];

// ============================================================
// Metodos de string
//
// `length` e propriedade: no JavaScript ja e `.length`, entao nao
// passa pela machinery de template. `isEmpty` NAO entra â€” `s == ""`
// ja expressa a operacao. `replace` usa replaceAll por baixo: o
// `replace` nativo do JavaScript so troca a primeira ocorrencia.
// ============================================================

export const STRING_METHODS: PrimitiveMethodDecl[] = [
  { name: "length", params: [], returnType: primitive("int"), js: "$self.length", property: true },
  { name: "upper", params: [], returnType: primitive("string"), js: "$self.toUpperCase()" },
  { name: "lower", params: [], returnType: primitive("string"), js: "$self.toLowerCase()" },
  { name: "trim", params: [], returnType: primitive("string"), js: "$self.trim()" },
  { name: "isEmpty", params: [], returnType: primitive("bool"), js: "$self.length === 0" },
  {
    name: "contains",
    params: [{ name: "value", type: primitive("string") }],
    returnType: primitive("bool"),
    js: "$self.includes$ARGS",
  },
  {
    name: "indexOf",
    params: [{ name: "value", type: primitive("string") }],
    returnType: primitive("int"),
    js: "$self.indexOf$ARGS",
  },
  {
    name: "substring",
    params: [
      { name: "from", type: primitive("int") },
      { name: "to", type: primitive("int") },
    ],
    returnType: primitive("string"),
    js: "$self.substring$ARGS",
  },
  {
    name: "split",
    params: [{ name: "separator", type: primitive("string") }],
    returnType: arrayOf("string"),
    js: "$self.split$ARGS",
  },
  {
    name: "replace",
    params: [
      { name: "old", type: primitive("string") },
      { name: "new", type: primitive("string") },
    ],
    returnType: primitive("string"),
    js: "$self.replaceAll$ARGS",
  },
  { name: "toInt", params: [], returnType: nullable("int"), js: "AndromedaAPI.toInt($self)" },
  { name: "toFloat", params: [], returnType: nullable("float"), js: "AndromedaAPI.toFloat($self)" },
];

// ============================================================
// Metodos de float
//
// So conversao: float e um numero, nunca "nao e numero". `toInt`
// trunca (3.14 -> 3) porque e a unica conversao possivel de volta.
// sqrt/abs/floor/ceil/round NAO entram â€” a matematica de float fica
// com os operadores, e arredondamento e um tema a parte.
// ============================================================

export const FLOAT_METHODS: PrimitiveMethodDecl[] = [
  { name: "toString", params: [], returnType: primitive("string"), js: "AndromedaAPI.toString($self)" },
  { name: "toInt", params: [], returnType: primitive("int"), js: "Math.trunc($self)" },
];

// ============================================================
// Metodos de bool
//
// So a conversao. Predicados como `isTrue` nao entram: `x == true`
// ja expressa, e `bool` nao tem operador proprio nenhum.
// ============================================================

export const BOOL_METHODS: PrimitiveMethodDecl[] = [
  { name: "toString", params: [], returnType: primitive("string"), js: "AndromedaAPI.toString($self)" },
];

const METHODS_BY_TYPE: Partial<Record<PrimitiveTypes, PrimitiveMethodDecl[]>> = {
  int: INT_METHODS,
  float: FLOAT_METHODS,
  string: STRING_METHODS,
  bool: BOOL_METHODS,
};

/** Primitivos que representam valor â€” todos tem acesso a metodos. */
const VALUE_PRIMITIVES = new Set<PrimitiveTypes>(["int", "float", "string", "bool"]);

export function isValuePrimitive(typeName: string): boolean {
  return VALUE_PRIMITIVES.has(typeName as PrimitiveTypes);
}

export function getPrimitiveMethods(typeName: string): PrimitiveMethodDecl[] | null {
  return METHODS_BY_TYPE[typeName as PrimitiveTypes] ?? null;
}

export function findPrimitiveMethod(
  typeName: string,
  methodName: string
): PrimitiveMethodDecl | null {
  const methods = getPrimitiveMethods(typeName);
  if (!methods) return null;
  return methods.find((m) => m.name === methodName) ?? null;
}