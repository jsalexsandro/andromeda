export type PrimitiveType = "int" | "float" | "bool" | "string" | "void" | "null"

export type Type =
  | PrimitiveType
  | { kind: "array"; elementType: Type }
  | { kind: "function"; params: Type[]; returnType: Type }
  | { kind: "object"; properties: Map<string, Type> }
  | { kind: "unknown" }
  | { kind: "inferred" }

export function typeToString(type: Type): string {
  if (typeof type === "string") return type
  switch (type.kind) {
    case "array": return `${typeToString(type.elementType)}[]`
    case "function": 
      const params = type.params.map(typeToString).join(", ")
      return `(${params}) => ${typeToString(type.returnType)}`
    case "object": return "object"
    case "unknown": return "unknown"
    case "inferred": return "inferred"
  }
}

export function isSameType(a: Type, b: Type): boolean {
  if (typeof a === "string" && typeof b === "string") return a === b
  if (a.kind === "inferred" || b.kind === "inferred") return true
  if (a.kind === "unknown" || b.kind === "unknown") return true
  if (a.kind !== b.kind) return false
  if (a.kind === "array") return isSameType(a.elementType, b.elementType)
  return false
}

export function canAssign(from: Type, to: Type): boolean {
  if (isSameType(from, to)) return true
  if (from.kind === "inferred" || to.kind === "inferred") return true
  if (typeof from === "string" && typeof to === "string") {
    return from === "int" && to === "float" || from === "float" && to === "int"
  }
  return false
}