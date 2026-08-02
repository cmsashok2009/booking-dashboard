import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../app/", import.meta.url));
const limit = 350;
const extensions = new Set([".js", ".jsx", ".mjs"]);
const files = [];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (extensions.has(extname(entry.name))) files.push(path);
  }
}

visit(root);
const violations = files
  .map((path) => ({ path, lines: readFileSync(path, "utf8").split(/\r?\n/).length }))
  .filter(({ lines }) => lines > limit)
  .sort((a, b) => b.lines - a.lines);

if (violations.length) {
  console.error(`App modules must not exceed ${limit} lines:`);
  for (const item of violations) console.error(`  ${item.lines} ${relative(root, item.path)}`);
  process.exitCode = 1;
} else {
  console.log(`Module-size check passed: ${files.length} app modules are at or below ${limit} lines.`);
}
