// Runtime da linguagem Andromeda.
//
// A API publica vive no objeto global `AndromedaAPI`. Tudo o mais fica
// dentro do IIFE, entao nada interno colide com variaveis do usuario.
//
// Regras:
// - print nunca lanca excecao: sempre produz saida.
// - Sem ANSI/cores: a saida e segura em pipe, arquivo e CI.
// - Convencoes de formatacao unicas para print e para os metodos toString.

export const RUNTIME_JS = `// ── Andromeda Runtime ─────────────────────────────────────────────
const AndromedaAPI = (() => {
  const MAX_DEPTH = 6;
  const MAX_ITEMS = 100;

  // duck typing de Stringable: todo objeto JS herda Object.prototype.toString,
  // entao o guard abaixo e obrigatorio para nao formatar recursivamente.
  const hasCustomToString = (value) =>
    typeof value.toString === "function" &&
    value.toString !== Object.prototype.toString;

  const str = (value, seen, depth) => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";

    const type = typeof value;

    if (type === "string") return depth === 0 ? value : JSON.stringify(value);
    if (type === "number" || type === "boolean" || type === "bigint") return String(value);
    if (type === "symbol") return value.toString();
    if (type === "function") return "[Function: " + (value.name || "anonymous") + "]";

    if (seen.has(value)) return "[Circular]";
    if (depth >= MAX_DEPTH) return "[Depth]";

    seen.add(value);
    try {
      if (Array.isArray(value)) {
        const parts = [];
        const total = value.length;
        const shown = Math.min(total, MAX_ITEMS);
        for (let i = 0; i < shown; i++) parts.push(str(value[i], seen, depth + 1));
        if (total > shown) parts.push("... +" + (total - shown) + " more");
        return "[" + parts.join(", ") + "]";
      }

      if (hasCustomToString(value)) return value.toString();

      const keys = Object.keys(value);
      const total = keys.length;
      const shown = Math.min(total, MAX_ITEMS);
      const parts = [];
      for (let i = 0; i < shown; i++) {
        parts.push(keys[i] + ": " + str(value[keys[i]], seen, depth + 1));
      }
      if (total > shown) parts.push("... +" + (total - shown) + " more");

      const body = parts.length === 0 ? "{}" : "{ " + parts.join(", ") + " }";
      const name = value.constructor && value.constructor.name;
      return name && name !== "Object" ? name + " " + body : body;
    } finally {
      seen.delete(value);
    }
  };

  // Conversao de string para numero: null em vez de NaN, porque a linguagem
  // promete int/float e NaN seria a mesma mentira da divisao inteira.
  const toNumber = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  };

  return {
    // formatador unico: print e os metodos toString usam este
    toString: str,

    print: (...values) => {
      const parts = [];
      try {
        for (let i = 0; i < values.length; i++) {
          parts.push(str(values[i], new Set(), 0));
        }
      } catch (error) {
        parts.push("[Unprintable: " + (error && error.message ? error.message : String(error)) + "]");
      }
      console.log(parts.join(" "));
    },

    toInt: (value) => {
      const n = toNumber(value);
      return n === null ? null : Math.trunc(n);
    },

    toFloat: (value) => toNumber(value),

    // Divisao e resto inteiros. O tipo int promete int, entao o runtime
    // trunca e recusa divisor zero: Infinity ou NaN com tipo int seria a
    // mesma mentira que a divisao ja corrigiu. Divisao em float segue
    // IEEE-754 de proposito (Infinity e a resposta padrao do ponto
    // flutuante) e nao passa por aqui.
    divInt: (a, b) => {
      if (b === 0) throw new Error("division by zero");
      return Math.trunc(a / b);
    },

    modInt: (a, b) => {
      if (b === 0) throw new Error("modulo by zero");
      return a % b;
    },
  };
})();
`;