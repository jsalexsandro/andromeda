export { Codegen } from "./Codegen";
export { ExprVisitor } from "./ExprVisitor";

// Main transpile function
export function transpile(ast: any[]): string {
  const { Codegen } = require("./Codegen");
  const codegen = new Codegen();
  return codegen.transpile(ast);
}