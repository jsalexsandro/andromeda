import { Token, TokenType } from "../lexer/types";
import { Stmt, Expr, TypeNode, GenericTypeNode, FunctionTypeNode, IfVariableStmt, StructLiteralExpr, StructField, StructMethod, StructConstructor } from "../ast";
import { Symbol, createSymbol } from "./types";
import { SemanticError, Errors } from "./errors";
import { Environment } from "./Environment";

export class TypeChecker {
  private static readonly PROTECTED_BUILTINS = new Set([
    "Array",
    "Optional",
  ]);

  private errors: SemanticError[] = [];
  private globalEnv: Environment;
  private currentEnv: Enviroanment;
  private loopDepth: number = 0;
  private functionDepth: number = 0;
  private hasReturn: boolean = false;
  private currentFunctionReturnType: TypeNode | null = null;
  private contextualType: TypeNode | null = null;
  private resolvedTypes = new Map<Expr, TypeNode>();

  constructor() {
    this.globalEnv = new Environment(null, true);
    this.currentEnv = this.globalEnv;
  }

  // ── Array<T> helpers ─────────────────────────────────────
  private makeArrayType(elementType: TypeNode): GenericTypeNode {
    return {
      kind: "GenericType",
      name: { type: TokenType.IDENTIFIER, value: "Array", line: 0, column: 0 },
      args: [elementType],
      isBuiltin: true,
    };
  }

  private isArray(type: TypeNode): type is GenericTypeNode {
    return (
      type.kind === "GenericType" &&
      (type.name.value as string) === "Array" &&
      type.args.length === 1
    );
  }

  private arrayElement(type: GenericTypeNode): TypeNode {
    return type.args[0] ?? { kind: "PrimitiveType", name: "unknown" };
  }

  // ── Optional<T> helpers ────────────────────────────────────
  private isOptional(type: TypeNode): type is GenericTypeNode {
    return (
      type.kind === "GenericType" &&
      (type.name.value as string) === "Optional" &&
      type.args.length === 1
    );
  }

  /**
   * Normaliza Optional<T> → NullableType recursivamente.
   * Usado nas portas de entrada (areTypesCompatible, checkIndexExpr, etc.)
   * para que o checker existente trate Optional<T> como NullableType.
   */
  private normalizeType(type: TypeNode): TypeNode {
    if (this.isOptional(type)) {
      return {
        kind: "NullableType",
        type: this.normalizeType(type.args[0]),
      };
    }
    if (type.kind === "GenericType") {
      const newArgs = type.args.map(a => this.normalizeType(a));
      if (newArgs.every((arg, i) => arg === type.args[i])) return type;
      return { ...type, args: newArgs };
    }
    if (type.kind === "NullableType") {
      const inner = this.normalizeType(type.type);
      if (inner === type.type) return type;
      return { kind: "NullableType", type: inner };
    }
    if (type.kind === "UnionType") {
      const newTypes = type.types.map(t => this.normalizeType(t));
      if (newTypes.length === 2) {
        const nullIdx = newTypes.findIndex(t => t.kind === "PrimitiveType" && t.name === "null");
        if (nullIdx !== -1) {
          const other = newTypes[nullIdx === 0 ? 1 : 0];
          return { kind: "NullableType", type: other };
        }
      }
      if (newTypes.every((t, i) => t === type.types[i])) return type;
      return { kind: "UnionType", types: newTypes };
    }
    return type;
  }

  /**
   * Substitui type params por types concretos em um TypeNode.
   * Percorre recursivamente todos os kinds de TypeNode.
   */
  private substitute(type: TypeNode, mapping: Map<string, TypeNode>): TypeNode {
    switch (type.kind) {
      case "NamedType": {
        const name = type.name.value as string;
        const replacement = mapping.get(name);
        if (replacement) return replacement;
        return type;
      }
      case "GenericType": {
        const newArgs = type.args.map(a => this.substitute(a, mapping));
        return { ...type, args: newArgs };
      }
      case "FunctionType": {
        const newParams = type.params.map(p => ({ ...p, ...this.substitute(p, mapping) }));
        const newReturn = this.substitute(type.returnType, mapping);
        return { ...type, params: newParams, returnType: newReturn };
      }
      case "UnionType": {
        const newTypes = type.types.map(t => this.substitute(t, mapping));
        return { ...type, types: newTypes };
      }
      case "NullableType": {
        const inner = this.substitute(type.type, mapping);
        return { ...type, type: inner };
      }
      case "TupleType": {
        const newElements = type.elements.map(e => this.substitute(e, mapping));
        return { ...type, elements: newElements };
      }
      case "ArrayType": {
        const newElement = this.substitute(type.elementType, mapping);
        return { ...type, elementType: newElement };
      }
      case "GroupingType": {
        const newInner = this.substitute(type.type, mapping);
        return { ...type, type: newInner };
      }
      default:
        return type;
    }
  }

  /**
   * Tenta inferir type args a partir dos tipos dos argumentos.
   * Usa unify() recursivo que percorre ArrayType, NullableType,
   * GenericType, FunctionType, GroupingType, UnionType para
   * encontrar referências a type params em qualquer profundidade.
   */
  private tryInferTypeArgs(
    typeParams: TypeParameterNode[],
    fnParamTypes: (TypeNode & { isRest?: boolean })[],
    argTypes: TypeNode[]
  ): Map<string, TypeNode> | null {
    const mapping = new Map<string, TypeNode>();
    const typeParamNames = new Set(typeParams.map(tp => tp.name.value as string));

    const unify = (paramType: TypeNode, argType: TypeNode): boolean => {
      // Desembrulha GroupingType em ambos os lados
      if (paramType.kind === "GroupingType") return unify(paramType.type, argType);
      if (argType.kind === "GroupingType") return unify(paramType, argType.type);

      // T — type param direto
      if (paramType.kind === "NamedType") {
        const name = paramType.name.value as string;
        if (typeParamNames.has(name)) {
          const existing = mapping.get(name);
          if (existing) {
            // Se o binding atual é NamedType (type param de outro escopo, ex:
            // arrow genérica <A,B>(...) dentro de swap<A,B>(...)), permite que
            // tipos concretos (int, string) sobrescrevam. Isso resolve Bug #11
            // sem quebrar shadowing de type params (ex: inner<T>(x) dentro de outer<T>).
            if (existing.kind === "NamedType") {
              mapping.set(name, argType);
            }
            return true;
          }
          mapping.set(name, argType);
        }
        return true;
      }

      // T[] — ArrayType legacy
      if (paramType.kind === "ArrayType") {
        const elemArg = this.isArray(argType)
          ? this.arrayElement(argType as GenericTypeNode)
          : argType.kind === "ArrayType"
            ? argType.elementType
            : null;
        if (elemArg) return unify(paramType.elementType, elemArg);
        return true;
      }

      // Array<T> / Map<K,V> etc — GenericType
      if (paramType.kind === "GenericType") {
        const paramName = paramType.name.value as string;

        // Array<T> com argType sendo ArrayType legacy
        if (paramName === "Array" && paramType.args.length === 1) {
          const elemArg = argType.kind === "ArrayType"
            ? argType.elementType
            : this.isArray(argType)
              ? this.arrayElement(argType as GenericTypeNode)
              : null;
          if (elemArg) return unify(paramType.args[0], elemArg);
        }

        // Optional<T> com argType sendo tipo direto (ex: int → T = int)
        // ou NullableType (ex: int? → T = int) ou Optional<T> (ex: Optional<int> → T = int)
        if (paramName === "Optional" && paramType.args.length === 1) {
          const innerArg = argType.kind === "GenericType" && (argType.name.value as string) === "Optional" && argType.args.length === 1
            ? argType.args[0]
            : argType.kind === "NullableType"
              ? argType.type
              : argType.kind === "PrimitiveType" && argType.name === "null"
                ? null
                : argType;
          if (innerArg) return unify(paramType.args[0], innerArg);
          return true;
        }

        if (
          argType.kind === "GenericType" &&
          (argType.name.value as string) === paramName &&
          argType.args.length === paramType.args.length
        ) {
          return paramType.args.every((pa, i) => unify(pa, argType.args[i]));
        }
        return true;
      }

      // T? — NullableType
      if (paramType.kind === "NullableType") {
        const innerArg =
          argType.kind === "NullableType" ? argType.type :
          argType.kind === "PrimitiveType" && argType.name === "null" ? null :
          argType;
        if (innerArg) return unify(paramType.type, innerArg);
        return true;
      }

      // (A, B) => R — FunctionType
      if (paramType.kind === "FunctionType") {
        const actualFn =
          argType.kind === "FunctionType" ? argType :
          argType.kind === "GroupingType" && argType.type.kind === "FunctionType"
            ? argType.type : null;
        if (actualFn && actualFn.kind === "FunctionType") {
          const paramsOk = paramType.params.every((pp, i) =>
            i < actualFn.params.length ? unify(pp, actualFn.params[i]) : true
          );
          return paramsOk && unify(paramType.returnType, actualFn.returnType);
        }
        return true;
      }

      // UnionType — tenta unificar com cada membro
      if (paramType.kind === "UnionType") {
        return paramType.types.some(pt => unify(pt, argType));
      }

      return true;
    };

    for (let i = 0; i < fnParamTypes.length && i < argTypes.length; i++) {
      if (!unify(this.resolveAlias(fnParamTypes[i]), argTypes[i])) return null;
    }

    return mapping;
  }

  /**
   * Tenta inferir type params não resolvidos a partir do contextualType.
   * Útil quando a inferência dos args deixou algum T como unknown
   * e o contexto da chamada (ex: val x: string? = nullableIdentity(null))
   * pode determinar T.
   */
  private inferTypeArgsFromReturnType(
    typeParams: TypeParameterNode[],
    returnType: TypeNode,
    contextualType: TypeNode
  ): Map<string, TypeNode> | null {
    const mapping = new Map<string, TypeNode>();
    const typeParamNames = new Set(typeParams.map(tp => tp.name.value as string));

    const unify = (paramType: TypeNode, argType: TypeNode): boolean => {
      if (paramType.kind === "GroupingType") return unify(paramType.type, argType);
      if (argType.kind === "GroupingType") return unify(paramType, argType.type);

      if (paramType.kind === "NamedType") {
        const name = paramType.name.value as string;
        if (typeParamNames.has(name)) {
          const existing = mapping.get(name);
          if (existing) {
            return true;
          }
          mapping.set(name, argType);
        }
        return true;
      }

      if (paramType.kind === "ArrayType") {
        const elemArg = this.isArray(argType)
          ? this.arrayElement(argType as GenericTypeNode)
          : argType.kind === "ArrayType"
            ? argType.elementType
            : null;
        if (elemArg) return unify(paramType.elementType, elemArg);
        return true;
      }

      if (paramType.kind === "GenericType") {
        const paramName = paramType.name.value as string;
        if (paramName === "Array" && paramType.args.length === 1) {
          const elemArg = argType.kind === "ArrayType"
            ? argType.elementType
            : this.isArray(argType)
              ? this.arrayElement(argType as GenericTypeNode)
              : null;
          if (elemArg) return unify(paramType.args[0], elemArg);
        }
        if (paramName === "Optional" && paramType.args.length === 1) {
          const innerArg = argType.kind === "GenericType" && (argType.name.value as string) === "Optional" && argType.args.length === 1
            ? argType.args[0]
            : argType.kind === "NullableType"
              ? argType.type
              : argType.kind === "PrimitiveType" && argType.name === "null"
                ? null
                : argType;
          if (innerArg) return unify(paramType.args[0], innerArg);
          return true;
        }
        if (
          argType.kind === "GenericType" &&
          (argType.name.value as string) === paramName &&
          argType.args.length === paramType.args.length
        ) {
          return paramType.args.every((pa, i) => unify(pa, argType.args[i]));
        }
        return true;
      }

      if (paramType.kind === "NullableType") {
        const innerArg =
          argType.kind === "NullableType" ? argType.type :
          argType.kind === "PrimitiveType" && argType.name === "null" ? null :
          argType;
        if (innerArg) return unify(paramType.type, innerArg);
        return true;
      }

      if (paramType.kind === "FunctionType") {
        const actualFn = argType.kind === "FunctionType" ? argType : null;
        if (actualFn) {
          const paramsOk = paramType.params.every((pp, i) =>
            i < actualFn.params.length ? unify(pp, actualFn.params[i]) : true
          );
          return paramsOk && unify(paramType.returnType, actualFn.returnType);
        }
        return true;
      }

      if (paramType.kind === "UnionType") {
        return paramType.types.some(pt => unify(pt, argType));
      }

      return true;
    };

    if (!unify(returnType, contextualType)) return null;
    return mapping;
  }

  public check(program: Stmt[]): SemanticError[] {
    this.errors = [];

    for (const stmt of program) {
      this.checkStatement(stmt);
    }

    return this.errors;
  }

  private checkStatement(stmt: Stmt): void {
    switch (stmt.kind) {
      case "VariableStmt":
        this.checkVariableStmt(stmt);
        break;
      case "FunctionStmt":
        this.checkFunctionStmt(stmt);
        break;
      case "BlockStmt":
        this.checkBlockStmt(stmt);
        break;
      case "IfStmt":
        this.checkIfStmt(stmt);
        break;
      case "WhileStmt":
        this.checkWhileStmt(stmt);
        break;
      case "ForStmt":
        this.checkForStmt(stmt);
        break;
      case "BreakStmt":
        this.checkBreakStmt(stmt);
        break;
      case "ContinueStmt":
        this.checkContinueStmt(stmt);
        break;
      case "ReturnStmt":
        this.checkReturnStmt(stmt);
        break;
      case "TypeAliasStmt":
        this.checkTypeAliasStmt(stmt);
        break;
      case "ExpressionStmt":
        this.checkExpressionStmt(stmt);
        break;
      case "Assign":
        this.checkAssignStmt(stmt);
        break;
      case "IfVariableStmt":
        this.checkIfVariableStmt(stmt);
        break;
      case "StructStmt":
        this.checkStructStmt(stmt);
        break;
      default:
        break;
    }
  }

  private checkVariableStmt(stmt: Extract<Stmt, { kind: "VariableStmt" }>): void {
    const name = stmt.name.value as string;
    const existing = this.currentEnv.lookupLocal(name);

    if (existing) {
      this.errors.push(Errors.alreadyDeclared(name, stmt.name));
      return;
    }

    // Regra única: TODO declarador exige inicializador
    if (!stmt.initializer) {
      this.errors.push(Errors.varRequiresInitializer(name, stmt.declarationType, stmt.name));

      // registra como any para não cascatear erros nos usos seguintes
      this.currentEnv.define(name, createSymbol(
        name,
        { kind: "PrimitiveType", name: "any" },
        "variable",
        stmt.declarationType === "var",
        stmt.name
      ));
      return;
    }

    let typeNode: TypeNode;
    if (stmt.type) {
      const validationError = this.validateTypeNode(stmt.type, stmt.name);
      if (validationError) {
        this.errors.push(validationError);
        typeNode = { kind: "PrimitiveType", name: "any" };
      } else {
        typeNode = stmt.type;
      }
      if (stmt.initializer) {
        this.contextualType = typeNode;
        const inferredType = this.inferType(stmt.initializer);
        this.contextualType = null;
        if (!this.areTypesCompatible(typeNode, inferredType)) {
          // Hint para função nullable
          const isNullableFunctionHint = 
            typeNode.kind === "FunctionType" &&
            inferredType.kind === "PrimitiveType" &&
            inferredType.name === "null";
          
          const hint = isNullableFunctionHint
            ? ` Hint: for nullable function, use '((${this.typeToString(typeNode)}) | null' or '(${this.typeToString(typeNode)})?'`
            : "";
          
          this.errors.push(Errors.typeMismatch(
            `type '${this.typeToString(typeNode)}' is incompatible with initializer '${this.typeToString(inferredType)}'${hint}`,
            stmt.name
          ));
        }
      }
    } else if (stmt.initializer) {
      typeNode = this.inferType(stmt.initializer);
    } else {
      typeNode = { kind: "PrimitiveType", name: "any" };
    }

    const mutable =
      stmt.declarationType === "var" ||
      (stmt.declarationType === "val" && !stmt.initializer);

    const symbol = createSymbol(
      name,
      typeNode,
      "variable",
      mutable,
      stmt.name
    );

    this.currentEnv.define(name, symbol);
  }

  private checkTypeAliasStmt(stmt: Extract<Stmt, { kind: "TypeAliasStmt" }>): void {
    const name = stmt.name.value as string;

    // Verificar redeclaração no escopo local
    const existing = this.currentEnv.lookupLocal(name);
    if (existing && existing.kind !== "builtin") {
      this.errors.push(Errors.alreadyDeclared(name, stmt.name));
      return;
    }
    if (existing?.kind === "builtin" && TypeChecker.PROTECTED_BUILTINS.has(name)) {
      this.errors.push(Errors.cannotRedefineBuiltin(name, stmt.name));
      return;
    }

    // Register type params in a temporary scope so the body can reference them
    const prevEnv = this.currentEnv;
    if (stmt.typeParameters) {
      const tmpEnv = new Environment(this.currentEnv, false);
      for (const tp of stmt.typeParameters) {
        const tpName = tp.name.value as string;
        tmpEnv.define(tpName, {
          name: tpName,
          type: { kind: "NamedType", name: tp.name },
          kind: "typeParam",
          mutable: false,
          initialized: true,
          declarationToken: tp.name,
        });
      }
      this.currentEnv = tmpEnv;
    }

    // Detect self-referencing aliases
    const selfRefErr = this.checkAliasSelfReference(stmt.type, name, stmt.name);
    if (selfRefErr) {
      this.errors.push(selfRefErr);
      if (stmt.typeParameters) this.currentEnv = prevEnv;
      return;
    }

    const err = this.validateTypeNode(stmt.type, stmt.name);
    if (err) {
      this.errors.push(err);
      if (stmt.typeParameters) this.currentEnv = prevEnv;
      return;
    }

    if (stmt.typeParameters) this.currentEnv = prevEnv;

    // Registrar no ambiente global como kind: "type"
    const symbol = {
      name,
      type: stmt.type,   // o TypeNode que o alias representa
      kind: "type" as const,
      mutable: false,
      initialized: true,
      declarationToken: stmt.name,
      typeParameters: stmt.typeParameters,
    };

    this.globalEnv.define(name, symbol);
  }

