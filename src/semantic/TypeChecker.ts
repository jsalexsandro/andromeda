import { AndroType, TypeKind, PrimitiveType, ArrayType, FunctionType, ClassType, Primitive } from "./types"

export class TypeChecker {
  static isUnknown(type: AndroType): boolean {
    return this.isPrimitive(type, TypeKind.Unknown)
  }

  static isAny(type: AndroType): boolean {
    return this.isPrimitive(type, TypeKind.Any)
  }

  static isVoid(type: AndroType): boolean {
    return this.isPrimitive(type, TypeKind.Void)
  }

  static isPrimitive(type: AndroType, kind: TypeKind): boolean {
    return type.kind === "primitive" && type.type === kind
  }

  static isArray(type: AndroType): type is ArrayType {
    return type.kind === "array"
  }

  static isFunction(type: AndroType): type is FunctionType {
    return type.kind === "function"
  }

  static isClass(type: AndroType): type is ClassType {
    return type.kind === "class"
  }

  static isSameType(a: AndroType, b: AndroType): boolean {
    if (this.isUnknown(a) || this.isUnknown(b)) return false
    if (this.isAny(a) || this.isAny(b)) return true

    if (a.kind !== b.kind) return false

    switch (a.kind) {
      case "primitive":
        return a.type === (b as PrimitiveType).type

      case "array":
        return this.isSameType(a.elementType, (b as ArrayType).elementType)

      case "function": {
        const bFn = b as FunctionType
        if (a.params.length !== bFn.params.length) return false
        if (!this.isSameType(a.returnType, bFn.returnType)) return false
        return a.params.every((param, i) => this.isSameType(param, bFn.params[i]))
      }

      case "class":
        return a.name === (b as ClassType).name

      default:
        return false
    }
  }

  static isAssignableTo(from: AndroType, to: AndroType): boolean {
    if (this.isUnknown(from) || this.isUnknown(to)) return true
    if (this.isAny(from) || this.isAny(to)) return true
    if (this.isSameType(from, to)) return true

    if (this.isPrimitive(to, TypeKind.Null)) {
      return (
        this.isPrimitive(from, TypeKind.Null) ||
        this.isArray(from) ||
        this.isClass(from) ||
        this.isPrimitive(from, TypeKind.String)
      )
    }

    return false
  }

  static toString(type: AndroType): string {
    switch (type.kind) {
      case "primitive":
        return type.type

      case "array":
        return `${this.toString(type.elementType)}[]`

      case "function": {
        const params = type.params.map((p) => this.toString(p)).join(", ")
        return `(${params}) => ${this.toString(type.returnType)}`
      }

      case "class":
        return type.name

      default:
        return "unknown"
    }
  }

  static fromKeyword(keyword: string): AndroType | null {
    switch (keyword) {
      case "int":
        return Primitive.int()
      case "float":
        return Primitive.float()
      case "string":
        return Primitive.string()
      case "bool":
        return Primitive.bool()
      case "void":
        return Primitive.void()
      case "null":
        return Primitive.null()
      case "any":
        return Primitive.any()
      default:
        return null
    }
  }

  static commonType(a: AndroType, b: AndroType): AndroType {
    if (this.isSameType(a, b)) return a
    if (this.isUnknown(a)) return b
    if (this.isUnknown(b)) return a
    if (this.isAny(a)) return b
    if (this.isAny(b)) return a
    return Primitive.unknown()
  }
}
