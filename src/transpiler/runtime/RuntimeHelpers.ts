// Minimal runtime helpers - only what's absolutely necessary
// Types are erased at runtime; we trust the compiler

// Structural equality (for struct == comparison)
export const $equals = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => $equals(a[k], b[k]));
};

// Protocol registry (minimal - structural conformance only)
export const $protocol = {
  registry: new Map<string, string[]>(),
  register(name: string, methods: string[]) { this.registry.set(name, methods); },
  checkConformance(obj: any, _name: string): boolean {
    return obj && typeof obj === "object";
  }
};

// Generic runtime - just type erasure
export const $generic = {
  eraseType: (t: any) => t
};

// Minimal $andromeda namespace
export const $andromeda = {
  equals: (a: any, b: any): boolean => {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== "object" || typeof b !== "object") return a === b;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(k => $equals(a[k], b[k]));
  },
  struct: { create: (_n: string, f: any) => f, isInstance: () => false },
  protocol: { registry: new Map(), register: () => {}, checkConformance: () => true },
  generic: { eraseType: (t: any) => t }
};

export type $TypeName = "int" | "float" | "string" | "bool" | "void" | "null" | "any" | "unknown";