  private checkStructStmt(stmt: Extract<Stmt, { kind: "StructStmt" }>): void {
    const name = stmt.name.value as string;

    const existing = this.currentEnv.lookupLocal(name);
    if (existing) {
      this.errors.push(Errors.alreadyDeclared(name, stmt.name));
      return;
    }

    // Registrar struct no escopo externo primeiro (auto-referencia via env chain)
    const prevEnv = this.currentEnv;
    prevEnv.define(name, {
      name,
      type: { kind: "NamedType", name: stmt.name } as TypeNode,
      kind: "struct",
      mutable: false,
      initialized: true,
      declarationToken: stmt.name,
      fields: stmt.fields,
      typeParameters: stmt.typeParameters,
    });

    // Registrar type params em escopo temporário (6.2 + 6.6)
    if (stmt.typeParameters) {
      const tmpEnv = new Environment(prevEnv, false);
      const seen = new Set<string>();
      for (const tp of stmt.typeParameters) {
        const tpName = tp.name.value as string;
        if (seen.has(tpName)) {
          this.errors.push(Errors.alreadyDeclared(tpName, tp.name));
        } else {
          seen.add(tpName);
          tmpEnv.define(tpName, {
            name: tpName,
            type: { kind: "NamedType", name: tp.name } as TypeNode,
            kind: "typeParam",
            mutable: false,
            initialized: true,
            declarationToken: tp.name,
            constraint: tp.constraint,
          });
        }
      }
      this.currentEnv = tmpEnv;
    }

    // Validar tipos dos campos (type params visiveis quando existem)
    for (const field of stmt.fields) {
      const err = this.validateTypeNode(field.type, field.name);
      if (err) {
        this.errors.push(err);
      }
    }

    // ── 7.3–7.7 Processar struct methods ─────────────────
    if (stmt.methods) {
      // Guardar methods no symbol do struct
      const structSymbol = prevEnv.lookupLocal(name);
      if (structSymbol) {
        structSymbol.methods = stmt.methods;
      }

      // Verificar corpos dos métodos
      for (const method of stmt.methods) {
        this.checkStructMethodBody(stmt, method);
      }
    }

    // ── 10.0 Processar custom init ──────────────────────
    if (stmt.init) {
      // Guardar init no symbol do struct
      const structSymbol = prevEnv.lookupLocal(name);
      if (structSymbol) {
        structSymbol.init = stmt.init;
      }
      this.checkStructConstructor(stmt, stmt.init);
    }

    // Restaurar escopo
    if (stmt.typeParameters) {
      this.currentEnv = prevEnv;
    }
  }

  // ── 7.3–7.7 Check struct method body ──────────────────────
  private checkStructMethodBody(structStmt: Extract<Stmt, { kind: "StructStmt" }>, method: StructMethod): void {
    const methodName = method.name.value as string;

    // Criar escopo da função com type params do struct
    const fnEnv = new Environment(this.currentEnv, false);

    // Registrar type params do struct no fnEnv
    if (structStmt.typeParameters) {
      const seen = new Set<string>();
      for (const tp of structStmt.typeParameters) {
        const tpName = tp.name.value as string;
        if (!seen.has(tpName)) {
          seen.add(tpName);
          fnEnv.define(tpName, {
            name: tpName,
            type: { kind: "NamedType", name: tp.name } as TypeNode,
            kind: "typeParam",
            mutable: false,
            initialized: true,
            declarationToken: tp.name,
            constraint: tp.constraint,
          });
        }
      }
    }

    // Registrar type params do próprio método (7.5)
    if (method.typeParameters) {
      const seen = new Set<string>();
      for (const tp of method.typeParameters) {
        const tpName = tp.name.value as string;
        if (seen.has(tpName)) {
          this.errors.push(Errors.alreadyDeclared(tpName, tp.name));
        } else {
          seen.add(tpName);
          fnEnv.define(tpName, {
            name: tpName,
            type: { kind: "NamedType", name: tp.name } as TypeNode,
            kind: "typeParam",
            mutable: false,
            initialized: true,
            declarationToken: tp.name,
            constraint: tp.constraint,
          });
        }
      }
    }

    // Reservar escopo da função
    const prevEnv = this.currentEnv;
    this.currentEnv = fnEnv;

    // ── self (7.3) ────────────────────────────────────────────
    this.defineStructSelf(fnEnv, structStmt, method.mutable, method.name);

    // Validar tipos dos params
    const paramTypes: TypeNode[] = [];
    for (const param of method.params) {
      if (param.type) {
        const err = this.validateTypeNode(param.type, param.name);
        if (err) this.errors.push(err);
        paramTypes.push(param.type);
      } else {
        paramTypes.push({ kind: "PrimitiveType", name: "unknown" });
      }
    }

    // Validar return type (7.4)
    if (method.returnType) {
      const err = this.validateTypeNode(method.returnType, method.name);
      if (err) this.errors.push(err);
    }

    const returnType = method.returnType || { kind: "PrimitiveType", name: "void" } as TypeNode;

    // Registrar params no fnEnv
    for (const param of method.params) {
      const paramName = param.name.value as string;
      const paramType = param.type || { kind: "PrimitiveType", name: "unknown" } as TypeNode;
      fnEnv.define(paramName, {
        name: paramName,
        type: paramType,
        kind: "parameter",
        mutable: false,
        initialized: true,
        declarationToken: param.name,
      });
    }

    // Verificar corpo
    this.functionDepth++;
    this.currentFunctionReturnType = returnType;
    this.hasReturn = false;
    this.checkBlockStmt(method.body);

    // Verificar return obrigatório
    if (returnType.kind !== "PrimitiveType" || returnType.name !== "void") {
      if (!this.hasReturn) {
        this.errors.push(Errors.missingReturn(method.name));
      }
    }

    // Restaurar escopo
    this.currentEnv = prevEnv;
    this.currentFunctionReturnType = null;
    this.functionDepth--;
  }

  // ── shared helper: define self in struct method/init scope ──
  private defineStructSelf(
    fnEnv: Environment,
    structStmt: Extract<Stmt, { kind: "StructStmt" }>,
    mutable: boolean,
    declToken?: Token,
  ): void {
    const hasStructTypeParams = structStmt.typeParameters && structStmt.typeParameters.length > 0;
    const selfType: TypeNode = hasStructTypeParams
      ? {
          kind: "GenericType",
          name: structStmt.name,
          args: structStmt.typeParameters!.map(tp => ({
            kind: "NamedType",
            name: tp.name,
          }) as TypeNode),
        }
      : { kind: "NamedType", name: structStmt.name } as TypeNode;

    fnEnv.define("self", {
      name: "self",
      type: selfType,
      kind: "parameter",
      mutable,
      initialized: true,
      declarationToken: declToken ?? structStmt.name,
    });
  }

  // ── 10.0 Check struct init constructor ──────────────────────
  private checkStructConstructor(
    structStmt: Extract<Stmt, { kind: "StructStmt" }>,
    initNode: StructConstructor,
  ): void {
    // Criar escopo da função com type params do struct
    const fnEnv = new Environment(this.currentEnv, false);

    // Registrar type params do struct no fnEnv
    if (structStmt.typeParameters) {
      const seen = new Set<string>();
      for (const tp of structStmt.typeParameters) {
        const tpName = tp.name.value as string;
        if (!seen.has(tpName)) {
          seen.add(tpName);
          fnEnv.define(tpName, {
            name: tpName,
            type: { kind: "NamedType", name: tp.name } as TypeNode,
            kind: "typeParam",
            mutable: false,
            initialized: true,
            declarationToken: tp.name,
            constraint: tp.constraint,
          });
        }
      }
    }

    // Reservar escopo
    const prevEnv = this.currentEnv;
    this.currentEnv = fnEnv;

    // self é sempre mutável no init
    this.defineStructSelf(fnEnv, structStmt, true, structStmt.name);

    // Validar tipos dos params
    for (const param of initNode.params) {
      if (param.type) {
        const err = this.validateTypeNode(param.type, param.name);
        if (err) this.errors.push(err);
      }
    }

    // Registrar params no fnEnv
    for (const param of initNode.params) {
      const paramName = param.name.value as string;
      const paramType = param.type || { kind: "PrimitiveType", name: "unknown" } as TypeNode;
      fnEnv.define(paramName, {
        name: paramName,
        type: paramType,
        kind: "parameter",
        mutable: false,
        initialized: true,
        declarationToken: param.name,
      });
    }

    // ── Verificar corpo ──────────────────────────────────────
    this.functionDepth++;
    this.currentFunctionReturnType = { kind: "PrimitiveType", name: "void" };
    this.hasReturn = false;

    // Varredura do corpo: verificar atribuições no escopo raiz
    // Fields with defaults are considered initialized from the start
    const initializedFields = new Set<string>(
      structStmt.fields.filter(f => f.defaultValue).map(f => f.name.value as string)
    );
    this.checkInitBodyStatements(initNode.body.statements, initializedFields, structStmt, initNode);

    // Verificar return com valor
    if (this.hasReturn) {
      // return with value in init is an error — init is always void
    }

    // Restaurar escopo
    this.currentEnv = prevEnv;
    this.currentFunctionReturnType = null;
    this.functionDepth--;

    // ── Verificar campos sem default não inicializados no escopo raiz ──
    const fieldsWithoutDefault = structStmt.fields.filter(f => !f.defaultValue);
    for (const field of fieldsWithoutDefault) {
      const fieldName = field.name.value as string;
      if (!initializedFields.has(fieldName)) {
        this.errors.push(Errors.typeMismatch(
          `property '${fieldName}' has no default value and is not initialized at the root of 'init'`,
          field.name,
        ));
      }
    }
  }

