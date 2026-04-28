# Bug Tracker - Andromeda Compiler

## Bug #001: Generics in typealias not working

**Status**: 🔴 Open  
**Date**: 2026-04-28  
**Component**: Parser (`src/parser/parser.ts`)

---

### Description

When defining a `typealias` with generic types, the parser fails to process the type arguments correctly.

### Reproduction

```andromeda
typealias StringList = Array<string>
typealias UserMap = Map<string, int>
```

**Error**:
```
[Parse Error]: Unexpected token 'string', expected expression.
At line 1, column 29:

1 | typealias StringList = Array<string>
  |                              ^^^^^
```

---

### Root Cause (Suspected)

In `parseAnnotationType()`, when processing generic type arguments (e.g., `<string>`), the method is called from `parseNamedTypeWithGenerics()`. The token `string` is recognized as `TokenType.STRING_TYPE` (keyword), but `parseAnnotationType()` may not be handling it correctly in the recursive call.

**Location**: `src/parser/parser.ts`
- `parseAnnotationType()` (~line 1588)
- `parseNamedTypeWithGenerics()` (~line 1722)

---

### Workaround

None at the moment. Avoid using generics in `typealias` definitions.

---

### Next Steps

1. Debug `parseAnnotationType()` to see why `TokenType.STRING_TYPE` is not being processed
2. Check if the control flow in `parseNamedTypeWithGenerics()` is correct
3. Add proper error messages for this case
4. Create test cases for generics in typealias

---

## Bug #002: typeToString() returns "unknown" for some types

**Status**: ✅ Fixed  
**Date**: 2026-04-28  
**Component**: TypeChecker (`src/semantic/TypeChecker.ts`)

---

### Description

The `typeToString()` method in TypeChecker was returning `"unknown"` for `NamedType`, `LiteralType`, `TupleType`, and `GenericType`.

### Fix

Added proper handling for all type nodes in `typeToString()`:
- `NamedType` → returns type name
- `LiteralType` → returns string representation of value
- `TupleType` → returns `[elem1, elem2, ...]`
- `GenericType` → returns `Name<arg1, arg2, ...>`

**Commit**: `21e0c66`

---
