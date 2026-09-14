/**
 * Mark dist/cjs as CommonJS.
 *
 * The package root declares `"type": "module"`, which makes every `.js` file under it ESM —
 * including the CommonJS build tsc just emitted. Node resolves `type` from the NEAREST
 * package.json, so one three-line file inside dist/cjs flips that subtree back to CommonJS and
 * `require("puntersedge")` works, without renaming anything to `.cjs` or rewriting import
 * specifiers.
 */
import { writeFileSync, existsSync } from "node:fs";

const target = new URL("../dist/cjs/package.json", import.meta.url);

if (!existsSync(new URL("../dist/cjs/index.js", import.meta.url))) {
  console.error("dist/cjs/index.js is missing — did tsc -p tsconfig.cjs.json run?");
  process.exit(1);
}

writeFileSync(target, JSON.stringify({ type: "commonjs" }, null, 2) + "\n");
console.log("wrote dist/cjs/package.json (type: commonjs)");
