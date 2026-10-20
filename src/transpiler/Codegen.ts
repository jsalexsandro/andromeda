import { Stmt, Expr, Program } from "../ast";
import { ExprVisitor } from "./ExprVisitor";
import { RUNTIME_JS } from "./runtime/runtime";
import { isBuiltinValue } from "../builtins";
import { Token, TokenType } from "../lexer/types";

export class Codegen {
  private exprVisitor: ExprVisitor;
  private structs = new Map<string, { hasInit: boolean; fields: string[] }>();

  constructor() {
    this.exprVisitor = new ExprVisitor();
  }

  transpile(ast: Stmt[]): string {
    const lines: string[] = [];

    this.structs = this.collectStructs(ast);
    this.exprVisitor.shadowBuiltins(this.collectShadowedBuiltins(ast));
    this.exprVisitor.setStructs(this.structs);

    lines.push(RUNTIME_JS);
    lines.push("");

    for (const stmt of ast) {
      const transpiled = this.transpileStmt(stmt);
      if (transpiled) {
        lines.push(transpiled);
      }
    }

    return lines.join("\n");
  }

  /**
   * Mapeia struct -> tem init custom? O visitor precisa disso para emitting
   * `new`: auto-init recebe objeto nomeado, init custom recebe posicional.
   * Tambem coleta nomes de metodos (incluindo extend) para bare method calls.
   */
  private collectStructs(ast: Stmt[]): Map<string, { hasInit: boolean; fields: string[]; methodNames: string[] }> {
    const structs = new Map<string, { hasInit: boolean; fields: string[]; methodNames: string[] }>();

    // First pass: collect struct declarations
    const structStmts = new Map<string, any>();
    for (const stmt of ast) {
      if (stmt.kind === "StructStmt" && stmt.name) {
        const name = stmt.name.value as string;
        structStmts.set(name, stmt);
        structs.set(name, {
          hasInit: !!stmt.init,
          fields: stmt.fields.map((f: any) => f.name.value as string),
          methodNames: stmt.methods.map((m: any) => m.name.value as string),
        });
      }
    }

    // Second pass: collect extend fields and methods
    for (const stmt of ast) {
      if (stmt.kind === "ExtendStmt" && stmt.targetName) {
        const target = stmt.targetName.value as string;
        const existing = structs.get(target);
        if (existing) {
          // Add extend fields
          existing.fields = [
            ...existing.fields,
            ...stmt.fields.map((f: any) => f.name.value as string),
          ];
          // Add extend method names
          existing.methodNames = [
            ...existing.methodNames,
            ...stmt.methods.map((m: any) => m.name.value as string),
          ];
        }
      }
    }

    return structs;
  }

  /**
   * Um builtin pode ser redefinido pelo usuario (`func print(...)`). Nesse caso
   * o nome passa a pertencer ao programa e nao pode ser reescrito para o
   * simbolo do runtime.
   */
  private collectShadowedBuiltins(ast: Stmt[]): string[] {
    const shadowed: string[] = [];

    const visitStmt = (stmt: any): void => {
      if (!stmt || typeof stmt !== "object") return;

      if (stmt.kind === "FunctionStmt" && stmt.name?.value) {
        const name = stmt.name.value;
        if (isBuiltinValue(name) && !shadowed.includes(name)) {
          shadowed.push(name);
        }
      }

      for (const key of Object.keys(stmt)) {
        const value = (stmt as any)[key];
        if (Array.isArray(value)) {
          value.forEach(visitStmt);
        } else if (value && typeof value === "object" && typeof value.kind === "string") {
          visitStmt(value);
        }
      }
    };

    ast.forEach(visitStmt);
    return shadowed;
  }

  transpileStmt(stmt: any): string {
    switch (stmt.kind) {
      case "VariableStmt":
        return this.transpileVariableStmt(stmt);
      case "ExpressionStmt":
        return this.transpileExpr(stmt.expression) + ";";
      case "BlockStmt":
        return this.transpileBlockStmt(stmt);
      case "IfStmt":
        return this.transpileIfStmt(stmt);
      case "WhileStmt":
        return this.transpileWhileStmt(stmt);
      case "ForStmt":
        return this.transpileForStmt(stmt);
      case "IfVariableStmt":
        return this.transpileIfVariableStmt(stmt);
      case "BreakStmt":
        return "break;";
      case "ContinueStmt":
        return "continue;";
      case "FunctionStmt":
        return this.transpileFunctionStmt(stmt);
      case "ReturnStmt":
        return this.transpileReturnStmt(stmt);
      case "StructStmt":
        return this.transpileStructStmt(stmt);
      case "TypeAliasStmt":
        return "";
      case "ProtocolStmt":
        return "";
      case "ExtendStmt":
        return this.transpileExtendStmt(stmt);
      default:
        return `/* unhandled stmt: ${stmt.kind} */`;
    }
  }

  transpileExpr(expr: any): string {
    return this.exprVisitor.visit(expr);
  }

