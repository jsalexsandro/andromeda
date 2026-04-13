import { Function, Primitive, Array, FunctionType } from "./types"

export const Builtins: Record<string, FunctionType> = {
  print: Function.create([Array.of(Primitive.any())], Primitive.void()),
}

export function isBuiltin(name: string): boolean {
  return name in Builtins
}

export function getBuiltin(name: string): FunctionType | undefined {
  return Builtins[name]
}
