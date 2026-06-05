import { MIRProgram, MIRInstruction, IRValue } from "./types"

export function printMIR(program: MIRProgram): string {
  const lines: string[] = []

  if (program.globals.length > 0) {
    lines.push("; --- globals ---")
    for (const inst of program.globals) {
      lines.push(`  ${printInstruction(inst)}`)
    }
    lines.push("")
  }

  for (const s of program.structs) {
    lines.push(`struct ${s.name} {`)
    for (const f of s.fields) {
      const mut = f.mutable ? "mut " : ""
      lines.push(`  ${mut}${f.name}: ${f.type}`)
    }
    lines.push("}")
    lines.push("")
  }

  for (const fn of program.functions) {
    lines.push(`func ${fn.name}(${fn.params.map(p => `${p.name}: ${p.type}`).join(", ")}): ${fn.returnType} {`)
    for (const inst of fn.instructions) {
      lines.push(`  ${printInstruction(inst)}`)
    }
    lines.push("}")
    lines.push("")
  }

  return lines.join("\n")
}

function printInstruction(inst: MIRInstruction): string {
  switch (inst.op) {
    case "const":
      return `${inst.dest} = const ${printIRValue(inst.value)}`
    case "copy":
      return `${inst.dest} = copy ${inst.src}`
    case "binary":
      return `${inst.dest} = ${inst.operator} ${inst.left}, ${inst.right}`
    case "unary":
      return `${inst.dest} = ${inst.operator} ${inst.operand}`
    case "block":
      return `block ${inst.name}:`
    case "jump":
      return `jump ${inst.label}`
    case "jumpIf":
      return `jump_if ${inst.cond}, ${inst.then}, ${inst.else}`
    case "return":
      if (inst.value === null) return "return void"
      if (typeof inst.value === "string") return `return ${inst.value}`
      return `return const ${printIRValue(inst.value)}`
    case "phi":
      return `${inst.dest} = phi(${inst.pairs.map(p => `${p.block}, ${p.value}`).join(", ")})`
    case "notNull":
      return `${inst.dest} = notNull ${inst.src}`
    case "call":
      return `${inst.dest} = call ${inst.callee}(${inst.args.join(", ")})`
    case "callIndirect":
      return `${inst.dest} = call ${inst.callee}(${inst.args.join(", ")})`
    case "callNamed":
      return `${inst.dest} = callNamed ${inst.callee}(${inst.args.map(a => `${a.name}: ${a.value}`).join(", ")})`
    case "alloc":
      return `${inst.dest} = alloc ${inst.structName}`
    case "getField":
      return `${inst.dest} = getField ${inst.object}.${inst.field}`
    case "setField":
      return `setField ${inst.object}.${inst.field} = ${inst.value}`
    case "array":
      return `${inst.dest} = array [${inst.elements.join(", ")}]`
    case "getIndex":
      return `${inst.dest} = ${inst.object}[${inst.index}]`
    case "setIndex":
      return `${inst.object}[${inst.index}] = ${inst.value}`
    case "spread":
      return `${inst.dest} = spread ${inst.src}`
    case "cellAlloc":
      return `${inst.dest} = cellAlloc`
    case "cellLoad":
      return `${inst.dest} = cellLoad ${inst.src}`
    case "cellStore":
      return `cellStore ${inst.cell} = ${inst.value}`
    case "makeClosure":
      return `${inst.dest} = makeClosure ${inst.callee} [${inst.cells.join(", ")}]`
    case "callClosure":
      return `${inst.dest} = callClosure ${inst.closure}(${inst.args.join(", ")})`
  }
}

function printIRValue(value: IRValue): string {
  switch (value.kind) {
    case "int":    return value.value.toString()
    case "float":  return value.value.toString()
    case "string": return `"${value.value}"`
    case "bool":   return value.value.toString()
    case "null":   return "null"
  }
}