  private transpileVariableStmt(stmt: any): string {
    const kind = stmt.declarationType === "val" ? "const" : stmt.declarationType === "var" ? "let" : "const";
    const name = stmt.name.value;
    const init = stmt.initializer ? " = " + this.transpileExpr(stmt.initializer) : "";
    return kind + " " + name + init + ";";
  }

  private transpileBlockStmt(stmt: any): string {
    const stmts = stmt.statements.map((s: any) => this.transpileStmt(s)).filter(Boolean);
    if (stmts.length === 0) return "{}";
    return "{\n  " + stmts.join("\n  ") + "\n}";
  }

  private transpileIfStmt(stmt: any): string {
    const cond = this.transpileExpr(stmt.condition);
    const thenBranch = this.transpileStmt(stmt.thenBranch);
    let elseBranch = "";
    if (stmt.elseBranch) {
      const elseStmt = stmt.elseBranch;
      if (elseStmt.kind === "IfStmt") {
        elseBranch = " else " + this.transpileStmt(elseStmt);
      } else {
        elseBranch = " else " + this.transpileStmt(elseStmt);
      }
    }
    return "if (" + cond + ") " + thenBranch + elseBranch;
  }

  private transpileWhileStmt(stmt: any): string {
    const cond = this.transpileExpr(stmt.condition);
    const body = this.transpileStmt(stmt.body);
    return "while (" + cond + ") " + body;
  }

  private transpileForStmt(stmt: any): string {
    const init = stmt.initializer ? this.transpileStmt(stmt.initializer).replace(/;+$/, "") : "";
    const cond = stmt.condition ? this.transpileExpr(stmt.condition) : "true";
    const update = stmt.update ? this.transpileExpr(stmt.update) : "";
    const body = this.transpileStmt(stmt.body);
    const updateStr = update ? " ; " + update : "";
    return "for (" + init + "; " + cond + updateStr + ") " + body;
  }

  private transpileIfVariableStmt(stmt: any): string {
    // Coletar todas as bindings (stmt + continuations)
    const bindings: any[] = [];
    let current: any = stmt;
    while (current) {
      bindings.push(current);
      current = current.continuation;
    }

    // Declarar cada variável
    const declarations = bindings.map((b: any) => {
      const kind = b.declarationType === "var" ? "let" : "const";
      const name = b.name.value;
      const init = b.initializer ? " = " + this.transpileExpr(b.initializer) : "";
      return kind + " " + name + init + ";";
    }).join(" ");

    // Condição: todas as variáveis != null (encadeadas com &&)
    const condition = bindings.map((b: any) => b.name.value + " != null").join(" && ");

    const thenBranch = this.transpileStmt(stmt.thenBranch);
    let elseBranch = "";
    if (stmt.elseBranch) {
      elseBranch = " else " + this.transpileStmt(stmt.elseBranch);
    }

    return "{" + declarations + " if (" + condition + ") " + thenBranch + elseBranch + "}";
  }

  private transpileFunctionStmt(stmt: any): string {
    const name = stmt.name.value;
    const params = stmt.params.map((p: any) => p.name.value).join(", ");
    const body = this.transpileBlockStmt(stmt.body);
    return "function " + name + "(" + params + ") " + body;
  }

  private transpileReturnStmt(stmt: any): string {
    if (stmt.value) {
      return "return " + this.transpileExpr(stmt.value) + ";";
    }
    return "return;";
  }

  private transpileStructStmt(stmt: any): string {
    const name = stmt.name.value;
    // Campos vindos de `extend` entram no construtor auto-init: viram
    // propriedade propria da instancia, entao `print()` tambem os mostra.
    // O checker anota aqui via preRegisterExtends.
    const extendFields: any[] = (stmt as any).extendFields || [];
    const fields: any[] = [...(stmt.fields || []), ...extendFields];
    const fieldNames = fields.map((f: any) => f.name.value);
    const structInfo = this.structs.get(name);
    const allMethodNames = structInfo?.methodNames ?? [];
    const methods: any[] = stmt.methods || [];
    const init = stmt.init;

    // ── Constructor ──
    let ctorCode: string;
    if (init) {
      // Custom init: positional arguments. Campos de extend com default
      // anexam o fim da lista (`constructor(raw, hash = "auto")`) e sao
      // atribuidos no inicio do corpo. Sem default o checker ja bloqueou:
      // nao ha por onde receber o valor. Com rest param nem com default
      // cabe, porque JS nao aceita default depois de `...rest`.
      const initHasRest = init.params.some((p: any) => p.isRest === true);
      const injectedFields = initHasRest
        ? []
        : extendFields.filter((f: any) => f.defaultValue);

      const params = [
        ...init.params.map((p: any) => p.name.value),
        ...injectedFields.map(
          (f: any) => `${f.name.value} = ${this.transpileExpr(f.defaultValue)}`
        ),
      ].join(", ");

      this.exprVisitor.enterStructMethod(fieldNames, "this", init.params.map((p: any) => p.name.value), allMethodNames);
      let body = this.transpileBlockStmt(init.body);
      this.exprVisitor.exitStructMethod();

      if (injectedFields.length > 0) {
        const assigns = injectedFields
          .map((f: any) => `this.${f.name.value} = ${f.name.value};`)
          .join(" ");
        body = body === "{}"
          ? `{ ${assigns} }`
          : `{ ${assigns}${body.replace(/^\{/, "").replace(/\}$/, "")} }`;
      }
      ctorCode = `constructor(${params}) ${body}`;
    } else {
      // Auto-init: named arguments via object destructuring
      const ctorParams = fields.map((f: any) => {
        const fieldName = f.name.value;
        const defaultVal = f.defaultValue ? ` = ${this.transpileExpr(f.defaultValue)}` : "";
        return `${fieldName}${defaultVal}`;
      }).join(", ");

      const ctorBody = fields.map((f: any) => {
        const fieldName = f.name.value;
        return `this.${fieldName} = ${fieldName};`;
      }).join("\n    ");

      ctorCode = `constructor({ ${ctorParams} }) {\n    ${ctorBody}\n  }`;
    }

    // ── Methods ──
    const methodCode = methods.map((m: any) => {
      const methodName = m.name.value;
      const params = m.params.map((p: any) => p.name.value).join(", ");
      this.exprVisitor.enterStructMethod(fieldNames, "this", m.params.map((p: any) => p.name.value), allMethodNames);
      const body = this.transpileBlockStmt(m.body);
      this.exprVisitor.exitStructMethod();
      return `${methodName}(${params}) ${body}`;
    }).join("\n  ");

    return `class ${name} {\n  ${ctorCode}\n  ${methodCode}\n}`;
  }

