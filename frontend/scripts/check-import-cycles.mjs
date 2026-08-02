import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";

const root = normalize(
  new URL("../app/", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1))
);
const extensions = [".js", ".jsx", ".mjs"];
const files = [];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (extensions.includes(extname(entry.name))) files.push(normalize(path));
  }
}

function resolveImport(from, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(from), specifier);
  const candidates = [
    base,
    ...extensions.map((ext) => base + ext),
    ...extensions.map((ext) => join(base, "index" + ext))
  ];
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

visit(root);
const graph = new Map(files.map((file) => [file, []]));
const importPattern = /(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const target = resolveImport(file, match[1]);
    if (target && graph.has(normalize(target))) graph.get(file).push(normalize(target));
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];
let cycle = null;

function walk(file) {
  if (visiting.has(file)) {
    cycle = [...stack.slice(stack.indexOf(file)), file];
    return true;
  }
  if (visited.has(file)) return false;
  visiting.add(file);
  stack.push(file);
  for (const target of graph.get(file) || []) if (walk(target)) return true;
  stack.pop();
  visiting.delete(file);
  visited.add(file);
  return false;
}

for (const file of files) if (walk(file)) break;
if (cycle) {
  console.error("Circular dependency detected:");
  for (const file of cycle) console.error("  " + file.slice(root.length + 1));
  process.exitCode = 1;
} else {
  console.log(`Dependency-cycle check passed: ${files.length} app modules form an acyclic relative-import graph.`);
}
