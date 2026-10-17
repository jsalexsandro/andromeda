import { Expr, LiteralExpr, IdentifierExpr, GroupExpr, UnaryExpr, BinaryExpr, LogicalExpr, ArrayExpr, AssignExpr, CallExpr, ArrowFunctionExpr, SpreadExpr, StructLiteralExpr, MemberExpr, NamedArgumentExpr, ConditionalExpr, NullishCoalescingExpr, IndexExpr, FunctionExpr } from "../ast";
import { Token, TokenType } from "../lexer/types";
import { getBuiltinValue, isBuiltinValue } from "../builtins";

// Expression visitor - converts Andromeda AST expressions to JavaScript strings
export class ExprVisitor {
  private inStructMethod: boolean = false;
  /** Builtins redefinidos pelo usuario no programa — nao devem ser reescritos */
  private shadowedBuiltins: Set<string> = new Set();
  /** Structs do programa — para emitir `new` em chamadas de construtor */
  private structs = new Map<string, { hasInit: boolean }>();

  enterStructMethod(): void {
    this.inStructMethod = true;
  }

  exitStructMethod(): void {
    this.inStructMethod = false;
  }

  shadowBuiltins(names: Iterable<string>): void {
    this.shadowedBuiltins = new Set(names);
  }

  /** Structs declarados no programa, para emitir `new` em chamadas */
  setStructs(structs: Map<string, { hasInit: boolean }>): void {
    this.structs = structs;
  }

  visit(expr: Expr): string {
    switch (expr.kind) {
      case "Literal":
        return this.visitLiteral(expr);
      case "Identifier":
        return this.visitIdentifier(expr);
      case "Group":
        return this.visitGroup(expr);
      case "Unary":
        return this.visitUnary(expr);
      case "Binary":
        return this.visitBinary(expr);
      case "Logical":
        return this.visitLogical(expr);
      case "Array":
        return this.visitArray(expr);
      case "Assign":
        return this.visitAssign(expr);
      case "Call":
        return this.visitCall(expr);
      case "ArrowFunction":
        return this.visitArrowFunction(expr);
      case "Function":
        return this.visitFunctionExpr(expr);
      case "Spread":
        return this.visitSpread(expr);
      case "StructLiteral":
        return this.visitStructLiteral(expr);
      case "Member":
        return this.visitMember(expr);
      case "NamedArgument":
        return this.visitNamedArgument(expr);
      case "Conditional":
        return this.visitConditional(expr);
      case "NullishCoalescing":
        return this.visitNullishCoalescing(expr);
      case "Index":
        return this.visitIndex(expr);
      default:
        return `/* unhandled: ${expr.kind} */`;
    }
  }

  private visitLiteral(expr: LiteralExpr): string {
    if (expr.value === null) return "null";
    if (typeof expr.value === "string") return JSON.stringify(expr.value);
    if (typeof expr.value === "boolean") return expr.value ? "true" : "false";
    if (typeof expr.value === "number") return String(expr.value);
    return "null";
  }

  private visitIdentifier(expr: IdentifierExpr): string {
    if (this.inStructMethod && expr.name.value === "self") {
      return "this";
    }
    return expr.name.value;
  }

  private visitGroup(expr: GroupExpr): string {
    return `(${this.visit(expr.expression)})`;
  }

  private visitUnary(expr: UnaryExpr): string {
    const op = expr.operator.value;
    const operand = this.visit(expr.right);
    // Handle precedence: unary binds tighter than binary
    const needsParen = expr.right.kind === "Binary" || expr.right.kind === "Logical";
    const operandStr = needsParen ? `(${operand})` : operand;
    // Postfix (x++, x--) → operand + op; Prefix (++x, --x) → op + operand
    if (expr.isPostfix) {
      return `${operandStr}${op}`;
    }
    return `${op}${operandStr}`;
  }

  private visitBinary(expr: BinaryExpr): string {
    const op = expr.operator.value;
    const left = this.visit(expr.left);
    const right = this.visit(expr.right);
    // int / int e int % int: o runtime trunca e protege contra zero
    const intOp = (expr as any).intDivisionOp;
    if (intOp === "/") return `AndromedaAPI.divInt(${left}, ${right})`;
    if (intOp === "%") return `AndromedaAPI.modInt(${left}, ${right})`;
    return `${left} ${op} ${right}`;
  }

  private visitLogical(expr: LogicalExpr): string {
    const op = expr.operator.value;
    const left = this.visit(expr.left);
    const right = this.visit(expr.right);
    // Logical operators have lower precedence than comparison
    return `${left} ${op} ${right}`;
  }

  private visitArray(expr: ArrayExpr): string {
    const elements = expr.elements.map((e: any) => this.visit(e)).join(", ");
    return `[${elements}]`;
  }

  private visitAssign(expr: AssignExpr): string {
    const name = this.visit(expr.name);
    const value = this.visit(expr.value);
    const op = expr.operator?.value || "=";
    return `${name} ${op} ${value}`;
  }