  /**
   * extend User { func m() {} }   →  prototype
   * extend String { func m() {} }  →  registro $ext
   *
   * O alvo decide: struct vai para o prototype (metodo de verdade), primitivo
   * vai para `$ext` porque patchear `String.prototype` poluiria o prototype
   * global de todo string vindo de qualquer biblioteca. Quem sabe qual e o
   * caso e o checker, que marca o no com `extendTargetKind`.
   */
  private transpileExtendStmt(stmt: any): string {
    const target = stmt.targetName.value;

if ((stmt as any).extendTargetKind === "primitive") {
      // chave pelo nome PRIMITIVO resolvido: o jsTemplate do Member ja usa
      // esse, e os dois precisam casar
      const key = JSON.stringify((stmt as any).extendPrimitiveName ?? target);
      // `self` aqui E parametro: a chamada reescrita e `$ext.String.m(s)`,
      // entao o receiver chega como primeiro argumento.
      const methods = (stmt.methods || []).map((m: any) => {
        const params = ["self", ...m.params.map((p: any) => p.name.value)].join(", ");
        const body = this.transpileBlockStmt(m.body);
        return `  ${m.name.value}: function (${params}) ${body}`;
      });
      const body = methods.length > 0 ? `{\n${methods.join(",\n")}\n}` : "{}";
      return `$ext[${key}] = Object.assign($ext[${key}] || {}, ${body});`;
    }

    const targetStruct = this.structs.get(target);
    const extendFieldNames = targetStruct ? targetStruct.fields : [];
    // Get ALL method names (struct + extend) for bare method calls within extend methods
    const allMethodNames = targetStruct ? targetStruct.methodNames : [];

    return (stmt.methods || []).map((m: any) => {
      const params = m.params.map((p: any) => p.name.value).join(", ");
      this.exprVisitor.enterStructMethod(extendFieldNames, "self", m.params.map((p: any) => p.name.value), allMethodNames);
      const body = this.transpileBlockStmt(m.body);
      this.exprVisitor.exitStructMethod();
      // `self` nao pode ser parametro: `u.m()` so passa `this`, entao um
      // parametro `self` viria undefined. Injetamos do `this` real.
      const injected = body.replace(/^\{/, "{\n  const self = this;");
      return `${target}.prototype.${m.name.value} = function (${params}) ${injected};`;
    }).join("\n");
  }

  private typeToString(type: any): string {
    if (!type) return "any";
    switch (type.kind) {
      case "PrimitiveType":
        return type.name;
      case "NamedType":
        return type.name.value;
      case "GenericType": {
        const name = type.name.value;
        const args = type.args.map((a: any) => this.typeToString(a)).join(", ");
        return name + "<" + args + ">";
      }
      case "FunctionType": {
        const params = type.params.map((p: any) => this.typeToString(p)).join(", ");
        return "(" + params + ") => " + this.typeToString(type.returnType);
      }
      case "ArrayType": {
        const elem = this.typeToString(type.elementType);
        const dims = "[]".repeat(type.dimensions);
        return elem + dims;
      }
      case "NullableType": {
        return this.typeToString(type.type) + "?";
      }
      case "TupleType": {
        const elems = type.elements.map((e: any) => this.typeToString(e)).join(", ");
        return "[" + elems + "]";
      }
      case "UnionType": {
        return type.types.map((t: any) => this.typeToString(t)).join(" | ");
      }
      case "GroupingType": {
        return "(" + this.typeToString(type.type) + ")";
      }
      case "SelfType":
        return "Self";
      default:
        return "any";
    }
  }
}