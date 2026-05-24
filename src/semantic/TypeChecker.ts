import { Token, TokenType } from "../lexer/types";
import { Stmt, Expr, TypeNode, GenericTypeNode, IfVariableStmt } from "../ast";
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

  private checkExpression(expr: Expr): TypeNode {
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
      default:
        return { kind: "PrimitiveType", name: "unknown" };
    }
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
      if (
        leftType.kind === "PrimitiveType" &&
        rightType.kind === "PrimitiveType" &&
        leftType.name !== rightType.name
      ) {
        this.errors.push(Errors.typeMismatch(`incompatible types for operator '${op}'`, expr.operator));
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
            typeParams.length, typeArgs.length, token
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
        token
      ));
    }

    const params = effectiveParams;
    const args = expr.args;

    // ── detectar rest param na assinatura ──────────────────────
    const hasRest = params.length > 0 && params[params.length - 1].isRest === true;
    const restIndex = hasRest ? params.length - 1 : -1;

    // ── checar aridade ─────────────────────────────────────────
    if (hasRest) {
      // com rest: precisa de pelo menos (restIndex) args
      const minArgs = restIndex;
      if (args.length < minArgs) {
        const token = expr.callee.kind === "Identifier"
          ? expr.callee.name
          : { line: 0, column: 0, type: 0, value: "" } as Token;
        this.errors.push(Errors.argumentCountMismatch(minArgs, args.length, token));
      }
    } else {
      // sem rest: aridade exata
      if (params.length !== args.length) {
        const token = expr.callee.kind === "Identifier"
          ? expr.callee.name
          : { line: 0, column: 0, type: 0, value: "" } as Token;
        this.errors.push(Errors.argumentCountMismatch(params.length, args.length, token));
      }
    }

    // ── checar cada argumento ──────────────────────────────────
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // tipo esperado — separa rest param de normal, e dentro do rest
      // separa spread (Array<T>) de valor individual (T)
      let expectedType: TypeNode | null = null;
      if (hasRest && i >= restIndex) {
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
            { line: 0, column: 0, type: 0, value: "" } as Token
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
          this.errors.push(Errors.typeMismatch(
            `argument ${i + 1}: expected '${this.typeToString(resolvedExpected)}', ` +
            `got '${this.typeToString(actualType)}'`,
            { line: 0, column: 0, type: 0, value: "" } as Token
          ));
        }
        continue;
      }

      // ── argumento normal ───────────────────────────────────────
      this.contextualType = resolvedExpected;
      const actualType = this.checkExpression(arg);
      this.contextualType = null;
      if (!this.areTypesCompatible(resolvedExpected, actualType)) {
        this.errors.push(Errors.typeMismatch(
          `argument ${i + 1}: expected '${this.typeToString(resolvedExpected)}', ` +
          `got '${this.typeToString(actualType)}'`,
          { line: 0, column: 0, type: 0, value: "" } as Token
        ));
      }
    }

    return effectiveReturnType;
  }

  private checkMemberExpr(expr: Extract<Expr, { kind: "Member" }>): TypeNode {
    const objectType = this.checkExpression(expr.object);

    if (objectType.kind === "NamedType") {
      return { kind: "PrimitiveType", name: "any" };
    }

    if (objectType.kind !== "Object") {
      this.errors.push(Errors.invalidMemberAccess("cannot access member on non-object type", { line: 0, column: 0, type: 0, value: "" } as Token));
    }

    return { kind: "PrimitiveType", name: "any" };
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
}

export function analyze(program: Stmt[]): {
  errors: SemanticError[];
  symbolCount: number;
} {
  const checker = new TypeChecker();
  const errors = checker.check(program);
  return {
    errors,
    symbolCount: checker.getSymbolCount(),
  };
}