  private visitCall(expr: CallExpr): string {
    const args = expr.args.map((a: any) => {
      if (a.kind === "NamedArgument") {
        return this.visit(a.value);
      }
      return this.visit(a);
    }).join(", ");

// Metodo de primitivo: o checker anotou o template JS no no Member.
    // $self = receiver; $ARGS = lista nua (metodo nativo, receiver e `this`);
    // $REST = lista com virgula inicial (registro de extend, receiver e arg 0).
    if (expr.callee.kind === "Member") {
      const template = (expr.callee as any).jsTemplate;
      if (typeof template === "string") {
        const self = this.visit(expr.callee.object);
        return template
          .split("$self").join(self)
          .split("$ARGS").join(args)
          .split("$REST").join(args.length > 0 ? `, ${args}` : "");
      }
    }

    // Construtor de struct: sem `new` o JS chama a classe sem instanciar.
    // Auto-init usa argumento nomeado e o construtor destructura; init
    // custom e posicional. O literal `Nome { }` ja e outro no de AST.
    if (expr.callee.kind === "Identifier") {
      const structName = expr.callee.name.value;
      const struct = this.structs.get(structName);
      if (struct) {
        if (struct.hasInit) {
          return `new ${structName}(${args})`;
        }
        const named = expr.args
          .filter((a: any) => a.kind === "NamedArgument")
          .map((a: any) => `${a.key}: ${this.visit(a.value)}`);
        return `new ${structName}({ ${named.join(", ")} })`;
      }
    }

    // Builtins: print(...) -> $print(...)
    if (expr.callee.kind === "Identifier") {
      const name = expr.callee.name.value;
      if (isBuiltinValue(name) && !this.shadowedBuiltins.has(name)) {
        return `${getBuiltinValue(name)!.jsName}(${args})`;
      }
    }

    const callee = this.visit(expr.callee);
    return `${callee}(${args})`;
  }

  private visitArrowFunction(expr: ArrowFunctionExpr): string {
    const params = expr.params.map((p: any) => p.name.value).join(", ");
    let bodyStr: string;
    if (expr.body && typeof expr.body === 'object' && expr.body.kind === 'BlockStmt') {
      bodyStr = this.transpileBlockStmt(expr.body);
    } else {
      bodyStr = this.visit(expr.body);
    }
    return `(${params}) => ${bodyStr}`;
  }

  private visitFunctionExpr(expr: FunctionExpr): string {
    const params = expr.params.map((p: any) => p.name.value).join(", ");
    const body = this.transpileBlockStmt(expr.body);
    return `(${params}) => ${body}`;
  }

  /**
   * Transpile um BlockStmt para string JS (usado por FunctionExpr).
   * Duplica mínima lógica do Codegen para manter ExprVisitor autocontido.
   */
  private transpileBlockStmt(stmt: any): string {
    const stmts = stmt.statements.map((s: any) => this.transpileStmt(s)).filter(Boolean);
    if (stmts.length === 0) return "{}";
    return "{\n  " + stmts.join("\n  ") + "\n}";
  }

  private transpileStmt(s: any): string {
    switch (s.kind) {
      case "VariableStmt": {
        const kind = s.declarationType === "val" ? "const" : s.declarationType === "var" ? "let" : "const";
        const name = s.name.value;
        const init = s.initializer ? " = " + this.visit(s.initializer) : "";
        return kind + " " + name + init + ";";
      }
      case "ReturnStmt":
        return "return " + (s.value ? this.visit(s.value) : "") + ";";
      case "ExpressionStmt":
        return this.visit(s.expression) + ";";
      case "BlockStmt":
        return this.transpileBlockStmt(s);
      case "IfStmt": {
        const cond = this.visit(s.condition);
        const thenBranch = this.transpileStmt(s.thenBranch);
        let elseBranch = "";
        if (s.elseBranch) {
          const es = s.elseBranch;
          if (es.kind === "IfStmt") {
            elseBranch = " else " + this.transpileStmt(es);
          } else {
            elseBranch = " else " + this.transpileStmt(es);
          }
        }
        return "if (" + cond + ") " + thenBranch + elseBranch;
      }
      case "WhileStmt": {
        const cond = this.visit(s.condition);
        const body = this.transpileStmt(s.body);
        return "while (" + cond + ") " + body;
      }
      case "BreakStmt":
        return "break;";
      case "ContinueStmt":
        return "continue;";
      default:
        return "/* unhandled stmt: " + s.kind + " */";
    }
  }

  private visitSpread(expr: SpreadExpr): string {
    return `...${this.visit(expr.argument)}`;
  }

  private visitStructLiteral(expr: StructLiteralExpr): string {
    const name = expr.structName.value;
    const fields = expr.fields.map((f: any) => `${f.key}: ${this.visit(f.value)}`).join(", ");
    return `new ${name}({ ${fields} })`;
  }

private visitMember(expr: MemberExpr): string {
    let obj = this.visit(expr.object);
    const prop = expr.property.name.value;

    // `10.isEven()` e JS invalido — o parser le `10.` como literal. Parentese
    // quando o receiver e um literal numerico.
    if (expr.object.kind === "Literal" && typeof expr.object.value === "number") {
      obj = `(${obj})`;
    }

    // self.prop inside a struct method  this.prop
    if (this.inStructMethod && expr.object.kind === "Identifier" && expr.object.name.value === "self") {
      return `this.${prop}`;
    }
    return `${obj}.${prop}`;
  }

  private visitNamedArgument(expr: NamedArgumentExpr): string {
    return `${expr.key}: ${this.visit(expr.value)}`;
  }

  private visitConditional(expr: ConditionalExpr): string {
    const cond = this.visit(expr.condition);
    const consequent = this.visit(expr.consequent);
    const alternate = this.visit(expr.alternate);
    return `${cond} ? ${consequent} : ${alternate}`;
  }

  private visitNullishCoalescing(expr: NullishCoalescingExpr): string {
    const left = this.visit(expr.left);
    const right = this.visit(expr.right);
    return `${left} ?? ${right}`;
  }

  private visitIndex(expr: IndexExpr): string {
    const obj = this.visit(expr.object);
    const index = this.visit(expr.index);
    return `${obj}[${index}]`;
  }
}