// ── Andromeda Runtime ─────────────────────────────────────────────
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

// ── Registro de extensoes ───────────────────────────────────────────────
//
// extend String { ... } nao pode patchear String.prototype: poluiria o
// prototype global de todo string vindo de qualquer biblioteca. Os metodos
// ficam aqui, e o codegen reescreve s.shout() para $ext.String.shout(s).
const $ext = {};


class Counter {
  constructor(start) {
  this.value = start;
  AndromedaAPI.print("Init: " + this.show());
}
  double() {
  return this.value * 2;
}
  show() {
  return "Value: " + this.value;
}
}
Counter.prototype.triple = function () {
  const self = this;
  return self.value * 3;
};
Counter.prototype.incAndShow = function (step) {
  const self = this;
  self.value = self.value + step;
  return self.show();
};
const c = new Counter(5);
AndromedaAPI.print(c.double());
AndromedaAPI.print(c.triple());
AndromedaAPI.print(c.incAndShow(2));
AndromedaAPI.print(c.show());
class ShadowTest {
  constructor({ x = 10 }) {
    this.x = x;
  }
  getX() {
  return this.x;
}
  testShadow(x) {
  return this.getX() + x;
}
}
const s = new ShadowTest({  });
AndromedaAPI.print(s.testShadow(5));
class Box {
  constructor({ value }) {
    this.value = value;
  }
  get() {
  return this.value;
}
  wrap() {
  return new Box({ value: this.get() });
}
}
const b = new Box({ value: 42 });
AndromedaAPI.print(b.get());
class Greeter {
  constructor({ name }) {
    this.name = name;
  }
  greet() {
  return "Hello " + this.name;
}
}
Greeter.prototype.shout = function () {
  const self = this;
  return self.greet() + "!";
};
const g = new Greeter({ name: "World" });
AndromedaAPI.print(g.greet());
AndromedaAPI.print(g.shout());