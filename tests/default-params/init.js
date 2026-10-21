// ── Andromeda Runtime ─────────────────────────────────────────────
const AndromedaAPI = (() => {
  const MAX_DEPTH = 6;
  const MAX_ITEMS = 100;

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

  const toNumber = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  };

  return {
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

const $ext = {};


class Counter {
  constructor(start = 0, step = 1) {
  this.value = start;
  this.step = step;
}
  
}
const c1 = new Counter();
const c2 = new Counter(10);
const c3 = new Counter(10, 5);
AndromedaAPI.print("c1: " + c1.value + ", step=" + c1.step);
AndromedaAPI.print("c2: " + c2.value + ", step=" + c2.step);
AndromedaAPI.print("c3: " + c3.value + ", step=" + c3.step);