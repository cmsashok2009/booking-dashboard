import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const roots = ["app", "scripts", "test"];
const rootFiles = [
  "next.config.mjs",
  "package.json",
  "package-lock.json",
  "playwright.config.mjs",
  "vitest.config.mjs"
];
const extensions = new Set([".js", ".jsx", ".mjs", ".json", ".css"]);
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ["OpenAI-style secret", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/]
];
const findings = [];
let files = 0;

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (extensions.has(extname(entry.name))) inspect(path);
  }
}

function inspect(path) {
  files += 1;
  const source = readFileSync(path, "utf8");
  for (const [label, pattern] of patterns) {
    const match = source.match(pattern);
    if (match) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${relative(root, path)}:${line} contains a possible ${label}`);
    }
  }
}

for (const directory of roots) visit(join(root, directory));
for (const file of rootFiles) {
  const path = join(root, file);
  if (existsSync(path)) inspect(path);
}
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.startsWith(".env")) inspect(join(root, entry.name));
}
if (findings.length) {
  console.error("Secret scan failed:");
  for (const finding of findings) console.error(`  ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed: ${files} source/configuration files; no high-confidence credentials found.`);
}