  // ── helper: check self reads before initialization ────
  private checkExprSelfReads(
    expr: Expr,
    initializedFields: Set<string>,
    requiredFieldNames: string[],
    structFieldNames: string[],
  ): void {
    switch (expr.kind) {
      case "Identifier":
        if (expr.name.value === "self") {
          const missing = requiredFieldNames.filter(f => !initializedFields.has(f));
          if (missing.length > 0) {
            this.errors.push(Errors.typeMismatch(
              "'self' used before all properties are initialized",
              expr.name,
            ));
          }
        }
        break;
      case "Member":
        if (expr.object.kind === "Identifier" && expr.object.name.value === "self") {
          const propName = expr.property.name.value as string;
          if (structFieldNames.includes(propName)) {
            if (!initializedFields.has(propName)) {
              this.errors.push(Errors.typeMismatch(
                `property '${propName}' used before initialization`,
                expr.property.name,
              ));
            }
          } else {
            const missing = requiredFieldNames.filter(f => !initializedFields.has(f));
            if (missing.length > 0) {
              this.errors.push(Errors.typeMismatch(
                "'self' used before all properties are initialized",
                expr.property.name,
              ));
            }
          }
        } else {
          this.checkExprSelfReads(expr.object, initializedFields, requiredFieldNames, structFieldNames);
        }
        break;
      case "Call":
        this.checkExprSelfReads(expr.callee, initializedFields, requiredFieldNames, structFieldNames);
        for (const arg of expr.args) {
          this.checkExprSelfReads(arg, initializedFields, requiredFieldNames, structFieldNames);
        }
        break;
      case "Binary":
        this.checkExprSelfReads(expr.left, initializedFields, requiredFieldNames, structFieldNames);
        this.checkExprSelfReads(expr.right, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "Unary":
        this.checkExprSelfReads(expr.right, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "Logical":
        this.checkExprSelfReads(expr.left, initializedFields, requiredFieldNames, structFieldNames);
        this.checkExprSelfReads(expr.right, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "Group":
        this.checkExprSelfReads(expr.expression, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "Assign":
        this.checkExprSelfReads(expr.value, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "Index":
        this.checkExprSelfReads(expr.object, initializedFields, requiredFieldNames, structFieldNames);
        this.checkExprSelfReads(expr.index, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "Array":
        for (const el of expr.elements) {
          this.checkExprSelfReads(el, initializedFields, requiredFieldNames, structFieldNames);
        }
        break;
      case "Object":
        for (const prop of expr.properties) {
          this.checkExprSelfReads(prop.value, initializedFields, requiredFieldNames, structFieldNames);
        }
        break;
      case "Conditional":
        this.checkExprSelfReads(expr.condition, initializedFields, requiredFieldNames, structFieldNames);
        this.checkExprSelfReads(expr.consequent, initializedFields, requiredFieldNames, structFieldNames);
        this.checkExprSelfReads(expr.alternate, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "NullishCoalescing":
        this.checkExprSelfReads(expr.left, initializedFields, requiredFieldNames, structFieldNames);
        this.checkExprSelfReads(expr.right, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "Spread":
        this.checkExprSelfReads(expr.argument, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "New":
        this.checkExprSelfReads(expr.callee, initializedFields, requiredFieldNames, structFieldNames);
        for (const arg of expr.args) {
          this.checkExprSelfReads(arg, initializedFields, requiredFieldNames, structFieldNames);
        }
        break;
      case "NamedArgument":
        this.checkExprSelfReads(expr.value, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "ArrowFunction":
        if (expr.body && typeof expr.body === "object" && "kind" in expr.body) {
          const bodyExpr = expr.body as Expr;
          if (bodyExpr.kind !== "BlockStmt") {
            this.checkExprSelfReads(bodyExpr, initializedFields, requiredFieldNames, structFieldNames);
          }
        }
        break;
      case "Await":
        this.checkExprSelfReads(expr.expression, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "StructLiteral":
        for (const f of expr.fields) {
          this.checkExprSelfReads(f.value, initializedFields, requiredFieldNames, structFieldNames);
        }
        break;
      case "IcexElement":
        for (const attr of expr.attributes) {
          if (typeof attr.value === "object" && attr.value !== null && "kind" in attr.value) {
            this.checkExprSelfReads(attr.value as Expr, initializedFields, requiredFieldNames, structFieldNames);
          }
        }
        for (const child of expr.children) {
          if (child.kind === "IcexExpression") {
            this.checkExprSelfReads(child.expression, initializedFields, requiredFieldNames, structFieldNames);
          } else if (child.kind === "IcexElement") {
            this.checkExprSelfReads(child as any, initializedFields, requiredFieldNames, structFieldNames);
          }
        }
        break;
      default:
        break;
    }
  }

  // ── helper: check statement body for self reads ───────
  private checkStatementSelfReads(
    stmt: Stmt,
    initializedFields: Set<string>,
    requiredFieldNames: string[],
    structFieldNames: string[],
  ): void {
    switch (stmt.kind) {
      case "ExpressionStmt":
        this.checkExprSelfReads(stmt.expression, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "ReturnStmt":
        if (stmt.value) this.checkExprSelfReads(stmt.value, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "VariableStmt":
        if (stmt.initializer) this.checkExprSelfReads(stmt.initializer, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "BlockStmt":
        for (const s of stmt.statements) {
          this.checkStatementSelfReads(s, initializedFields, requiredFieldNames, structFieldNames);
        }
        break;
      case "IfStmt":
        this.checkExprSelfReads(stmt.condition, initializedFields, requiredFieldNames, structFieldNames);
        this.checkStatementSelfReads(stmt.thenBranch, initializedFields, requiredFieldNames, structFieldNames);
        if (stmt.elseBranch) {
          this.checkStatementSelfReads(stmt.elseBranch, initializedFields, requiredFieldNames, structFieldNames);
        }
        break;
      case "WhileStmt":
        this.checkExprSelfReads(stmt.condition, initializedFields, requiredFieldNames, structFieldNames);
        this.checkStatementSelfReads(stmt.body, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "ForStmt":
        if (stmt.initializer) {
          this.checkStatementSelfReads(stmt.initializer, initializedFields, requiredFieldNames, structFieldNames);
        }
        if (stmt.condition) {
          this.checkExprSelfReads(stmt.condition, initializedFields, requiredFieldNames, structFieldNames);
        }
        this.checkExprSelfReads(stmt.update, initializedFields, requiredFieldNames, structFieldNames);
        this.checkStatementSelfReads(stmt.body, initializedFields, requiredFieldNames, structFieldNames);
        break;
      case "IfVariableStmt":
        this.checkExprSelfReads(stmt.initializer, initializedFields, requiredFieldNames, structFieldNames);
        this.checkStatementSelfReads(stmt.thenBranch, initializedFields, requiredFieldNames, structFieldNames);
        if (stmt.elseBranch) {
          this.checkStatementSelfReads(stmt.elseBranch, initializedFields, requiredFieldNames, structFieldNames);
        }
        break;
      default:
        break;
    }
  }

  // ── helper: varrer statements do init body em depth 0 ──────
  private checkInitBodyStatements(
    stmts: Stmt[],
    initializedFields: Set<string>,
    structStmt: Extract<Stmt, { kind: "StructStmt" }>,
    initNode: StructConstructor,
  ): void {
    const structFieldNames = structStmt.fields.map(f => f.name.value as string);
    const requiredFieldNames = structStmt.fields
      .filter(f => !f.defaultValue)
      .map(f => f.name.value as string);
    for (const stmt of stmts) {
      this.checkStatementSelfReads(stmt, initializedFields, requiredFieldNames, structFieldNames);
      switch (stmt.kind) {
        case "ExpressionStmt": {
          const expr = stmt.expression;
          // Detecta self.campo = valor
          if (expr.kind === "Assign" && expr.name.kind === "Member") {
            const member = expr.name as Extract<Expr, { kind: "Member" }>;
            if (member.object.kind === "Identifier" && (member.object.name.value as string) === "self") {
              const fieldName = (member.property.name.value as string);
              initializedFields.add(fieldName);
            }
          }
          this.checkExpressionStmt(stmt);
          break;
        }
        case "ReturnStmt": {
          if (stmt.value) {
            this.errors.push(Errors.invalidReturn(stmt.value.kind === "Literal"
              ? { line: 0, column: 0, type: 0, value: "" } as Token
              : { line: 0, column: 0, type: 0, value: "" } as Token
            ));
          }
          this.hasReturn = true;
          if (stmt.value) this.checkExpression(stmt.value);
          break;
        }
        case "BlockStmt":
          // Bloco aninhado — NÃO conta para initializedFields
          this.checkBlockStmt(stmt);
          break;
        case "IfStmt": {
          this.checkExpression(stmt.condition);
          // then/else branches — NÃO contam para initializedFields
          if (stmt.thenBranch.kind === "BlockStmt") {
            this.checkBlockStmt(stmt.thenBranch);
          } else {
            this.checkInitBodyStatements(
              [stmt.thenBranch], initializedFields, structStmt, initNode
            );
          }
          if (stmt.elseBranch) {
            if (stmt.elseBranch.kind === "BlockStmt") {
              this.checkBlockStmt(stmt.elseBranch);
            } else {
              this.checkInitBodyStatements(
                [stmt.elseBranch], initializedFields, structStmt, initNode
              );
            }
          }
          break;
        }
        case "ForStmt":
        case "WhileStmt":
          // Loops — NÃO contam
          this.checkStatement(stmt);
          break;
        default:
          this.checkStatement(stmt);
      }
    }
  }

  // ── helper: resolve alias and check if it wraps a struct ───
  private unwrapStructFromResolved(
    resolved: TypeNode,
    aliasName: string,
    token: Token,
  ): [Symbol, TypeNode[] | undefined] | null {
    if (resolved.kind === "GenericType") {
      const structName = resolved.name.value as string;
      const structSymbol = this.currentEnv.lookup(structName);
      if (structSymbol && structSymbol.kind === "struct") {
        return [structSymbol, resolved.args];
      }
      return null;
    }
    if (resolved.kind === "NamedType") {
      const structName = resolved.name.value as string;
      const structSymbol = this.currentEnv.lookup(structName);
      if (structSymbol && structSymbol.kind === "struct") {
        return [structSymbol, undefined];
      }
      return null;
    }
    return null;
  }

  // ── 10.0 Handle struct constructor call ─────────────────────
  private handleStructConstructorCall(
    structSymbol: Symbol,
    expr: Extract<Expr, { kind: "Call" }>,
    preResolvedTypeArgs?: TypeNode[],
  ): TypeNode {
    const structName = structSymbol.name;
    const callName = expr.callee.kind === "Identifier" ? expr.callee.name.value as string : structName;
    const token = expr.callee.kind === "Identifier"
      ? expr.callee.name
      : { line: 0, column: 0, type: 0, value: "" } as Token;

    // Determine mode: auto-init vs custom init
    const structFields = structSymbol.fields as StructField[] | undefined;
    const structTypeParams = structSymbol.typeParameters as TypeParameterNode[] | undefined;
    const hasInit = !!structSymbol.init;

    if (!hasInit) {
      // ── AUTO-INIT mode (10.2) ──────────────────────────────
      return this.handleAutoInitConstructor(structSymbol, structFields, structTypeParams, expr, preResolvedTypeArgs, callName, structName, token);
    } else {
      // ── CUSTOM INIT mode (10.6) ────────────────────────────
      return this.handleCustomInitConstructor(structSymbol, structFields, structTypeParams, structSymbol.init, expr, preResolvedTypeArgs, callName, structName, token);
    }
  }

  private handleAutoInitConstructor(
    structSymbol: Symbol,
    structFields: StructField[] | undefined,
    structTypeParams: TypeParameterNode[] | undefined,
    expr: Extract<Expr, { kind: "Call" }>,
    preResolvedTypeArgs: TypeNode[] | undefined,
    callName: string,
    structName: string,
    token: Token,
  ): TypeNode {
    const args = expr.args;

    // Separar named de positional
    const positionalArgs: Expr[] = [];
    const namedArgs: { key: string; value: Expr; keyToken?: Token }[] = [];
    for (const arg of args) {
      if (arg.kind === "NamedArgument") {
        const na = arg as Extract<Expr, { kind: "NamedArgument" }>;
        namedArgs.push({ key: na.key, value: na.value, keyToken: na.keyToken });
      } else {
        positionalArgs.push(arg);
      }
    }

    // (10.2) Erro se positional
    if (positionalArgs.length > 0) {
      this.errors.push(Errors.typeMismatch(
        `positional arguments not allowed in struct constructor. Use named arguments: ${callName}(${structFields ? structFields.map(f => `${f.name.value}: value`).join(", ") : "field: value"})`,
        token,
      ));
      // Still check expressions to avoid cascade
      for (const a of positionalArgs) this.checkExpression(a);
      for (const na of namedArgs) this.checkExpression(na.value);
      return { kind: "NamedType", name: { type: TokenType.IDENTIFIER, value: callName } } as TypeNode;
    }

    if (!structFields) {
      // No fields, nothing to validate
      return { kind: "NamedType", name: { type: TokenType.IDENTIFIER, value: callName } } as TypeNode;
    }

    // ── Handle generic type args ──────────────────────────
    let typeArgs: TypeNode[] | undefined = preResolvedTypeArgs ?? expr.typeArgs;
    let typeArgMap = new Map<string, TypeNode>();

    if (structTypeParams && structTypeParams.length > 0) {
      if (!typeArgs || typeArgs.length !== structTypeParams.length) {
        // Try inference from named arg values
        const inferenceResult = this.inferStructTypeArgsFromNamedArgs(
          structTypeParams, structFields, namedArgs,
        );
        if (inferenceResult) {
          if (inferenceResult.conflicts.length > 0) {
            for (const c of inferenceResult.conflicts) {
              this.errors.push(Errors.typeMismatch(
                `conflicting types for '${c.param}': inferred '${this.typeToString(c.existing)}' and '${this.typeToString(c.conflict)}'`,
                token,
              ));
            }
            typeArgs = inferenceResult.typeArgs;
          } else if (inferenceResult.unresolved.length > 0) {
            for (const u of inferenceResult.unresolved) {
              this.errors.push(Errors.typeMismatch(
                `cannot infer type parameter '${u}' for '${callName}' — provide an explicit annotation: ${callName}<Type>(...)`,
                token,
              ));
            }
            typeArgs = inferenceResult.typeArgs;
          } else {
            typeArgs = inferenceResult.typeArgs;
          }
        }
      }

      if (!typeArgs || typeArgs.length !== structTypeParams.length) {
        this.errors.push(Errors.genericArgCount(
          callName, structTypeParams.length, typeArgs?.length ?? 0, token, "struct"
        ));
        for (const na of namedArgs) this.checkExpression(na.value);
        return {
          kind: "GenericType",
          name: { type: TokenType.IDENTIFIER, value: callName },
          args: structTypeParams.map(() => ({ kind: "PrimitiveType", name: "unknown" })),
        };
      }

      for (let i = 0; i < structTypeParams.length; i++) {
        typeArgMap.set(structTypeParams[i].name.value as string, typeArgs[i]);
      }
    } else if (expr.typeArgs && expr.typeArgs.length > 0) {
      this.errors.push(Errors.typeMismatch(
        `'${callName}' is not a generic struct`,
        token,
      ));
      for (const na of namedArgs) this.checkExpression(na.value);
      return { kind: "NamedType", name: { type: TokenType.IDENTIFIER, value: callName } } as TypeNode;
    }

    // Build field type map with substitution
    const fieldTypeMap = new Map<string, { type: TypeNode; hasDefault: boolean }>();
    for (const f of structFields) {
      const fieldName = f.name.value as string;
      const fieldType = typeArgMap.size > 0 ? this.substitute(f.type, typeArgMap) : f.type;
      fieldTypeMap.set(fieldName, { type: fieldType, hasDefault: !!f.defaultValue });
    }

    // ── Validate named args (10.4) ─────────────────────────
    // 1. Duplicates
    const seenKeys = new Set<string>();
    const providedKeys = new Set<string>();

    for (const na of namedArgs) {
      if (seenKeys.has(na.key)) {
        this.errors.push(Errors.typeMismatch(
          `duplicate argument '${na.key}' in call to '${callName}'`,
          na.keyToken ?? token,
        ));
        continue;
      }
      seenKeys.add(na.key);

      // 2. Unknown
      const fieldInfo = fieldTypeMap.get(na.key);
      if (!fieldInfo) {
        this.errors.push(Errors.typeMismatch(
          `unknown argument '${na.key}' in call to '${callName}'`,
          na.keyToken ?? token,
        ));
        this.checkExpression(na.value);
        continue;
      }
      providedKeys.add(na.key);

      // 4. Type check
      this.contextualType = fieldInfo.type;
      const actualType = this.checkExpression(na.value);
      this.contextualType = null;

      if (!this.areTypesCompatible(fieldInfo.type, actualType)) {
        this.errors.push(Errors.typeMismatch(
          `cannot assign '${this.typeToString(actualType)}' to field '${na.key}' of type '${this.typeToString(fieldInfo.type)}'`,
          na.keyToken ?? token,
        ));
      }
    }

    // 3. Missing required fields
    for (const f of structFields) {
      const fieldName = f.name.value as string;
      if (!providedKeys.has(fieldName) && !fieldTypeMap.get(fieldName)?.hasDefault) {
        this.errors.push(Errors.typeMismatch(
          `missing argument '${fieldName}' in call to '${callName}'`,
          token,
        ));
      }
    }

    // ── Return type (use structName, not callName, for member access) ──
    if (structTypeParams && structTypeParams.length > 0 && typeArgs && typeArgs.length === structTypeParams.length) {
      return {
        kind: "GenericType",
        name: { type: TokenType.IDENTIFIER, value: structName },
        args: [...typeArgs],
      };
    }
    return { kind: "NamedType", name: { type: TokenType.IDENTIFIER, value: structName } } as TypeNode;
  }

  private handleCustomInitConstructor(
    structSymbol: Symbol,
    structFields: StructField[] | undefined,
    structTypeParams: TypeParameterNode[] | undefined,
    initMethod: StructConstructor,
    expr: Extract<Expr, { kind: "Call" }>,
    preResolvedTypeArgs: TypeNode[] | undefined,
    callName: string,
    structName: string,
    token: Token,
  ): TypeNode {
    const args = expr.args;

    // Separar named de positional
    const positionalArgs: Expr[] = [];
    const namedArgs: { key: string; value: Expr; keyToken?: Token }[] = [];
    for (const arg of args) {
      if (arg.kind === "NamedArgument") {
        const na = arg as Extract<Expr, { kind: "NamedArgument" }>;
        namedArgs.push({ key: na.key, value: na.value, keyToken: na.keyToken });
      } else {
        positionalArgs.push(arg);
      }
    }

    // (10.6) Erro se named args em custom init
    if (namedArgs.length > 0) {
      this.errors.push(Errors.typeMismatch(
        `named arguments not allowed in custom init call. Use positional arguments.`,
        namedArgs[0].keyToken ?? token,
      ));
      for (const na of namedArgs) this.checkExpression(na.value);
      for (const a of positionalArgs) this.checkExpression(a);
      return { kind: "NamedType", name: { type: TokenType.IDENTIFIER, value: callName } } as TypeNode;
    }

    // ── Handle generic type args ──────────────────────────
    let typeArgs: TypeNode[] | undefined = preResolvedTypeArgs ?? expr.typeArgs;
    let typeArgMap = new Map<string, TypeNode>();

    if (structTypeParams && structTypeParams.length > 0) {
      if (!typeArgs || typeArgs.length !== structTypeParams.length) {
        // Try inference from positional arg values
        const argTypes: TypeNode[] = [];
        for (const a of positionalArgs) {
          argTypes.push(this.checkExpression(a));
        }
        // Build temporary init function type for inference
        const initFnType: FunctionTypeNode = this.buildInitFunctionType(structTypeParams, initMethod);
        const mapping = this.tryInferTypeArgs(structTypeParams, initFnType.params, argTypes);
        if (mapping) {
          typeArgs = structTypeParams.map(tp => mapping.get(tp.name.value as string) ?? { kind: "PrimitiveType", name: "unknown" });
        }
      }

      if (!typeArgs || typeArgs.length !== structTypeParams.length) {
        this.errors.push(Errors.genericArgCount(
          callName, structTypeParams.length, typeArgs?.length ?? 0, token, "struct"
        ));
        for (const a of positionalArgs) this.checkExpression(a);
        return {
          kind: "GenericType",
          name: { type: TokenType.IDENTIFIER, value: callName },
          args: structTypeParams.map(() => ({ kind: "PrimitiveType", name: "unknown" })),
        };
      }

      for (let i = 0; i < structTypeParams.length; i++) {
        typeArgMap.set(structTypeParams[i].name.value as string, typeArgs[i]);
      }
    }

    // Build substituted init param types
    const initParams = initMethod.params.map(p => ({
      name: p.name,
      type: typeArgMap.size > 0 && p.type ? this.substitute(p.type, typeArgMap) : p.type,
      isRest: p.isRest,
    }));

    // ── Check positional args against init params ─────────
    const hasRest = initParams.length > 0 && initParams[initParams.length - 1].isRest === true;
    const restIndex = hasRest ? initParams.length - 1 : -1;

    // Check arity
    if (hasRest) {
      if (positionalArgs.length < restIndex) {
        this.errors.push(Errors.argumentCountMismatch(
          restIndex, positionalArgs.length, token,
        ));
      }
    } else {
      if (positionalArgs.length !== initParams.length) {
        this.errors.push(Errors.argumentCountMismatch(
          initParams.length, positionalArgs.length, token,
        ));
      }
    }

    // Check each arg
    for (let i = 0; i < positionalArgs.length; i++) {
      let expectedType: TypeNode | null = null;

      if (hasRest && i >= restIndex) {
        const restType = initParams[restIndex].type;
        if (restType) {
          const resolvedRest = this.resolveAlias(restType);
          expectedType = this.isArray(resolvedRest)
            ? this.arrayElement(resolvedRest)
            : resolvedRest.kind === "ArrayType"
              ? resolvedRest.elementType
              : resolvedRest;
        }
      } else if (i < initParams.length) {
        expectedType = initParams[i].type ?? null;
      }

      if (!expectedType) {
        this.checkExpression(positionalArgs[i]);
        continue;
      }

      this.contextualType = expectedType;
      const actualType = this.checkExpression(positionalArgs[i]);
      this.contextualType = null;

      if (!this.areTypesCompatible(expectedType, actualType)) {
        this.errors.push(Errors.typeMismatch(
          `argument ${i + 1}: expected '${this.typeToString(expectedType)}', got '${this.typeToString(actualType)}'`,
          token,
        ));
      }
    }

    // ── Return type (use structName, not callName, for member access) ──
    if (structTypeParams && structTypeParams.length > 0 && typeArgs && typeArgs.length === structTypeParams.length) {
      return {
        kind: "GenericType",
        name: { type: TokenType.IDENTIFIER, value: structName },
        args: [...typeArgs],
      };
    }
    return { kind: "NamedType", name: { type: TokenType.IDENTIFIER, value: structName } } as TypeNode;
  }

  private buildInitFunctionType(
    structTypeParams: TypeParameterNode[],
    initMethod: StructConstructor,
  ): FunctionTypeNode {
    return {
      kind: "FunctionType",
      params: initMethod.params.map(p => ({
        ...(p.type ?? { kind: "PrimitiveType", name: "unknown" } as TypeNode),
        paramName: p.name.value as string,
        isRest: p.isRest,
      })),
      returnType: { kind: "PrimitiveType", name: "void" } as TypeNode,
      typeParameters: structTypeParams.map(tp => ({
        kind: "TypeParameter",
        name: tp.name,
        constraint: tp.constraint,
        default: tp.default,
      })),
    };
  }

  private inferStructTypeArgsFromNamedArgs(
    typeParams: TypeParameterNode[],
    structFields: StructField[],
    namedArgs: { key: string; value: Expr }[],
  ): { typeArgs: TypeNode[]; unresolved: string[]; conflicts: { param: string; existing: TypeNode; conflict: TypeNode }[] } | null {
    if (namedArgs.length === 0) return null;

    const typeParamNames = new Set(typeParams.map(tp => tp.name.value as string));
    const mapping = new Map<string, TypeNode>();
    const conflicts: { param: string; existing: TypeNode; conflict: TypeNode }[] = [];

    const fieldDeclaredTypes = new Map<string, TypeNode>();
    for (const f of structFields) {
      fieldDeclaredTypes.set(f.name.value as string, f.type);
    }

    const unify = (paramType: TypeNode, argType: TypeNode): boolean => {
      if (paramType.kind === "GroupingType") return unify(paramType.type, argType);
      if (argType.kind === "GroupingType") return unify(paramType, argType.type);

      // T — type param direct
      if (paramType.kind === "NamedType") {
        const name = paramType.name.value as string;
        if (typeParamNames.has(name)) {
          const existing = mapping.get(name);
          if (existing) {
            if (!this.areTypesCompatible(existing, argType)) {
              conflicts.push({ param: name, existing, conflict: argType });
            }
            return true;
          }
          mapping.set(name, argType);
        }
        return true;
      }

      // T[] — legacy ArrayType
      if (paramType.kind === "ArrayType") {
        const elemArg = this.isArray(argType)
          ? this.arrayElement(argType as GenericTypeNode)
          : argType.kind === "ArrayType"
            ? argType.elementType
            : null;
        if (elemArg) return unify(paramType.elementType, elemArg);
        return true;
      }

      // GenericType: Box<T>, Array<T>, Optional<T>, etc.
      if (paramType.kind === "GenericType") {
        const paramName = paramType.name.value as string;

        if (paramName === "Array" && paramType.args.length === 1) {
          const elemArg = argType.kind === "ArrayType"
            ? argType.elementType
            : this.isArray(argType)
              ? this.arrayElement(argType as GenericTypeNode)
              : null;
          if (elemArg) return unify(paramType.args[0], elemArg);
        }

        if (paramName === "Optional" && paramType.args.length === 1) {
          const innerArg = argType.kind === "GenericType" && (argType.name.value as string) === "Optional" && argType.args.length === 1
            ? argType.args[0]
            : argType.kind === "NullableType"
              ? argType.type
              : argType.kind === "PrimitiveType" && argType.name === "null"
                ? null
                : argType;
          if (innerArg) return unify(paramType.args[0], innerArg);
          return true;
        }

        if (
          argType.kind === "GenericType" &&
          (argType.name.value as string) === paramName &&
          argType.args.length === paramType.args.length
        ) {
          return paramType.args.every((pa, i) => unify(pa, argType.args[i]));
        }

        return true;
      }

      // T? — NullableType
      if (paramType.kind === "NullableType") {
        const innerArg = argType.kind === "NullableType"
          ? argType.type
          : argType.kind === "PrimitiveType" && argType.name === "null"
            ? null
            : argType;
        if (innerArg) return unify(paramType.type, innerArg);
        return true;
      }

      // UnionType — try each member
      if (paramType.kind === "UnionType") {
        return paramType.types.some(pt => unify(pt, argType));
      }

      return true;
    };

    const savedErrorCount = this.errors.length;

    for (const na of namedArgs) {
      const declaredType = fieldDeclaredTypes.get(na.key);
      if (!declaredType) continue;

      const savedCtx = this.contextualType;
      this.contextualType = null;
      const valueType = this.checkExpression(na.value);
      this.contextualType = savedCtx;

      if (valueType.kind === "PrimitiveType" && valueType.name === "unknown") {
        this.errors.length = savedErrorCount;
        return null;
      }

      if (!unify(declaredType, valueType)) {
        this.errors.length = savedErrorCount;
        return null;
      }
    }

    this.errors.length = savedErrorCount;

    const unresolved: string[] = [];
    const typeArgs: TypeNode[] = [];
    for (const tp of typeParams) {
      const tpName = tp.name.value as string;
      const type = mapping.get(tpName);
      if (!type) {
        unresolved.push(tpName);
        typeArgs.push({ kind: "PrimitiveType", name: "unknown" });
      } else {
        typeArgs.push(type);
      }
    }

    return { typeArgs, unresolved, conflicts };
  }

  private checkAliasSelfReference(type: TypeNode, aliasName: string, token: Token): SemanticError | null {
    if (type.kind === "NamedType" && type.name.value === aliasName) {
      return Errors.circularTypeAlias(aliasName, token);
    }
    if (type.kind === "GenericType" && type.name.value === aliasName) {
      return Errors.circularTypeAlias(aliasName, token);
    }
    for (const child of this.walkTypeNodes(type)) {
      if (child.kind === "NamedType" && child.name.value === aliasName) {
        return Errors.circularTypeAlias(aliasName, token);
      }
      if (child.kind === "GenericType" && child.name.value === aliasName) {
        return Errors.circularTypeAlias(aliasName, token);
      }
    }
    return null;
  }

  private *walkTypeNodes(type: TypeNode): Generator<TypeNode, void, void> {
    switch (type.kind) {
      case "GenericType":
        for (const arg of type.args) {
          yield arg;
          yield* this.walkTypeNodes(arg);
        }
        break;
      case "FunctionType":
        for (const p of type.params) {
          yield p;
          yield* this.walkTypeNodes(p);
        }
        yield type.returnType;
        yield* this.walkTypeNodes(type.returnType);
        break;
      case "UnionType":
        for (const t of type.types) {
          yield t;
          yield* this.walkTypeNodes(t);
        }
        break;
      case "NullableType":
        yield type.type;
        yield* this.walkTypeNodes(type.type);
        break;
      case "TupleType":
        for (const e of type.elements) {
          yield e;
          yield* this.walkTypeNodes(e);
        }
        break;
      case "ArrayType":
        yield type.elementType;
        yield* this.walkTypeNodes(type.elementType);
        break;
      case "GroupingType":
        yield type.type;
        yield* this.walkTypeNodes(type.type);
        break;
    }
  }

  private validateTypeNode(type: TypeNode, token: Token): SemanticError | null {
    if (type.kind === "PrimitiveType") {
      const validPrimitives = ["int", "float", "string", "bool", "void", "null", "any", "unknown"];
      if (!validPrimitives.includes(type.name)) {
        return Errors.typeMismatch(`primitive type '${type.name}' is not valid. Use: int, float, string, bool, void, null, any, or unknown`, token);
      }
      return null;
    }

    if (type.kind === "NamedType") {
      // Resolve alias before validating
      const resolved = this.resolveAlias(type);
      if (resolved !== type) {
        // É um alias, validar o tipo resolvido
        return this.validateTypeNode(resolved, token);
      }

      const typeName = type.name.value as string;
      const validPrimitives = ["int", "float", "string", "bool", "void", "null", "any", "unknown"];
      if (validPrimitives.includes(typeName)) {
        return null;
      }

      // Verifica no escopo corrente (inclui type params genéricos)
      const existing = this.currentEnv.lookup(typeName);
      if (existing && (existing.kind === "type" || existing.kind === "struct" || existing.kind === "typeParam" || existing.kind === "builtin")) {
        return null;
      }

      return Errors.undefinedType(typeName, token);
    }

    if (type.kind === "GenericType") {
      const typeName = type.name.value as string;
      const validGenerics: Record<string, number> = {
        "List": 1,
        "Map": 2,
        "Set": 1,
        "Promise": 1,
      };
      if (typeName in validGenerics) {
        const expectedArgs = validGenerics[typeName];
        if (type.args.length !== expectedArgs) {
          return Errors.typeMismatch(`Generic '${typeName}' expects ${expectedArgs} parameter(s), got ${type.args.length}`, token);
        }
      } else {
        // Check user-defined generic type alias or built-in generic
        const existing = this.globalEnv.lookup(typeName);
        if (existing?.kind === "type" && existing.typeParameters) {
          if (type.args.length !== existing.typeParameters.length) {
            return Errors.typeMismatch(`Generic type alias '${typeName}' expects ${existing.typeParameters.length} parameter(s), got ${type.args.length}`, token);
          }
        } else if (existing?.kind === "struct") {
          if (existing.typeParameters) {
            // Generic struct: Box<T>
            if (type.args.length !== existing.typeParameters.length) {
              return Errors.typeMismatch(`Generic struct '${typeName}' expects ${existing.typeParameters.length} parameter(s), got ${type.args.length}`, token);
            }
          } else if (type.args.length > 0) {
            // Non-generic struct used with type args
            return Errors.typeMismatch(`'${typeName}' is not a generic struct`, token);
          }
        } else if (existing?.kind === "builtin" && existing.typeParameters) {
          // Built-in generic: Array<T>, Optional<T>
          if (type.args.length !== existing.typeParameters.length) {
            return Errors.typeMismatch(`Built-in generic '${typeName}' expects ${existing.typeParameters.length} parameter(s), got ${type.args.length}`, token);
          }
        } else if (!existing) {
          return Errors.undefinedType(typeName, token);
        }
      }
      for (const arg of type.args) {
        const argError = this.validateTypeNode(arg, token);
        if (argError) return argError;
      }
      return null;
    }

    if (type.kind === "UnionType") {
      for (const member of type.types) {
        const memberError = this.validateTypeNode(member, token);
        if (memberError) return memberError;
      }
      return null;
    }

    if (type.kind === "NullableType") {
      return this.validateTypeNode(type.type, token);
    }

    if (type.kind === "FunctionType") {
      for (const param of type.params) {
        const paramError = this.validateTypeNode(param, token);
        if (paramError) return paramError;
      }
      return this.validateTypeNode(type.returnType, token);
    }

    if (type.kind === "TupleType") {
      for (const element of type.elements) {
        const elementError = this.validateTypeNode(element, token);
        if (elementError) return elementError;
      }
      return null;
    }

    return null;
  }

  private resolveAlias(type: TypeNode, visited?: Map<string, TypeNode>): TypeNode {
    if (type.kind === "GenericType") {
      const name = type.name.value as string;
      const symbol = this.globalEnv.lookup(name);
      if (symbol?.kind === "type" && symbol.typeParameters && symbol.typeParameters.length > 0) {
        visited = visited ?? new Map();
        const key = `${name}<${JSON.stringify(type.args)}>`;
        const entry = visited.get(key);
        if (entry) return entry;
        visited.set(key, type);
        const mapping = new Map<string, TypeNode>();
        for (let i = 0; i < symbol.typeParameters.length; i++) {
          const tpName = symbol.typeParameters[i].name.value as string;
          const arg = type.args[i] ?? { kind: "NamedType", name: { type: 0 as any, value: tpName, line: 0, column: 0 } };
          mapping.set(tpName, arg);
        }
        return this.resolveAlias(this.substitute(symbol.type, mapping), visited);
      }
      return type;
    }

    // Só resolve se for NamedType
    if (type.kind !== "NamedType") return type;

    const name = type.name.value as string;
    const symbol = this.globalEnv.lookup(name);

    // Só expande se for alias (kind: "type") — structs/enums não expandem
    if (symbol?.kind === "type") {
      if (symbol.typeParameters && symbol.typeParameters.length > 0) {
        // Generic alias used without type args — use defaults or leave as-is
        return type;
      }
      visited = visited ?? new Map();
      const key = name;
      if (visited.has(key)) return type;
      visited.set(key, type);
      return this.resolveAlias(symbol.type, visited);
    }

    return type;
  }

  private areTypesCompatible(expected: TypeNode, actual: TypeNode): boolean {
    // Resolve aliases antes de qualquer comparação
    const resolvedExpected = this.resolveAlias(expected);
    const resolvedActual = this.resolveAlias(actual);

    // ── Normaliza Optional<T> → NullableType ─────────────────
    const normExpected = this.normalizeType(resolvedExpected);
    const normActual = this.normalizeType(resolvedActual);

    if (normExpected !== resolvedExpected || normActual !== resolvedActual) {
      return this.areTypesCompatible(normExpected, normActual);
    }

    // Se ambos mudaram, reentrar com os resolvidos
    if (resolvedExpected !== expected || resolvedActual !== actual) {
      return this.areTypesCompatible(resolvedExpected, resolvedActual);
    }

    // any é top type: aceita qualquer coisa onde any é esperado, mas não o contrário
    if (resolvedExpected.kind === "PrimitiveType" && resolvedExpected.name === "any") return true;

    if (resolvedExpected.kind === "PrimitiveType" && resolvedActual.kind === "PrimitiveType") {
      // unknown no expected aceita qualquer actual
      if (resolvedExpected.name === "unknown") {
        return true;
      }
      // unknown no actual NÃO passa automaticamente
      // Numeric widening: int → float
      if (resolvedExpected.name === "float" && resolvedActual.name === "int") return true;
      return resolvedExpected.name === resolvedActual.name;
    }

    // ── ArrayType legado (transição) ─────────────────────────
    if (expected.kind === "ArrayType" && actual.kind === "ArrayType") {
      return this.areTypesCompatible(expected.elementType, actual.elementType);
    }

    // ── GenericType canônico (Array<T>, Map<K,V>, etc.) ─────
    if (expected.kind === "GenericType" && actual.kind === "GenericType") {
      if ((expected.name.value as string) !== (actual.name.value as string)) return false;
      if (expected.args.length !== actual.args.length) return false;
      // Array<T> é mutável → invariante (checa ambos os lados)
      if ((expected.name.value as string) === "Array") {
        return expected.args.every((arg, i) =>
          this.areTypesCompatible(arg, actual.args[i]) &&
          this.areTypesCompatible(actual.args[i], arg)
        );
      }
      return expected.args.every((arg, i) => this.areTypesCompatible(arg, actual.args[i]));
    }

    // ── Compat cross: ArrayType ↔ GenericType<Array> (transição) ──
    if (expected.kind === "ArrayType" && this.isArray(actual)) {
      return this.areTypesCompatible(expected.elementType, this.arrayElement(actual));
    }
    if (this.isArray(expected) && actual.kind === "ArrayType") {
      return this.areTypesCompatible(this.arrayElement(expected), actual.elementType);
    }

    if (expected.kind === "GroupingType") {
      return this.areTypesCompatible(expected.type, actual);
    }

    if (actual.kind === "GroupingType") {
      return this.areTypesCompatible(expected, actual.type);
    }

    if (expected.kind === "FunctionType" && actual.kind === "FunctionType") {
      const expectedIsUnknown = expected.params.every(p => p.kind === "PrimitiveType" && p.name === "unknown") &&
        expected.returnType.kind === "PrimitiveType" && expected.returnType.name === "unknown";
      const actualIsUnknown = actual.params.every(p => p.kind === "PrimitiveType" && p.name === "unknown") &&
        actual.returnType.kind === "PrimitiveType" && actual.returnType.name === "unknown";
      if (expectedIsUnknown || actualIsUnknown) {
        return true;
      }
      if (expected.params.length !== actual.params.length) return false;
      return expected.params.every((ep, i) => this.areTypesCompatible(actual.params[i], ep)) &&
        this.areTypesCompatible(expected.returnType, actual.returnType);
    }

    if (expected.kind === "UnionType") {
      if (actual.kind === "UnionType") {
        return actual.types.every((actualMember) =>
          expected.types.some((expectedMember) =>
            this.areTypesCompatible(expectedMember, actualMember)
          )
        );
      }
      return expected.types.some((member) =>
        this.areTypesCompatible(member, actual)
      );
    }

    if (expected.kind === "NullableType") {
      if (actual.kind === "PrimitiveType" && actual.name === "null") return true;
      if (actual.kind === "PrimitiveType" && actual.name === "unknown") return true;
      if (actual.kind === "UnionType") {
        return actual.types.every((member) => this.areTypesCompatible(expected, member));
      }
      if (actual.kind === "NullableType") {
        return this.areTypesCompatible(expected.type, actual.type);
      }
      return this.areTypesCompatible(expected.type, actual);
    }
    if (actual.kind === "NullableType") {
      return this.areTypesCompatible(expected, actual.type) ||
             this.areTypesCompatible(expected, { kind: "PrimitiveType", name: "null" });
    }

    // Same NamedType (inclui type params como T) são compatíveis
    if (expected.kind === "NamedType" && actual.kind === "NamedType") {
      return (expected.name.value as string) === (actual.name.value as string);
    }

    if (expected.kind === "TupleType" && actual.kind === "TupleType") {
      if (expected.elements.length !== actual.elements.length) return false;
      return expected.elements.every((e, i) => this.areTypesCompatible(e, actual.elements[i]));
    }

    // Tuple vs Array — ambos os lados (ArrayType legado + GenericType canônico)
    if (expected.kind === "TupleType" && (actual.kind === "ArrayType" || this.isArray(actual))) return false;
    if ((expected.kind === "ArrayType" || this.isArray(expected)) && actual.kind === "TupleType") return false;

    return false;
  }

  private isBoolType(type: TypeNode): boolean {
    if (type.kind === "PrimitiveType" && type.name === "bool") {
      return true;
    }
    return false;
  }

  private typeToString(type: TypeNode): string {
    // Resolve aliases before converting to string
    const resolved = this.resolveAlias(type);
    if (resolved !== type) {
      return this.typeToString(resolved);
    }

    switch (type.kind) {
      case "PrimitiveType":
        return type.name;
      case "NamedType":
        return type.name.value as string;
      case "ArrayType":
        const elemStr = this.typeToString(type.elementType);
        const needsParens = type.elementType.kind === "UnionType" || type.elementType.kind === "FunctionType";
        const suffix = "[]".repeat(type.dimensions);
        return `${needsParens ? `(${elemStr})` : elemStr}${suffix}`;
      case "GenericType":
        const typeName = type.name.value as string;
        const args = type.args.map(t => this.typeToString(t)).join(", ");
        // Optional<T> → T? (açúcar na exibição)
        if (typeName === "Optional" && type.args.length === 1) {
          return `${this.typeToString(type.args[0])}?`;
        }
        // Array<T> → T[] (açúcar na exibição)
        if (type.isBuiltin && typeName === "Array" && type.args.length === 1) {
          const inner = this.typeToString(this.arrayElement(type as GenericTypeNode));
          return `${inner}[]`;
        }
        return `${typeName}<${args}>`;
      case "FunctionType":
        const params = type.params.map(p => this.typeToString(p)).join(", ");
        return `(${params}) => ${this.typeToString(type.returnType)}`;
      case "UnionType":
        return type.types.map(t => this.typeToString(t)).join(" | ");
      case "NullableType":
        return `${this.typeToString(type.type)}?`;
      case "TupleType":
        const elements = type.elements.map(t => this.typeToString(t)).join(", ");
        return `[${elements}]`;
      case "GroupingType":
        return `(${this.typeToString(type.type)})`;
      default:
        return "unknown";
    }
  }

  private checkFunctionStmt(stmt: Extract<Stmt, { kind: "FunctionStmt" }>): void {
    const name = stmt.name.value as string;
    const existing = this.currentEnv.lookupLocal(name);

    if (existing) {
      this.errors.push(Errors.alreadyDeclared(name, stmt.name));
      return;
    }

    // ── Criar fnEnv com type params registrados ──────────────
    const fnEnv = new Environment(this.currentEnv, false);

    // Detectar duplicatas e registrar type params
    if (stmt.typeParameters) {
      const seen = new Set<string>();
      for (const tp of stmt.typeParameters) {
        const tpName = tp.name.value as string;
        if (seen.has(tpName)) {
          this.errors.push(Errors.alreadyDeclared(tpName, tp.name));
        } else {
          seen.add(tpName);
          fnEnv.define(tpName, {
            name: tpName,
            type: { kind: "NamedType", name: tp.name },
            kind: "typeParam",
            mutable: false,
            initialized: true,
            declarationToken: tp.name,
            constraint: tp.constraint,
          });
        }
      }
    }

    // ── Entrar no escopo da função (type params visíveis) ────
    const previousEnv = this.currentEnv;
    this.currentEnv = fnEnv;

    // Validar param types (type params como T são visíveis)
    const paramTypes: TypeNode[] = [];
    for (const param of stmt.params) {
      if (param.type) {
        const validationError = this.validateTypeNode(param.type, param.name);
        if (validationError) {
          this.errors.push(validationError);
          paramTypes.push({ kind: "PrimitiveType", name: "unknown" });
        } else {
          paramTypes.push(param.type);
        }
      } else {
        paramTypes.push({ kind: "PrimitiveType", name: "unknown" });
      }
    }

    // Validar return type
    if (stmt.returnType) {
      const returnValidation = this.validateTypeNode(stmt.returnType, stmt.name);
      if (returnValidation) {
        this.errors.push(returnValidation);
      }
    }

    const returnType = stmt.returnType || {
      kind: "PrimitiveType",
      name: "void",
    };

    // Construir FunctionTypeNode com type parameters
    const fnType: FunctionTypeNode = {
      kind: "FunctionType",
      params: paramTypes.map((pt, i) => ({
        ...pt,
        paramName: stmt.params[i]?.name?.value as string,
        isRest: stmt.params[i]?.isRest || false
      })),
      returnType,
      typeParameters: stmt.typeParameters,
    };

    // ── Definir símbolo da função no escopo externo ──────────
    this.currentEnv = previousEnv;
    const symbol = createSymbol(
      name,
      fnType,
      "function",
      false,
      stmt.name
    );
    this.currentEnv.define(name, symbol);
    this.currentEnv = fnEnv;

    // Verificar rest params
    for (let i = 0; i < stmt.params.length; i++) {
      const param = stmt.params[i];
      if (param.isRest) {
        for (let j = i + 1; j < stmt.params.length; j++) {
          this.errors.push(Errors.restNotLast(param.name));
        }
      }
    }

    // Registrar params da função no fnEnv
    for (const param of stmt.params) {
      const paramName = param.name.value as string;
      const paramType = param.type || {
        kind: "PrimitiveType",
        name: "unknown",
      };
      fnEnv.define(paramName, {
        name: paramName,
        type: paramType,
        kind: "parameter",
        mutable: false,
        initialized: true,
        declarationToken: param.name,
      });
    }

    this.functionDepth++;
    this.currentFunctionReturnType = returnType;
    this.hasReturn = false;
    this.checkBlockStmt(stmt.body);
    this.currentEnv = previousEnv;
    this.currentFunctionReturnType = null;

    if (returnType.kind !== "PrimitiveType" || returnType.name !== "void") {
      if (!this.hasReturn) {
        this.errors.push(Errors.missingReturn(stmt.name));
      }
    }

    this.functionDepth--;
  }

  private checkAssignStmt(stmt: Extract<Stmt, { kind: "Assign" }>): void {
    const targetName = stmt.name;

    if (targetName.kind === "Index") {
      this.checkAssignToIndex(targetName, stmt.operator, stmt.value);
      return;
    }

    if (targetName.kind === "Member") {
      this.checkAssignToMember(targetName, stmt.operator, stmt.value);
      return;
    }

    let name: string;
    if (targetName.kind === "Identifier") {
      name = targetName.name.value as string;
    }

    const symbol = this.currentEnv.lookup(name);
    if (!symbol) {
      this.errors.push(Errors.undefinedVariable(name, targetName.name));
      return;
    }

    if (!symbol.mutable) {
      this.errors.push(Errors.cannotAssign(name, targetName.name));
      return;
    }

    // Check compound operators ( +=, -=, *=, /=, %= )
    const operator = stmt.operator?.value as string;
    if (operator && ['+=', '-=', '*=', '/=', '%='].includes(operator)) {
      // For compound assignment, check if target type is numeric
      if (!this.isNumericType(symbol.type)) {
        this.errors.push(Errors.typeMismatch(
          `Cannot use '${operator}' with non-numeric type '${this.typeToString(symbol.type)}'`,
          stmt.operator!
        ));
        return;
      }
    }

    this.contextualType = symbol.type;
    const valueType = this.inferType(stmt.value);
    this.contextualType = null;
    if (!this.areTypesCompatible(symbol.type, valueType)) {
      this.errors.push(Errors.typeMismatch(
        `Cannot assign '${this.typeToString(valueType)}' to '${name}' (${this.typeToString(symbol.type)})`,
        targetName.name
      ));
    }
  }

  private checkBlockStmt(stmt: Extract<Stmt, { kind: "BlockStmt" }>): void {
    const blockEnv = new Environment(this.currentEnv, false);
    const previousEnv = this.currentEnv;
    this.currentEnv = blockEnv;

    for (const innerStmt of stmt.statements) {
      this.checkStatement(innerStmt);
    }

    this.currentEnv = previousEnv;
  }

  private checkIfStmt(stmt: Extract<Stmt, { kind: "IfStmt" }>): void {
    const condType = this.checkExpression(stmt.condition);
    if (!this.isBoolType(condType)) {
      this.errors.push(Errors.invalidCondition(stmt.condition.kind === "Identifier" ? stmt.condition.name : { line: 0, column: 0, type: 0, value: "if" } as Token));
    }
    this.checkStatement(stmt.thenBranch);

    if (stmt.elseBranch) {
      this.checkStatement(stmt.elseBranch);
    }
  }

  private checkIfVariableStmt(stmt: Extract<Stmt, { kind: "IfVariableStmt" }>): void {
    this._checkIfVariableBinding(stmt, null);
  }

  private _checkIfVariableBinding(stmt: IfVariableStmt, sharedEnv: Environment | null): void {
    const isRoot = sharedEnv === null;
    const env = sharedEnv ?? new Environment(this.currentEnv, false);

    const initType = this.checkExpression(stmt.initializer);
    const resolved = this.resolveAlias(initType);
    const normalized = this.normalizeType(resolved);

    let unwrapped: TypeNode | null =
      normalized.kind === "NullableType" ? normalized.type : null;

    if (!unwrapped) {
      this.errors.push(
        Errors.invalidBindingType(stmt.name.value as string, stmt.name),
      );
      unwrapped = normalized;
    }

    if (stmt.type) {
      const resolvedType = this.resolveAlias(stmt.type);
      if (!this.areTypesCompatible(resolvedType, unwrapped)) {
        this.errors.push(
          Errors.typeMismatch(
            `Cannot bind '${stmt.name.value}' with type '${this.typeToString(resolvedType)}' to value of type '${this.typeToString(unwrapped)}'`,
            stmt.name,
          ),
        );
      }
    }

    env.define(
      stmt.name.value as string,
      createSymbol(
        stmt.name.value as string,
        unwrapped,
        "variable",
        stmt.declarationType === "var",
        stmt.name,
      ),
    );

    if (stmt.continuation) {
      this._checkIfVariableBinding(stmt.continuation, env);
    }

    if (isRoot) {
      const prevEnv = this.currentEnv;
      this.currentEnv = env;
      this.checkStatement(stmt.thenBranch);
      this.currentEnv = prevEnv;

      if (stmt.elseBranch) {
        this.checkStatement(stmt.elseBranch);
      }
    }
  }

  private checkWhileStmt(stmt: Extract<Stmt, { kind: "WhileStmt" }>): void {
    const conditionType = this.checkExpression(stmt.condition);
    
    if (conditionType.kind !== "PrimitiveType" || conditionType.name !== "bool") {
      if (stmt.condition.kind !== "Literal" || (stmt.condition as any).value !== true) {
        this.errors.push(Errors.invalidCondition(stmt.condition));
      }
    }

    this.loopDepth++;
    this.checkStatement(stmt.body);
    this.loopDepth--;
  }

  private checkForStmt(stmt: Extract<Stmt, { kind: "ForStmt" }>): void {
    // Save previous environment and create new scope for the entire for loop
    const previousEnv = this.currentEnv;
    this.currentEnv = new Environment(previousEnv, false);

    // Check initializer in the new scope
    if (stmt.initializer) {
      this.checkStatement(stmt.initializer);
    }

    // Check condition
    if (stmt.condition) {
      const conditionType = this.checkExpression(stmt.condition);
      
      if (conditionType.kind !== "PrimitiveType" || conditionType.name !== "bool") {
        // Allow literal 'true' as a valid infinite loop condition
        if (stmt.condition.kind !== "Literal" || (stmt.condition as any).value !== true) {
          this.errors.push(Errors.invalidCondition(stmt.condition));
        }
      }
    }

    // Check update expression
    if (stmt.update && stmt.update.kind !== "Literal") {
      // If update is an assignment (Assign Stmt), check it properly
      if (stmt.update.kind === "Assign") {
        this.checkAssignStmt(stmt.update as any);
      } else {
        // Otherwise treat as expression
        this.checkExpression(stmt.update);
      }
    }

    // Check body
    this.loopDepth++;
    this.checkStatement(stmt.body);
    this.loopDepth--;
    
    // Restore environment
    this.currentEnv = previousEnv;
  }

  private checkBreakStmt(_stmt: Extract<Stmt, { kind: "BreakStmt" }>): void {
    if (this.loopDepth === 0) {
      this.errors.push(Errors.invalidBreak({ line: 0, column: 0, type: 0, value: "break" } as Token));
    }
  }

  private checkContinueStmt(_stmt: Extract<Stmt, { kind: "ContinueStmt" }>): void {
    if (this.loopDepth === 0) {
      this.errors.push(Errors.invalidContinue({ line: 0, column: 0, type: 0, value: "continue" } as Token));
    }
  }

  private checkReturnStmt(stmt: Extract<Stmt, { kind: "ReturnStmt" }>): void {
    if (this.functionDepth === 0) {
      this.errors.push(Errors.invalidReturn({ line: 0, column: 0, type: 0, value: "return" } as Token));
      return;
    }

    this.hasReturn = true;

    if (stmt.value) {
      this.contextualType = this.currentFunctionReturnType;
      const returnValueType = this.checkExpression(stmt.value);
      this.contextualType = null;
      if (this.currentFunctionReturnType) {
        if (!this.areTypesCompatible(this.currentFunctionReturnType, returnValueType)) {
          this.errors.push(Errors.invalidReturnType(
            this.typeToString(this.currentFunctionReturnType),
            this.typeToString(returnValueType),
            this.getExprToken(stmt.value) ?? { line: 0, column: 0, type: 0, value: "" } as Token
          ));
        }
      }
    } else {
      if (this.currentFunctionReturnType) {
        const returnTypeStr = this.typeToString(this.currentFunctionReturnType);
        if (returnTypeStr !== "void") {
          this.errors.push(Errors.invalidReturnType(
            returnTypeStr,
            "void",
            { line: 0, column: 0, type: 0, value: "" } as Token
          ));
        }
      }
    }
  }

  private checkExpressionStmt(stmt: Extract<Stmt, { kind: "ExpressionStmt" }>): void {
    const expr = stmt.expression;
    if (expr.kind === "Assign") {
      this.checkAssignExpr(expr);
      return;
    }
    this.checkExpression(expr);
  }

  private isNumericType(type: TypeNode): boolean {
    if (type.kind === "PrimitiveType") {
      return type.name === "int" || type.name === "float";
    }
    return false;
  }

  private checkAssignExpr(expr: Extract<Expr, { kind: "Assign" }>): void {
    const targetName = expr.name;

    if (targetName.kind === "Index") {
      this.checkAssignToIndex(targetName, expr.operator, expr.value);
      return;
    }

    if (targetName.kind === "Member") {
      this.checkAssignToMember(targetName, expr.operator, expr.value);
      return;
    }

    let name: string;
    if (targetName.kind === "Identifier") {
      name = targetName.name.value as string;
    }

    const symbol = this.currentEnv.lookup(name);
    if (!symbol) {
      this.errors.push(Errors.undefinedVariable(name, targetName.name));
      return;
    }

    if (!symbol.mutable) {
      this.errors.push(Errors.cannotAssign(name, targetName.name));
      return;
    }

    // Check compound operators ( +=, -=, *=, /=, %= )
    const operator = expr.operator?.value as string;
    if (operator && ['+=', '-=', '*=', '/=', '%='].includes(operator)) {
      // For compound assignment, check if target type is numeric
      if (!this.isNumericType(symbol.type)) {
        this.errors.push(Errors.typeMismatch(
          `Cannot use '${operator}' with non-numeric type '${this.typeToString(symbol.type)}'`,
          expr.operator!
        ));
        return;
      }
    }

    this.contextualType = symbol.type;
    const valueType = this.inferType(expr.value);
    this.contextualType = null;
    if (!this.areTypesCompatible(symbol.type, valueType)) {
      this.errors.push(Errors.typeMismatch(
        `Cannot assign '${this.typeToString(valueType)}' to '${name}'`,
        targetName.name
      ));
    }
  }

  private checkAssignToIndex(target: Extract<Expr, { kind: "Index" }>, operator: Token | undefined, value: Expr): void {
    const objectType = this.resolveAlias(this.checkExpression(target.object));
    const savedCtx = this.contextualType;
    this.contextualType = null;
    const indexType = this.checkExpression(target.index);
    this.contextualType = savedCtx;

    const token = this.getExprToken(target.index) ?? this.getExprToken(target.object)
      ?? { type: TokenType.NUMBER, value: 0, line: 0, column: 0 };

    let baseType = this.normalizeType(objectType);
    if (baseType.kind === "NullableType") {
      baseType = baseType.type;
    }

    let elementType: TypeNode | null = null;

    if (this.isArray(baseType)) {
      if (indexType.kind === "PrimitiveType" && indexType.name === "int") {
        elementType = this.arrayElement(baseType);
      } else {
        this.errors.push(Errors.invalidIndex(
          `array index must be int, got ${this.typeToString(indexType)}`,
          token
        ));
        return;
      }
    } else if (baseType.kind === "TupleType") {
      this.errors.push(Errors.tupleImmutable(token));
      return;
    } else {
      this.errors.push(Errors.invalidIndex(
        `type '${this.typeToString(objectType)}' does not support indexing`,
        token
      ));
      return;
    }

    const op = operator?.value as string;
    if (op && ['+=', '-=', '*=', '/=', '%='].includes(op)) {
      if (!this.isNumericType(elementType)) {
        this.errors.push(Errors.typeMismatch(
          `Cannot use '${op}' with non-numeric type '${this.typeToString(elementType)}'`,
          operator!
        ));
        return;
      }
    }

    this.contextualType = elementType;
    const valueType = this.inferType(value);
    this.contextualType = null;

    if (!this.areTypesCompatible(elementType, valueType)) {
      this.errors.push(Errors.typeMismatch(
        `Cannot assign '${this.typeToString(valueType)}' to element of type '${this.typeToString(elementType)}'`,
        token
      ));
    }
  }

  private checkAssignToMember(target: Extract<Expr, { kind: "Member" }>, operator: Token | undefined, value: Expr): void {
    const objectType = this.resolveAlias(this.checkExpression(target.object));
    const propName = target.property.name.value as string;
    const propToken = target.property.name;

    // Check if the object expression refers to a mutable self (mut method → write to any field)
    let objectMutable = false;
    if (target.object.kind === "Identifier") {
      const objName = target.object.name.value as string;
      const objSymbol = this.currentEnv.lookup(objName);
      if (objSymbol) objectMutable = objSymbol.mutable;
    }

    const doAssign = (fieldType: TypeNode, fieldMutable: boolean) => {
      if (operator) {
        const op = operator.value as string;
        if (['+=', '-=', '*=', '/=', '%='].includes(op)) {
          if (!this.isNumericType(fieldType)) {
            this.errors.push(Errors.typeMismatch(
              `Cannot use '${op}' with non-numeric field '${propName}' of type '${this.typeToString(fieldType)}'`,
              operator
            ));
            return;
          }
        }
      }
      if (!fieldMutable && !objectMutable) {
        this.errors.push(Errors.cannotAssignToField(propName, propToken));
        return;
      }
      this.contextualType = fieldType;
      const valueType = this.inferType(value);
      this.contextualType = null;
      if (!this.areTypesCompatible(fieldType, valueType)) {
        this.errors.push(Errors.typeMismatch(
          `Cannot assign '${this.typeToString(valueType)}' to field '${propName}' of type '${this.typeToString(fieldType)}'`,
          propToken
        ));
      }
    };

    if (objectType.kind === "NamedType") {
      const typeName = objectType.name.value as string;
      const symbol = this.currentEnv.lookup(typeName);
      if (symbol?.kind === "struct" && symbol.fields) {
        const field = symbol.fields.find(f => f.name.value === propName);
        if (!field) {
          this.errors.push(Errors.unknownProperty(propName, propToken));
          return;
        }
        doAssign(field.type, field.mutable);
        return;
      }
    }

    if (objectType.kind === "GenericType") {
      const typeName = objectType.name.value as string;
      const symbol = this.currentEnv.lookup(typeName);
      if (symbol?.kind === "struct" && symbol.fields) {
        const field = symbol.fields.find(f => f.name.value === propName);
        if (!field) {
          this.errors.push(Errors.unknownProperty(propName, propToken));
          return;
        }
        let fieldType = field.type;
        if (symbol.typeParameters && symbol.typeParameters.length > 0) {
          const mapping = new Map<string, TypeNode>();
          for (let i = 0; i < symbol.typeParameters.length; i++) {
            const arg = objectType.args[i] ?? { kind: "NamedType", name: { type: TokenType.IDENTIFIER, value: symbol.typeParameters[i].name.value, line: 0, column: 0 } };
            mapping.set(symbol.typeParameters[i].name.value as string, arg);
          }
          fieldType = this.substitute(field.type, mapping);
        }
        doAssign(fieldType, field.mutable);
        return;
      }
    }

    this.errors.push(Errors.invalidMemberAccess(
      `cannot assign to member on non-struct type`,
      propToken
    ));
  }

  private checkExpression(expr: Expr): TypeNode {
    const result = this.checkExpressionImpl(expr);
    this.resolvedTypes.set(expr, result);
    return result;
  }

  private checkExpressionImpl(expr: Expr): TypeNode {
    switch (expr.kind) {
      case "Identifier": {
        const name = expr.name.value as string;
        const symbol = this.currentEnv.lookup(name);
        if (!symbol) {
          this.errors.push(Errors.undefinedVariable(name, expr.name));
          return { kind: "PrimitiveType", name: "unknown" };
        }
        return symbol.type;
      }
      case "Literal":
        return this.inferLiteralType(expr);
      case "Binary":
        return this.checkBinaryExpr(expr);
      case "Unary":
        return this.checkUnaryExpr(expr);
      case "Logical":
        return this.checkLogicalExpr(expr);
      case "Call":
        return this.checkCallExpr(expr);
      case "Member":
        return this.checkMemberExpr(expr);
      case "Index":
        return this.checkIndexExpr(expr);
      case "Array":
        return this.checkArrayExpr(expr);
      case "Object":
        return this.checkObjectExpr(expr);
      case "Conditional":
        return this.checkConditionalExpr(expr);
      case "NullishCoalescing":
        return this.checkNullishCoalescingExpr(expr);
      case "ArrowFunction":
        return this.checkArrowFunctionExpr(expr);
      case "Spread":
        return this.checkSpreadExpr(expr);
      case "Group":
        return this.checkExpression(expr.expression);
      case "StructLiteral":
        return this.checkStructLiteralExpr(expr);
      case "NamedArgument":
        return this.checkExpression((expr as Extract<Expr, { kind: "NamedArgument" }>).value);
      default:
        return { kind: "PrimitiveType", name: "unknown" };
    }
  }

  private checkStructLiteralExpr(expr: StructLiteralExpr): TypeNode {
    const name = expr.structName.value as string;
    let symbol = this.currentEnv.lookup(name);

    if (!symbol) {
      this.errors.push(Errors.undefinedType(name, expr.structName));
      return { kind: "PrimitiveType", name: "unknown" };
    }

    // ── Resolve type aliases (e.g. IntBox = Box<int>) ─────
    let resolvedTypeArgs: TypeNode[] | undefined;
    let resolvedStructName: string | undefined;

    if (symbol.kind === "type") {
      const resolved = this.resolveAlias({ kind: "NamedType", name: expr.structName });
      if (resolved.kind === "GenericType") {
        const structName = resolved.name.value as string;
        const structSymbol = this.currentEnv.lookup(structName);
        if (!structSymbol || structSymbol.kind !== "struct") {
          this.errors.push(Errors.typeMismatch(
            `'${name}' does not resolve to a struct`, expr.structName
          ));
          return { kind: "PrimitiveType", name: "unknown" };
        }
        symbol = structSymbol;
        resolvedStructName = structName;
        resolvedTypeArgs = resolved.args;
      } else if (resolved.kind === "NamedType") {
        const structName = resolved.name.value as string;
        const structSymbol = this.currentEnv.lookup(structName);
        if (!structSymbol || structSymbol.kind !== "struct") {
          this.errors.push(Errors.typeMismatch(
            `'${name}' does not resolve to a struct`, expr.structName
          ));
          return { kind: "PrimitiveType", name: "unknown" };
        }
        symbol = structSymbol;
        resolvedStructName = structName;
      } else {
        this.errors.push(Errors.typeMismatch(
          `'${name}' is not a struct type`, expr.structName
        ));
        return { kind: "PrimitiveType", name: "unknown" };
      }
    } else if (symbol.kind !== "struct") {
      this.errors.push(Errors.typeMismatch(
        `'${name}' is not a struct type`,
        expr.structName
      ));
      return { kind: "PrimitiveType", name: "unknown" };
    }

    const structFields = symbol.fields;
    if (!structFields) return symbol.type;

    // ── Generic struct: build substitution mapping ────────
    let fieldTypeMap: Map<string, TypeNode>;
    const typeParams = symbol.typeParameters;
    let typeArgs: TypeNode[] | undefined = resolvedTypeArgs ?? expr.typeArgs;

    if (typeParams && typeParams.length > 0) {
      if (!typeArgs) {
        // Try type inference from literal field values: Box { value: 42 } → T = int
        const inferred = this.inferStructTypeArgs(typeParams, structFields, expr.fields);
        if (inferred) {
          typeArgs = inferred;
        }
      }
      if (!typeArgs || typeArgs.length !== typeParams.length) {
        this.errors.push(Errors.genericArgCount(
          resolvedStructName ?? name, typeParams.length, typeArgs?.length ?? 0, expr.structName, "struct"
        ));
        return { kind: "PrimitiveType", name: "unknown" };
      }
      // Validate each type arg
      for (const arg of typeArgs) {
        const argErr = this.validateTypeNode(arg, expr.structName);
        if (argErr) this.errors.push(argErr);
      }
      const mapping = new Map<string, TypeNode>();
      for (let i = 0; i < typeParams.length; i++) {
        mapping.set(typeParams[i].name.value as string, typeArgs[i]);
      }
      fieldTypeMap = new Map();
      for (const f of structFields) {
        fieldTypeMap.set(f.name.value as string, this.substitute(f.type, mapping));
      }
    } else {
      if (expr.typeArgs && expr.typeArgs.length > 0) {
        this.errors.push(Errors.typeMismatch(
          `'${resolvedStructName ?? name}' is not a generic struct`,
          expr.structName
        ));
        return { kind: "PrimitiveType", name: "unknown" };
      }
      fieldTypeMap = new Map();
      for (const f of structFields) {
        fieldTypeMap.set(f.name.value as string, f.type);
      }
    }

    // ── Validate literal fields against (substituted) field types ──
    const seenKeys = new Set<string>();

    for (const field of expr.fields) {
      if (seenKeys.has(field.key)) {
        this.errors.push(Errors.alreadyDeclared(field.key, expr.structName));
        continue;
      }
      seenKeys.add(field.key);

      const expectedType = fieldTypeMap.get(field.key);
      if (!expectedType) {
        this.errors.push(Errors.unknownProperty(field.key, expr.structName));
        continue;
      }

      this.contextualType = expectedType;
      const actualType = this.checkExpression(field.value);
      this.contextualType = null;

      if (!this.areTypesCompatible(expectedType, actualType)) {
        const valueToken = this.getExprToken(field.value) ?? expr.structName;
        this.errors.push(Errors.typeMismatch(
          `field '${field.key}': expected '${this.typeToString(expectedType)}', got '${this.typeToString(actualType)}'`,
          valueToken
        ));
      }
    }

    for (const f of structFields) {
      const fieldName = f.name.value as string;
      if (!seenKeys.has(fieldName) && !f.defaultValue) {
        this.errors.push(Errors.typeMismatch(
          `missing required field '${fieldName}' in struct literal for '${resolvedStructName ?? name}'`,
          expr.structName
        ));
      }
    }

    // If generic, return GenericType so member access can do substitution
    const returnName = resolvedStructName ?? name;
    if (typeParams && typeParams.length > 0 && typeArgs && typeArgs.length === typeParams.length) {
      return {
        kind: "GenericType",
        name: { type: TokenType.IDENTIFIER, value: returnName },
        args: [...typeArgs]
      };
    }
    return symbol.type;
  }

  private inferStructTypeArgs(
    typeParams: TypeParameterNode[],
    structFields: StructField[],
    literalFields: { key: string; value: Expr }[]
  ): TypeNode[] | null {
    if (literalFields.length === 0) return null;

    const typeParamNames = new Set(typeParams.map(tp => tp.name.value as string));
    const mapping = new Map<string, TypeNode>();

    const fieldDeclaredTypes = new Map<string, TypeNode>();
    for (const f of structFields) {
      fieldDeclaredTypes.set(f.name.value as string, f.type);
    }

    // Suppress errors during inference — they'll be caught in normal validation
    const savedErrorCount = this.errors.length;

    const unify = (paramType: TypeNode, argType: TypeNode): boolean => {
      if (paramType.kind === "GroupingType") return unify(paramType.type, argType);
      if (argType.kind === "GroupingType") return unify(paramType, argType.type);

      // T — type param direto
      if (paramType.kind === "NamedType") {
        const name = paramType.name.value as string;
        if (typeParamNames.has(name)) {
          const existing = mapping.get(name);
          if (existing) {
            // Já tem binding — verifica compatibilidade
            return this.areTypesCompatible(existing, argType);
          }
          mapping.set(name, argType);
        }
        return true;
      }

      // T[] — ArrayType legacy
      if (paramType.kind === "ArrayType") {
        const elemArg = this.isArray(argType)
          ? this.arrayElement(argType as GenericTypeNode)
          : argType.kind === "ArrayType"
            ? argType.elementType
            : null;
        if (elemArg) return unify(paramType.elementType, elemArg);
        return true;
      }

      // Array<T> / Optional<T> etc — GenericType
      if (paramType.kind === "GenericType") {
        const paramName = paramType.name.value as string;

        if (paramName === "Array" && paramType.args.length === 1) {
          const elemArg = argType.kind === "ArrayType"
            ? argType.elementType
            : this.isArray(argType)
              ? this.arrayElement(argType as GenericTypeNode)
              : null;
          if (elemArg) return unify(paramType.args[0], elemArg);
        }

        if (paramName === "Optional" && paramType.args.length === 1) {
          const innerArg = argType.kind === "GenericType" && (argType.name.value as string) === "Optional" && argType.args.length === 1
            ? argType.args[0]
            : argType.kind === "NullableType"
              ? argType.type
              : argType.kind === "PrimitiveType" && argType.name === "null"
                ? null
                : argType;
          if (innerArg) return unify(paramType.args[0], innerArg);
          return true;
        }

        if (
          argType.kind === "GenericType" &&
          (argType.name.value as string) === paramName &&
          argType.args.length === paramType.args.length
        ) {
          return paramType.args.every((pa, i) => unify(pa, argType.args[i]));
        }
        return true;
      }

      return true;
    };

    for (const field of literalFields) {
      const declaredType = fieldDeclaredTypes.get(field.key);
      if (!declaredType) continue;

      const savedCtx = this.contextualType;
      this.contextualType = null;
      const valueType = this.checkExpression(field.value);
      this.contextualType = savedCtx;

      if (valueType.kind === "PrimitiveType" && valueType.name === "unknown") {
        // Value has errors — can't infer from it
        this.errors.length = savedErrorCount;
        return null;
      }

      if (!unify(declaredType, valueType)) {
        this.errors.length = savedErrorCount;
        return null;
      }
    }

    // Verify all type params have been resolved
    const result: TypeNode[] = [];
    for (const tp of typeParams) {
      const type = mapping.get(tp.name.value as string);
      if (!type) {
        this.errors.length = savedErrorCount;
        return null;
      }
      result.push(type);
    }

    this.errors.length = savedErrorCount;
    return result;
  }

  private inferType(expr: Expr): TypeNode {
    return this.checkExpression(expr);
  }

  private inferLiteralType(expr: Extract<Expr, { kind: "Literal" }>): TypeNode {
    const value = expr.value;
    if (value === null) {
      return { kind: "PrimitiveType", name: "null" };
    }
    if (typeof value === "number") {
      const ctxResolved = this.contextualType ? this.resolveAlias(this.contextualType) : null;
      if (ctxResolved?.kind === "PrimitiveType" && ctxResolved.name === "float") {
        return { kind: "PrimitiveType", name: "float" };
      }
      return {
        kind: "PrimitiveType",
        name: expr.isFloat ? "float" : (Number.isInteger(value) ? "int" : "float"),
      };
    }
    if (typeof value === "string") {
      return { kind: "PrimitiveType", name: "string" };
    }
    if (typeof value === "boolean") {
      return { kind: "PrimitiveType", name: "bool" };
    }
    return { kind: "PrimitiveType", name: "unknown" };
  }

  private checkBinaryExpr(expr: Extract<Expr, { kind: "Binary" }>): TypeNode {
    const leftType = this.resolveAlias(this.checkExpression(expr.left));
    const rightType = this.resolveAlias(this.checkExpression(expr.right));

    const op = expr.operator.value as string;

    if (op === "+") {
      if (
        leftType.kind === "PrimitiveType" &&
        rightType.kind === "PrimitiveType"
      ) {
        if (
          (leftType.name === "int" || leftType.name === "float") &&
          (rightType.name === "int" || rightType.name === "float")
        ) {
          return leftType.name === "int" && rightType.name === "int"
            ? { kind: "PrimitiveType", name: "int" }
            : { kind: "PrimitiveType", name: "float" };
        }
        if (leftType.name === "string" && rightType.name === "string") {
          return { kind: "PrimitiveType", name: "string" };
        }
      }
      this.errors.push(Errors.typeMismatch(`invalid operands for operator '${op}'`, expr.operator));
      return { kind: "PrimitiveType", name: "string" };
    }

    if (["-", "*", "/", "%"].includes(op)) {
      if (
        leftType.kind === "PrimitiveType" &&
        rightType.kind === "PrimitiveType" &&
        (leftType.name === "int" || leftType.name === "float") &&
        (rightType.name === "int" || rightType.name === "float")
      ) {
        return leftType.name === "int" && rightType.name === "int"
          ? { kind: "PrimitiveType", name: "int" }
          : { kind: "PrimitiveType", name: "float" };
      }
      this.errors.push(Errors.typeMismatch(`invalid operands for operator '${op}'`, expr.operator));
      return { kind: "PrimitiveType", name: "bool" };
    }

    if (["<", ">", "<=", ">="].includes(op)) {
      if (
        leftType.kind === "PrimitiveType" &&
        rightType.kind === "PrimitiveType"
      ) {
        const leftIsNum = leftType.name === "int" || leftType.name === "float";
        const rightIsNum = rightType.name === "int" || rightType.name === "float";
        const bothStrings = leftType.name === "string" && rightType.name === "string";
        if ((leftIsNum && rightIsNum) || bothStrings) {
          return { kind: "PrimitiveType", name: "bool" };
        }
      }
      this.errors.push(Errors.typeMismatch(`invalid operands for operator '${op}'`, expr.operator));
      return { kind: "PrimitiveType", name: "bool" };
    }

    if (["&&", "||"].includes(op)) {
      if (
        leftType.kind === "PrimitiveType" &&
        leftType.name === "bool" &&
        rightType.kind === "PrimitiveType" &&
        rightType.name === "bool"
      ) {
        return { kind: "PrimitiveType", name: "bool" };
      }
      this.errors.push(Errors.typeMismatch("logical operators require boolean operands", expr.operator));
      return { kind: "PrimitiveType", name: "bool" };
    }

    if (["==", "!="].includes(op)) {
      if (!this.areTypesCompatible(leftType, rightType) &&
          !this.areTypesCompatible(rightType, leftType)) {
        this.errors.push(Errors.typeMismatch(
          `incompatible types for operator '${op}': '${this.typeToString(leftType)}' and '${this.typeToString(rightType)}'`,
          expr.operator
        ));
      }
      return { kind: "PrimitiveType", name: "bool" };
    }

    return { kind: "PrimitiveType", name: "bool" };
  }

  private checkUnaryExpr(expr: Extract<Expr, { kind: "Unary" }>): TypeNode {
    const operandType = this.resolveAlias(this.checkExpression(expr.right));
    const op = expr.operator.value as string;

    if (op === "-" || op === "+") {
      if (
        operandType.kind === "PrimitiveType" &&
        (operandType.name === "int" || operandType.name === "float")
      ) {
        return operandType;
      }
      this.errors.push(Errors.invalidUnary(op, expr.operator));
    }

    if (op === "++" || op === "--") {
      // Check if target is an Identifier
      if (expr.right.kind === "Identifier") {
        const name = expr.right.name.value as string;
        const symbol = this.currentEnv.lookup(name);

        if (!symbol) {
          this.errors.push(Errors.undefinedVariable(name, expr.right.name));
          return { kind: "PrimitiveType", name: "unknown" };
        }

        if (!symbol.mutable) {
          this.errors.push(Errors.cannotAssign(name, expr.right.name));
          return symbol.type;
        }

        // Check numeric type (not bool for ++/--)
        if (
          this.resolveAlias(symbol.type).kind === "PrimitiveType" &&
          (this.resolveAlias(symbol.type).name === "int" || this.resolveAlias(symbol.type).name === "float")
        ) {
          return symbol.type;
        }

        this.errors.push(Errors.invalidUnary(op, expr.operator));
      } else {
        this.errors.push(Errors.invalidUnary(op, expr.operator));
      }
      return { kind: "PrimitiveType", name: "unknown" };
    }

    if (op === "!") {
      if (
        operandType.kind === "PrimitiveType" &&
        operandType.name === "bool"
      ) {
        return operandType;
      }
      this.errors.push(Errors.invalidUnary(op, expr.operator));
    }

    return { kind: "PrimitiveType", name: "unknown" };
  }

  private checkLogicalExpr(expr: Extract<Expr, { kind: "Logical" }>): TypeNode {
    const leftType = this.checkExpression(expr.left);
    const rightType = this.checkExpression(expr.right);

    if (
      leftType.kind === "PrimitiveType" &&
      leftType.name === "bool" &&
      rightType.kind === "PrimitiveType" &&
      rightType.name === "bool"
    ) {
      return { kind: "PrimitiveType", name: "bool" };
    }

    this.errors.push(Errors.typeMismatch("logical operators require boolean operands", { line: 0, column: 0, type: 0, value: "" } as Token));

    return { kind: "PrimitiveType", name: "bool" };
  }

private checkCallExpr(expr: Extract<Expr, { kind: "Call" }>): TypeNode {
    // ── Struct constructor call detection ──────────────────────
    // Se o callee é um identificador que resolve para struct ou type alias de struct
    if (expr.callee.kind === "Identifier") {
      const calleeName = expr.callee.name.value as string;
      const symbol = this.currentEnv.lookup(calleeName);
      if (symbol) {
        if (symbol.kind === "struct") {
          return this.handleStructConstructorCall(symbol, expr);
        }
        if (symbol.kind === "type") {
          const resolved = this.resolveAlias({ kind: "NamedType", name: expr.callee.name });
          const structInfo = this.unwrapStructFromResolved(resolved, calleeName, expr.callee.name);
          if (structInfo) {
            const [structSymbol, typeArgs] = structInfo;
            return this.handleStructConstructorCall(structSymbol, expr, typeArgs);
          }
        }
      }
    }

    const calleeType = this.resolveAlias(
      this.unwrapGrouping(this.checkExpression(expr.callee))
    );

    // callee não é função
    if (calleeType.kind !== "FunctionType") {
      // se for "any" ou "unknown", deixa passar sem checar args
      if (calleeType.kind === "PrimitiveType" &&
         (calleeType.name === "any" || calleeType.name === "unknown")) {
        expr.args.forEach(arg => this.checkExpression(arg));
        return { kind: "PrimitiveType", name: "any" };
      }
      const token = expr.callee.kind === "Identifier"
        ? expr.callee.name
        : { line: 0, column: 0, type: 0, value: "" } as Token;
      this.errors.push(Errors.invalidCall(token));
      return { kind: "PrimitiveType", name: "any" };
    }

    // ── Tratamento de chamadas genéricas ─────────────────────
    const typeParams = calleeType.typeParameters;
    let effectiveParams = calleeType.params;
    let effectiveReturnType = calleeType.returnType;

    if (typeParams && typeParams.length > 0) {
      if (expr.typeArgs && expr.typeArgs.length > 0) {
        // Chamada com type args explícitos: add<int>(1, 2)
        const typeArgs = expr.typeArgs;
        if (typeArgs.length !== typeParams.length) {
          const token = expr.callee.kind === "Identifier"
            ? expr.callee.name
            : { line: 0, column: 0, type: 0, value: "" } as Token;
          this.errors.push(Errors.genericArgCount(
            expr.callee.kind === "Identifier" ? (expr.callee.name.value as string) : "",
            typeParams.length, typeArgs.length, token, "function"
          ));
          // Fallback: unknown para todos os type params (evita cascade com raw T)
          const fallbackMapping = new Map<string, TypeNode>();
          for (const tp of typeParams) {
            fallbackMapping.set(tp.name.value as string, { kind: "PrimitiveType", name: "unknown" });
          }
          effectiveParams = calleeType.params.map(p => ({
            ...this.substitute(p, fallbackMapping),
            isRest: (p as any).isRest
          })) as typeof calleeType.params;
          effectiveReturnType = this.substitute(calleeType.returnType, fallbackMapping);
        } else {
          // Validar cada type arg
          let valid = true;
          for (const ta of typeArgs) {
            const err = this.validateTypeNode(ta, expr.callee.kind === "Identifier" ? expr.callee.name : { line: 0, column: 0, type: 0, value: "" } as Token);
            if (err) {
              this.errors.push(err);
              valid = false;
            }
          }
          if (valid) {
            // Criar mapping de substituição
            const mapping = new Map<string, TypeNode>();
            for (let i = 0; i < typeParams.length; i++) {
              mapping.set(typeParams[i].name.value as string, typeArgs[i]);
            }
            // Substituir params e return type
            effectiveParams = calleeType.params.map(p => ({
              ...this.substitute(p, mapping),
              isRest: (p as any).isRest
            })) as typeof calleeType.params;
            effectiveReturnType = this.substitute(calleeType.returnType, mapping);
          }
        }
      } else {
        // Chamada sem type args: add(1, 2) — tentar inferir
        const savedErrorCount = this.errors.length;
        const argTypes: TypeNode[] = [];
        for (const arg of expr.args) {
          argTypes.push(this.checkExpression(arg));
        }
        const mapping = this.tryInferTypeArgs(typeParams, calleeType.params, argTypes);
        if (mapping) {
          // Primeira passada foi só para inferência; descarta erros spurious.
          // A segunda passada (abaixo) re-checa com contexto adequado.
          this.errors.length = savedErrorCount;
          // Bidirectional inference: contextualType pode preencher type params não inferidos dos args
          if (this.contextualType) {
            const missingParams = typeParams.filter(tp => !mapping.has(tp.name.value as string));
            if (missingParams.length > 0) {
              const ctxMap = this.inferTypeArgsFromReturnType(
                typeParams, calleeType.returnType, this.contextualType
              );
              if (ctxMap) {
                for (const [k, v] of ctxMap) {
                  if (!mapping.has(k)) {
                    mapping.set(k, v);
                  }
                }
              }
            }
          }

          // Type params que ainda não foram inferidos → erro + unknown para recovery
          const missingParams = typeParams.filter(tp => !mapping.has(tp.name.value as string));
          if (missingParams.length > 0) {
            const token = expr.callee.kind === "Identifier"
              ? expr.callee.name
              : { line: 0, column: 0, type: 0, value: "" } as Token;
            for (const tp of missingParams) {
              this.errors.push(Errors.genericInferenceFailed(tp.name.value as string, token));
              mapping.set(tp.name.value as string, { kind: "PrimitiveType", name: "unknown" });
            }
          }

          effectiveParams = calleeType.params.map(p => ({
            ...this.substitute(p, mapping),
            isRest: (p as any).isRest
          })) as typeof calleeType.params;
          effectiveReturnType = this.substitute(calleeType.returnType, mapping);
        }
        // Se inferência falhou (conflito), usar tipos originais
      }
    } else if (expr.typeArgs && expr.typeArgs.length > 0) {
      // Chamada com type args mas função não é genérica
      const token = expr.callee.kind === "Identifier"
        ? expr.callee.name
        : { line: 0, column: 0, type: 0, value: "" } as Token;
      this.errors.push(Errors.notGeneric(
        expr.callee.kind === "Identifier" ? (expr.callee.name.value as string) : "",
        token, "function"
      ));
    }

    const params = effectiveParams;
    const args = expr.args;

    // ── detectar rest param na assinatura ──────────────────────
    const hasRest = params.length > 0 && params[params.length - 1].isRest === true;
    const restIndex = hasRest ? params.length - 1 : -1;

    // ── separar args posicionais de nomeados ───────────────────
    const positionalArgs: { index: number; arg: Expr }[] = [];
    const namedArgs: { index: number; arg: Extract<Expr, { kind: "NamedArgument" }> }[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.kind === "NamedArgument") {
        namedArgs.push({ index: i, arg });
      } else {
        positionalArgs.push({ index: i, arg });
      }
    }

    // ── checar aridade ─────────────────────────────────────────
    const totalPositional = positionalArgs.length;
    const totalNamed = namedArgs.length;

    if (hasRest) {
      const minArgs = restIndex;
      if (totalPositional < minArgs) {
        const token = expr.callee.kind === "Identifier"
          ? expr.callee.name
          : { line: 0, column: 0, type: 0, value: "" } as Token;
        this.errors.push(Errors.argumentCountMismatch(minArgs, totalPositional, token));
      }
    } else if (totalNamed === 0) {
      // All positional: exact arity
      if (params.length !== totalPositional) {
        const token = expr.callee.kind === "Identifier"
          ? expr.callee.name
          : { line: 0, column: 0, type: 0, value: "" } as Token;
        this.errors.push(Errors.argumentCountMismatch(params.length, totalPositional, token));
      }
    }
    // With named args: positional must not exceed params length, and all named keys must be unique and exist

    // Build param name → index mapping from original callee type (paramName preserved)
    const paramNameToIndex = new Map<string, number>();
    for (let i = 0; i < calleeType.params.length; i++) {
      const pName = (calleeType.params[i] as any).paramName;
      if (typeof pName === "string") {
        paramNameToIndex.set(pName, i);
      }
    }

    // ── checar cada argumento ──────────────────────────────────
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      let expectedType: TypeNode | null = null;
      let expectedName: string | null = null;

      if (arg.kind === "NamedArgument") {
        // Lookup by name
        const namedArg = arg as Extract<Expr, { kind: "NamedArgument" }>;
        const paramIndex = paramNameToIndex.get(namedArg.key);
        if (paramIndex === undefined) {
          this.errors.push(Errors.unknownProperty(
            `unknown parameter '${namedArg.key}'`,
            namedArg.keyToken ?? { line: 0, column: 0, type: 0, value: "" } as Token
          ));
          this.checkExpression(namedArg.value);
          continue;
        }
        expectedName = namedArg.key;
        expectedType = params[paramIndex];
      } else if (hasRest && i >= restIndex) {
        const restParamType = params[restIndex];
        if (arg.kind === "Spread") {
          expectedType = restParamType;
        } else {
          expectedType = this.isArray(restParamType)
            ? this.arrayElement(restParamType)
            : restParamType.kind === "ArrayType"
              ? restParamType.elementType
              : restParamType;
        }
      } else if (i < params.length) {
        expectedType = params[i];
      }

      if (!expectedType) continue;

      const resolvedExpected = this.resolveAlias(expectedType);

      // ── spread como argumento ─────────────────────────────────
      if (arg.kind === "Spread") {
        const spreadType = this.checkExpression(
          (arg as Extract<Expr, { kind: "Spread" }>).argument
        );
        const resolvedSpread = this.resolveAlias(spreadType);
        
        if (!this.isArray(resolvedSpread) && resolvedSpread.kind !== "ArrayType") {
          this.errors.push(Errors.invalidSpread(
            { line: 0, column: 0, type: 0, value: "" } as Token
          ));
          continue;
        }
        
        if (!this.areTypesCompatible(resolvedExpected, spreadType)) {
          this.errors.push(Errors.typeMismatch(
            `argument ${i + 1}: expected '${this.typeToString(resolvedExpected)}', ` +
            `got '${this.typeToString(spreadType)}'`,
            this.getExprToken(arg),
          ));
        }
        continue;
      }

      // ── contextual typing para arrow functions ─────────────────
      if (resolvedExpected.kind === "FunctionType" &&
          arg.kind === "ArrowFunction") {
        this.contextualType = resolvedExpected;
        const actualType = this.checkExpression(arg);
        this.contextualType = null;

        if (!this.areTypesCompatible(resolvedExpected, actualType)) {
          const label = expectedName ? `'${expectedName}'` : `${i + 1}`;
          this.errors.push(Errors.typeMismatch(
            `argument ${label}: expected '${this.typeToString(resolvedExpected)}', ` +
            `got '${this.typeToString(actualType)}'`,
            this.getExprToken(arg),
          ));
        }
        continue;
      }

      // ── argumento normal ───────────────────────────────────────
      this.contextualType = resolvedExpected;
      const actualType = this.checkExpression(arg);
      this.contextualType = null;
      if (!this.areTypesCompatible(resolvedExpected, actualType)) {
        const label = expectedName ? `'${expectedName}'` : `${i + 1}`;
        this.errors.push(Errors.typeMismatch(
          `argument ${label}: expected '${this.typeToString(resolvedExpected)}', ` +
          `got '${this.typeToString(actualType)}'`,
          this.getExprToken(arg),
        ));
      }
    }

    return effectiveReturnType;
  }

  private getExprToken(expr: Expr): Token {
    switch (expr.kind) {
      case "Identifier": return expr.name;
      case "Literal": return expr.value;
      case "Unary": return expr.operator;
      case "Binary": return expr.operator;
      case "Call": return this.getExprToken(expr.callee);
      case "Member": return expr.property;
      case "Group": return this.getExprToken(expr.expression);
      case "Spread": return this.getExprToken(expr.argument);
      case "ArrowFunction":
        if (expr.params.length > 0) return expr.params[0].name;
        return { line: 0, column: 0, type: 0, value: "" } as Token;
      default:
        return { line: 0, column: 0, type: 0, value: "" } as Token;
    }
  }

  private checkMemberExpr(expr: Extract<Expr, { kind: "Member" }>): TypeNode {
    const rawType = this.checkExpression(expr.object);
    const objectType = this.resolveAlias(rawType);
    const propName = expr.property.name.value as string;
    const propToken = expr.property.name;

    if (objectType.kind === "NamedType") {
      const typeName = objectType.name.value as string;
      const symbol = this.currentEnv.lookup(typeName);
      if (symbol?.kind === "struct") {
        if (!symbol.fields) return { kind: "PrimitiveType", name: "unknown" };
        const field = symbol.fields.find(f => f.name.value === propName);
        if (field) return field.type;
        // Try method resolution (7.3)
        if (symbol.methods) {
          const method = symbol.methods.find(m => m.name.value === propName);
          if (method) return this.buildMethodType(method);
        }
        this.errors.push(Errors.unknownProperty(propName, propToken));
        return { kind: "PrimitiveType", name: "unknown" };
      }
      this.errors.push(Errors.invalidMemberAccess(
        `cannot access member on non-struct type '${typeName}'`,
        propToken
      ));
      return { kind: "PrimitiveType", name: "unknown" };
    }

    if (objectType.kind === "GenericType") {
      const typeName = objectType.name.value as string;
      const symbol = this.currentEnv.lookup(typeName);
      if (symbol?.kind === "struct") {
        if (!symbol.fields) return { kind: "PrimitiveType", name: "any" };
        const field = symbol.fields.find(f => f.name.value === propName);
        if (field) {
          // Substitur type params pelos type args concretos
          if (symbol.typeParameters && symbol.typeParameters.length > 0) {
            const mapping = new Map<string, TypeNode>();
            for (let i = 0; i < symbol.typeParameters.length; i++) {
              const arg = objectType.args[i] ?? { kind: "NamedType", name: { type: TokenType.IDENTIFIER, value: symbol.typeParameters[i].name.value, line: 0, column: 0 } };
              mapping.set(symbol.typeParameters[i].name.value as string, arg);
            }
            return this.substitute(field.type, mapping);
          }
          return field.type;
        }
        // Try method resolution with type arg substitution (7.5)
        if (symbol.methods) {
          const method = symbol.methods.find(m => m.name.value === propName);
          if (method) {
            const mapping = new Map<string, TypeNode>();
            if (symbol.typeParameters) {
              for (let i = 0; i < symbol.typeParameters.length; i++) {
                const arg = objectType.args[i] ?? { kind: "NamedType", name: { type: TokenType.IDENTIFIER, value: symbol.typeParameters[i].name.value, line: 0, column: 0 } };
                mapping.set(symbol.typeParameters[i].name.value as string, arg);
              }
            }
            return this.buildMethodType(method, mapping);
          }
        }
        this.errors.push(Errors.unknownProperty(propName, propToken));
        return { kind: "PrimitiveType", name: "any" };
      }
      if (!symbol) {
        this.errors.push(Errors.undefinedType(typeName, propToken));
        return { kind: "PrimitiveType", name: "any" };
      }
      this.errors.push(Errors.invalidMemberAccess(
        `cannot access member on non-struct generic type '${typeName}'`,
        propToken
      ));
      return { kind: "PrimitiveType", name: "any" };
    }

    if (objectType.kind !== "Object") {
      this.errors.push(Errors.invalidMemberAccess(
        "cannot access member on non-object type",
        propToken
      ));
    }

    return { kind: "PrimitiveType", name: "any" };
  }

  private buildMethodType(method: StructMethod, typeArgMapping?: Map<string, TypeNode>): FunctionTypeNode {
    // Proteger type params do método: se têm o mesmo nome que os do struct,
    // o type param do método deve sombrear o do struct nas assinaturas.
    const mapping = new Map(typeArgMapping ?? new Map());
    if (method.typeParameters) {
      for (const tp of method.typeParameters) {
        mapping.delete(tp.name.value as string);
      }
    }
    const paramTypes = method.params.map(p => {
      const pt = p.type ? this.substitute(p.type, mapping) : { kind: "PrimitiveType", name: "unknown" } as TypeNode;
      return { ...pt, paramName: p.name?.value as string, isRest: p.isRest || false } as TypeNode & { paramName?: string; isRest?: boolean };
    });
    const returnType = method.returnType
      ? this.substitute(method.returnType, mapping)
      : { kind: "PrimitiveType", name: "void" } as TypeNode;
    return {
      kind: "FunctionType",
      params: paramTypes,
      returnType,
      typeParameters: method.typeParameters,
    };
  }

  private checkIndexExpr(expr: Extract<Expr, { kind: "Index" }>): TypeNode {
    const objectType = this.resolveAlias(this.checkExpression(expr.object));
    const savedCtx = this.contextualType;
    this.contextualType = null;
    const indexType = this.checkExpression(expr.index);
    this.contextualType = savedCtx;
    const token = this.getExprToken(expr.index) ?? this.getExprToken(expr.object)
      ?? { type: TokenType.NUMBER, value: 0, line: 0, column: 0 };

    let baseType = this.normalizeType(objectType);
    if (baseType.kind === "NullableType") {
      baseType = baseType.type;
    }

    if (this.isArray(baseType)) {
      if (indexType.kind === "PrimitiveType" && indexType.name === "int") {
        return this.arrayElement(baseType);
      }
      this.errors.push(Errors.invalidIndex(
        `array index must be int, got ${this.typeToString(indexType)}`,
        token
      ));
      return this.arrayElement(baseType);
    }

    // ArrayType legado (transição)
    if (baseType.kind === "ArrayType") {
      if (indexType.kind === "PrimitiveType" && indexType.name === "int") {
        return baseType.elementType;
      }
      this.errors.push(Errors.invalidIndex(
        `array index must be int, got ${this.typeToString(indexType)}`,
        token
      ));
      return baseType.elementType;
    }

    if (baseType.kind === "TupleType") {
      if (expr.index.kind === "Literal" && typeof expr.index.value === "number") {
        const pos = expr.index.value;
        if (pos >= 0 && pos < baseType.elements.length) {
          return baseType.elements[pos];
        }
        this.errors.push(Errors.invalidIndex(
          `tuple index ${pos} out of bounds (size ${baseType.elements.length})`,
          token
        ));
        return { kind: "PrimitiveType", name: "unknown" };
      }
      this.errors.push(Errors.invalidIndex(
        "tuple index must be a literal integer",
        token
      ));
      return { kind: "PrimitiveType", name: "unknown" };
    }

    this.errors.push(Errors.invalidIndex(
      `type '${this.typeToString(objectType)}' does not support indexing`,
      token
    ));
    return { kind: "PrimitiveType", name: "any" };
  }

  private getExprToken(expr: Expr): Token | null {
    switch (expr.kind) {
      case "Identifier": return expr.name;
      case "Binary": return expr.operator;
      case "Unary": return expr.operator;
        case "Logical": return expr.operator;
        case "Literal": return expr.token ?? null;
        case "Spread":
          if (expr.line !== undefined && expr.column !== undefined) {
            return { type: TokenType.SPREAD, value: "...", line: expr.line, column: expr.column };
          }
          return null;
        case "Array":
          for (const el of expr.elements) {
            const t = this.getExprToken(el);
            if (t) return t;
          }
          return null;
        case "Index":
          return this.getExprToken(expr.object) ?? this.getExprToken(expr.index) ?? null;
        case "Call":
          return this.getExprToken(expr.callee) ?? null;
      default: return null;
    }
  }

  private checkArrayExpr(expr: Extract<Expr, { kind: "Array" }>): TypeNode {
    let ctx = this.contextualType ? this.unwrapGrouping(this.contextualType) : null;
    if (ctx) ctx = this.resolveAlias(ctx);
    if (ctx) ctx = this.normalizeType(ctx);
    if (ctx?.kind === "NullableType") {
      ctx = this.unwrapGrouping(ctx.type);
      if (ctx) ctx = this.resolveAlias(ctx);
    }

    if (expr.elements.length === 0) {
      if (ctx && this.isArray(ctx)) return ctx;
      if (ctx?.kind === "TupleType") {
        const token = { type: TokenType.NUMBER, value: 0, line: 0, column: 0 } as Token;
        this.errors.push(Errors.tupleSizeMismatch(ctx.elements.length, 0, token));
        return ctx;
      }
      return this.makeArrayType({ kind: "PrimitiveType", name: "unknown" });
    }

    if (ctx?.kind === "TupleType") {
      return this.checkArrayAsTuple(expr, ctx);
    }

    // ArrayType legado como contexto (transição)
    if (ctx?.kind === "ArrayType") {
      const inferred = this.checkArrayExpr(expr);
      return inferred;
    }

    this.contextualType = null;

    const elementCtx: TypeNode | null = ctx && this.isArray(ctx)
      ? this.unwrapGrouping(this.resolveAlias(this.arrayElement(ctx)))
      : null;

    const elementTypes: TypeNode[] = [];

    for (const e of expr.elements) {
      this.contextualType = elementCtx;

      if (e.kind === "Spread") {
        const spreadType = this.checkExpression(e);
        if (this.isArray(spreadType)) {
          elementTypes.push(this.unwrapGrouping(this.arrayElement(spreadType)));
        } else if (spreadType.kind === "ArrayType") {
          elementTypes.push(this.unwrapGrouping(spreadType.elementType));
        } else {
          elementTypes.push(spreadType);
        }
      } else {
        const t = this.checkExpression(e);
        elementTypes.push(this.unwrapGrouping(t));
      }

      this.contextualType = null;
    }

    const unique = this.deduplicateTypes(elementTypes);

    // ── FIX: se todos os elementos são compatíveis com elementCtx,
    // normaliza pelo contexto em vez de criar union
    // Ex: [1, null] com ctx Array<int?> → todos ok → retorna Array<int?>
    if (elementCtx !== null && unique.every(t => this.areTypesCompatible(elementCtx, t))) {
      return this.makeArrayType(elementCtx);
    }

    if (!ctx && unique.length > 1) {
      const got = unique.map(t => this.typeToString(t)).join(", ");
      const suggestion = `(${unique.map(t => this.typeToString(t)).join(" | ")})[]`;
      const token = expr.elements.length > 1
        ? (this.getExprToken(expr.elements[1]) ?? this.getExprToken(expr.elements[0])
           ?? { type: TokenType.NUMBER, value: 0, line: 0, column: 0 } as Token)
        : { type: TokenType.NUMBER, value: 0, line: 0, column: 0 } as Token;
      this.errors.push(Errors.heterogeneousArray(got, suggestion, token));
      return this.makeArrayType(unique[0]);
    }

    if (unique.length === 1 && this.isArray(unique[0])) {
      return this.makeArrayType(unique[0]);
    }

    // ArrayType legado aninhado (transição)
    if (unique.length === 1 && unique[0].kind === "ArrayType") {
      return this.makeArrayType(unique[0]);
    }

    const elementType = unique.length === 1
      ? unique[0]
      : { kind: "UnionType", types: unique } as TypeNode;

    return this.makeArrayType(elementType);
  }

  private checkArrayAsTuple(
    expr: Extract<Expr, { kind: "Array" }>,
    tupleType: Extract<TypeNode, { kind: "TupleType" }>
  ): TypeNode {
    for (const e of expr.elements) {
      if (e.kind === "Spread") {
        const token = this.getExprToken(e) ?? { type: TokenType.NUMBER, value: 0, line: 0, column: 0 } as Token;
        this.errors.push(Errors.spreadInTuple(token));
        return tupleType;
      }
    }

    if (expr.elements.length !== tupleType.elements.length) {
      const token = expr.elements.length > 0
        ? (this.getExprToken(expr.elements[0]) ?? { type: TokenType.NUMBER, value: 0, line: 0, column: 0 } as Token)
        : { type: TokenType.NUMBER, value: 0, line: 0, column: 0 } as Token;
      this.errors.push(Errors.tupleSizeMismatch(tupleType.elements.length, expr.elements.length, token));
      return tupleType;
    }

    for (let i = 0; i < expr.elements.length; i++) {
      const expected = tupleType.elements[i];
      this.contextualType = expected;
      const actual = this.checkExpression(expr.elements[i]);
      this.contextualType = null;
      if (!this.areTypesCompatible(expected, actual)) {
        const token = this.getExprToken(expr.elements[i])
          ?? { type: TokenType.NUMBER, value: 0, line: 0, column: 0 } as Token;
        this.errors.push(Errors.typeMismatch(
          `tuple position ${i}: expected '${this.typeToString(expected)}', got '${this.typeToString(actual)}'`,
          token
        ));
      }
    }

    return tupleType;
  }

  private deduplicateTypes(types: TypeNode[]): TypeNode[] {
    const seen = new Set<string>();
    return types.filter((t) => {
      const key = this.typeToString(t);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private checkObjectExpr(expr: Extract<Expr, { kind: "Object" }>): TypeNode {
    const fields: Record<string, TypeNode> = {};
    for (const prop of expr.properties) {
      const key = prop.key || "unknown";
      fields[key] = this.checkExpression(prop.value);
    }
    return { kind: "Object", fields } as TypeNode;
  }

  private checkConditionalExpr(
    expr: Extract<Expr, { kind: "Conditional" }>
  ): TypeNode {
    this.checkExpression(expr.condition);
    const consequentType = this.checkExpression(expr.consequent);
    const alternateType = this.checkExpression(expr.alternate);
    return consequentType;
  }

  private checkNullishCoalescingExpr(
    expr: Extract<Expr, { kind: "NullishCoalescing" }>
  ): TypeNode {
    this.checkExpression(expr.left);
    return this.checkExpression(expr.right);
  }

  private unwrapGrouping(type: TypeNode): TypeNode {
    while (type.kind === "Group" || type.kind === "GroupingType") {
      type = (type as any).expression || (type as any).type;
    }
    if (type.kind === "ArrayType") {
      return {
        ...type,
        elementType: this.unwrapGrouping(type.elementType),
      };
    }
    if (this.isArray(type)) {
      return {
        ...type,
        args: [this.unwrapGrouping(this.arrayElement(type))],
      };
    }
    if (type.kind === "FunctionType") {
      return {
        ...type,
        params: type.params.map(p => this.unwrapGrouping(p)),
        returnType: this.unwrapGrouping(type.returnType),
      };
    }
    return type;
  }

  private checkArrowFunctionExpr(
    expr: Extract<Expr, { kind: "ArrowFunction" }>
  ): TypeNode {
    let unwrapped = this.contextualType ? this.unwrapGrouping(this.contextualType) : null;
    if (unwrapped) unwrapped = this.resolveAlias(unwrapped);
    let fnContext: FunctionTypeNode | null = unwrapped?.kind === "FunctionType" ? unwrapped : null;
    this.contextualType = null;

    // ── Cria escopo cedo para registrar type params ANTES de validar tipos ──
    const fnEnv = new Environment(this.currentEnv, false);

    // Registra type params (T, U) para que sejam visíveis em anotações de tipo
    if (expr.typeParameters) {
      const seen = new Set<string>();
      for (const tp of expr.typeParameters) {
        const tpName = tp.name.value as string;
        if (seen.has(tpName)) {
          this.errors.push(Errors.alreadyDeclared(tpName, tp.name));
        } else {
          seen.add(tpName);
          fnEnv.define(tpName, {
            name: tpName,
            type: { kind: "NamedType", name: tp.name },
            kind: "typeParam",
            mutable: false,
            initialized: true,
            declarationToken: tp.name,
            constraint: tp.constraint,
          });
        }
      }
    }

    // Entra no escopo para que type params e params sejam visíveis durante validação
    const previousEnv = this.currentEnv;
    const previousReturnType = this.currentFunctionReturnType;
    const previousHasReturn = this.hasReturn;
    const previousFunctionDepth = this.functionDepth;
    this.currentEnv = fnEnv;

    // Se temos type parameters e contexto, tenta inferir mapeamento concreto
    // Ex: apply(10, <T>(x: T): T => x) → fnContext = (int) => int → T=int
    const inferredMapping = expr.typeParameters && fnContext
      ? this.inferArrowTypeParamsFromContext(expr.typeParameters, expr.params, expr.returnType, fnContext)
      : null;

    // Valida tipos dos params (type params como T estão visíveis agora)
    const paramTypes: TypeNode[] = [];
    for (let i = 0; i < expr.params.length; i++) {
      const param = expr.params[i];
      if (param.type) {
        const err = this.validateTypeNode(param.type, param.name);
        if (err) {
          this.errors.push(err);
          paramTypes.push({ kind: "PrimitiveType", name: "unknown" });
        } else {
          paramTypes.push(param.type);
        }
      } else if (fnContext && i < fnContext.params.length) {
        paramTypes.push(fnContext.params[i]);
      } else {
        paramTypes.push({ kind: "PrimitiveType", name: "unknown" });
      }
    }

    // Verifica rest params
    for (let i = 0; i < expr.params.length - 1; i++) {
      if (expr.params[i].isRest) {
        this.errors.push(Errors.restNotLast(expr.params[i].name));
      }
    }

    // Valida return type annotation
    const annotatedReturn = expr.returnType
      ? (() => {
          const err = this.validateTypeNode(expr.returnType!, expr.params[0]?.name ?? { line: 0, column: 0, type: 0, value: "" } as Token);
          if (err) this.errors.push(err);
          return expr.returnType!;
        })()
      : null;

    const expectedReturn: TypeNode | null =
      annotatedReturn ?? fnContext?.returnType ?? null;

    // Registra params da função no escopo
    for (let i = 0; i < expr.params.length; i++) {
      const param = expr.params[i];
      const paramName = param.name.value as string;
      fnEnv.define(paramName, {
        name: paramName,
        type: paramTypes[i],
        kind: "parameter",
        mutable: false,
        initialized: true,
        declarationToken: param.name,
      });
    }

    this.functionDepth++;
    this.hasReturn = false;
    this.currentFunctionReturnType = expectedReturn;

    let inferredReturn: TypeNode;
    if (expr.body.kind !== "BlockStmt") {
      // PROPAGAÇÃO DE CONTEXTO: se o retorno esperado é FunctionType, passa como contexto
      if (expectedReturn && expectedReturn.kind === "FunctionType") {
        this.contextualType = expectedReturn;
      }

      inferredReturn = this.checkExpression(expr.body as Expr);
      this.contextualType = null; // limpa após checar
      this.hasReturn = true;

      if (expectedReturn && !this.areTypesCompatible(expectedReturn, inferredReturn)) {
        const token = expr.body.kind === "Identifier"
          ? (expr.body as Extract<Expr, { kind: "Identifier" }>).name
          : { line: 0, column: 0, type: 0, value: "" } as Token;
        this.errors.push(Errors.invalidReturnType(
          this.typeToString(expectedReturn),
          this.typeToString(inferredReturn),
          token
        ));
      }
    } else {
      this.checkBlockStmt(expr.body as Extract<Stmt, { kind: "BlockStmt" }>);

      const effectiveReturn = expectedReturn ?? { kind: "PrimitiveType", name: "void" } as TypeNode;
      const isVoid = effectiveReturn.kind === "PrimitiveType" && effectiveReturn.name === "void";

      if (!isVoid && !this.hasReturn) {
        const token = expr.params[0]?.name ?? { line: 0, column: 0, type: 0, value: "=>" } as Token;
        this.errors.push(Errors.missingReturn(token));
      }

      inferredReturn = expectedReturn ?? { kind: "PrimitiveType", name: "void" };
    }

    this.currentEnv = previousEnv;
    this.currentFunctionReturnType = previousReturnType;
    this.hasReturn = previousHasReturn;
    this.functionDepth = previousFunctionDepth;

    const finalReturn = annotatedReturn ?? inferredReturn;
    const result: TypeNode = {
      kind: "FunctionType",
      params: paramTypes.map((pt, i) => ({
        ...pt,
        paramName: expr.params[i]?.name?.value as string,
        isRest: expr.params[i]?.isRest || false
      })),
      returnType: finalReturn,
      typeParameters: expr.typeParameters,
    };

    // Se temos um mapeamento de type params inferidos do contexto, substitui
    if (inferredMapping) {
      return this.substitute(result, inferredMapping);
    }

    return result;
  }

  /**
   * Quando uma arrow function genérica (<T>(x: T): T => x) é passada como argumento
   * para um parâmetro que espera um tipo concreto (ex: (int) => int), infere
   * o mapeamento T → int a partir das anotações da arrow vs o tipo contextual.
   *
   * Exemplo:
   *   func apply<T>(x: T, fn: (T) => T): T { return fn(x) }
   *   apply(10, <T>(x: T): T => x)
   *   // Aqui, o T de apply vira int, e fn espera (int) => int
   *   // O T da arrow é inferido como int a partir do contexto
   */
  private inferArrowTypeParamsFromContext(
    typeParameters: TypeParameterNode[],
    exprParams: { name: Token; type?: TypeNode }[],
    returnType: TypeNode | undefined,
    contextType: FunctionTypeNode
  ): Map<string, TypeNode> | null {
    const mapping = new Map<string, TypeNode>();
    const typeParamNames = new Set(typeParameters.map(tp => tp.name.value as string));

    // Match params por posição: anotação T → tipo concreto do contexto
    for (let i = 0; i < Math.min(exprParams.length, contextType.params.length); i++) {
      const annotated = exprParams[i].type;
      if (annotated?.kind === "NamedType" && typeParamNames.has(annotated.name.value as string)) {
        mapping.set(annotated.name.value as string, contextType.params[i]);
      }
    }

    // Match return type: anotação T → tipo concreto do contexto
    if (returnType?.kind === "NamedType" && typeParamNames.has(returnType.name.value as string)) {
      if (!mapping.has(returnType.name.value as string)) {
        mapping.set(returnType.name.value as string, contextType.returnType);
      }
    }

    return mapping.size > 0 ? mapping : null;
  }

  private checkSpreadExpr(expr: Extract<Expr, { kind: "Spread" }>): TypeNode {
    const argType = this.checkExpression(expr.argument);

    const resolved = this.resolveAlias(argType);

    if (!this.isArray(resolved) && resolved.kind !== "ArrayType" && resolved.kind !== "Object") {
      const token: Token = {
        line: expr.line ?? 0,
        column: expr.column ?? 0,
        type: 0,
        value: ""
      };
      this.errors.push(Errors.invalidSpread(token));
    }

    return resolved;
  }

  public getErrors(): SemanticError[] {
    return this.errors;
  }

  public getSymbolCount(): number {
    return this.globalEnv.getSymbolCount();
  }

  public getResolvedTypes(): Map<Expr, TypeNode> {
    return this.resolvedTypes;
  }

  public getEnvironment(): Environment {
    return this.globalEnv;
  }
}

export function analyze(program: Stmt[]): {
  errors: SemanticError[];
  symbolCount: number;
  resolvedTypes: Map<Expr, TypeNode>;
  environment: Environment;
} {
  const checker = new TypeChecker();
  const errors = checker.check(program);
  return {
    errors,
    symbolCount: checker.getSymbolCount(),
    resolvedTypes: checker.getResolvedTypes(),
    environment: checker.getEnvironment(),
  };
}