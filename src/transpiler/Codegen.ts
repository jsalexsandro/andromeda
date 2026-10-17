import { Stmt, Expr, Program } from "../ast";
import { ExprVisitor } from "./ExprVisitor";
import { RUNTIME_JS } from "./runtime/runtime";
import { isBuiltinValue } from "../builtins";
import { Token, TokenType } from "../lexer/types";

export class Codegen {
  private exprVisitor: ExprVisitor;

  constructor() {
    this.exprVisitor = new ExprVisitor();
  }

  transpile(ast: Stmt[]): string {
    const lines: string[] = [];

    this.exprVisitor.shadowBuiltins(this.collectShadowedBuiltins(ast));

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
    const fields: any[] = stmt.fields || [];
    const methods: any[] = stmt.methods || [];
    const init = stmt.init;

    // ── Constructor ──
    let ctorCode: string;
    if (init) {
      // Custom init: positional arguments
      const params = init.params.map((p: any) => p.name.value).join(", ");
      this.exprVisitor.enterStructMethod();
      const body = this.transpileBlockStmt(init.body);
      this.exprVisitor.exitStructMethod();
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
      this.exprVisitor.enterStructMethod();
      const body = this.transpileBlockStmt(m.body);
      this.exprVisitor.exitStructMethod();
      return `${methodName}(${params}) ${body}`;
    }).join("\n  ");

    return `class ${name} {\n  ${ctorCode}\n  ${methodCode}\n}`;
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