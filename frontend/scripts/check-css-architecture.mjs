import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "../node_modules/stylelint/node_modules/postcss/lib/postcss.mjs";

const root = fileURLToPath(new URL("../app/", import.meta.url));
const limit = 1000;
const files = [];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (extname(entry.name) === ".css") files.push(path);
  }
}

function context(node) {
  const parts = [];
  for (let parent = node.parent; parent?.type === "atrule"; parent = parent.parent) {
    parts.unshift(`@${parent.name} ${parent.params}`);
  }
  return parts.join(" > ");
}

visit(root);
const errors = [];
const colorPattern = /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(|\b(?:black|white)\b/i;

for (const path of files) {
  const source = readFileSync(path, "utf8");
  const display = relative(root, path);
  const lines = source.split(/\r?\n/).length;
  if (lines > limit) errors.push(`${display}: ${lines} lines exceeds the ${limit}-line stylesheet limit`);

  const parsed = postcss.parse(source, { from: path });
  const selectors = new Map();
  parsed.walkRules((rule) => {
    const key = `${context(rule)}|${rule.selector}`;
    if (selectors.has(key)) {
      errors.push(
        `${display}:${rule.source.start.line} duplicates selector block "${rule.selector}" from line ${selectors.get(key)}`
      );
    } else {
      selectors.set(key, rule.source.start.line);
    }
  });
  parsed.walkDecls((decl) => {
    if (!decl.prop.startsWith("--") && colorPattern.test(decl.value)) {
      errors.push(`${display}:${decl.source.start.line} uses raw color "${decl.value}" outside a custom property`);
    }
  });

  if (display === "globals.css" && parsed.nodes.some((node) => node.type !== "atrule" || node.name !== "import")) {
    errors.push("globals.css must remain an import-only cascade manifest");
  }
}

if (errors.length) {
  console.error("CSS architecture check failed:");
  for (const error of errors) console.error(`  ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `CSS architecture check passed: ${files.length} stylesheets are bounded, tokenized, and free of duplicate selector blocks.`
  );
}
