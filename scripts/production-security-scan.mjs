import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

const TEXT_EXTENSIONS = new Set([
  "",
  ".css",
  ".js",
  ".jsx",
  ".json",
  ".mjs",
  ".md",
  ".sql",
  ".yaml",
  ".yml",
]);
const SKIP_SEGMENTS = new Set([
  ".git",
  ".next",
  "coverage",
  "data",
  "dist",
  "node_modules",
  "out",
  "playwright-report",
  "test-results",
]);
const SECRET_PATTERNS = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ["OpenAI-style secret", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/],
];
const SENSITIVE_LOG_PATTERN = /console\.(?:log|info|warn|error|debug)\s*\([^\n]*(?:password|token|cookie|authorization|credential|secret)/i;
const LOCAL_STORAGE_SECRET_PATTERN = /localStorage\.setItem\s*\([^\n]*(?:password|token|credential|secret|cookie|authorization)/i;
const JAVASCRIPT_EVAL_PATTERN = /(^|[^.\w$])eval\s*\(/;
const NEW_FUNCTION_PATTERN = /new\s+Function\s*\(/;
const PROHIBITED_DEPENDENCY_SOURCES = /^(?:git\+|github:|gitlab:|bitbucket:|file:|link:|https?:)/i;
const STATIC_STATUS_ALLOWLIST = [/Secret scan (?:failed|passed)/, /Production security scan (?:failed|passed)/];
const ALLOWED_LOCK_RESOLVED = /^https:\/\/registry\.npmjs\.org\//;

const SCAN_ENTRIES = [
  "package.json",
  "backend/package.json",
  "backend/package-lock.json",
  "backend/openapi.json",
  "backend/server.js",
  "backend/src",
  "backend/scripts",
  "backend/test",
  "frontend/package.json",
  "frontend/package-lock.json",
  "frontend/app",
  "frontend/scripts",
  "frontend/test",
  ".github/workflows",
  "compose.yaml",
  ".env.example",
  ".env.docker.example",
];
const STATIC_SOURCE_PREFIXES = [
  "backend/server.js",
  "backend/src/",
  "backend/scripts/",
  "frontend/app/",
  "frontend/scripts/",
];
const MANIFESTS = ["package.json", "backend/package.json", "frontend/package.json"];
const LOCKFILES = ["backend/package-lock.json", "frontend/package-lock.json"];

function posixRelative(path) {
  return relative(root, path).replaceAll("\\", "/");
}

function shouldSkip(path) {
  const rel = posixRelative(path);
  return rel.split("/").some((segment) => SKIP_SEGMENTS.has(segment));
}

function isTextFile(path) {
  return TEXT_EXTENSIONS.has(extname(path));
}

export function collectScanFiles(entries = SCAN_ENTRIES) {
  const files = [];
  const visit = (path) => {
    if (!existsSync(path) || shouldSkip(path)) return;
    const stats = statSync(path);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        visit(join(path, entry.name));
      }
      return;
    }
    if (stats.isFile() && isTextFile(path)) files.push(path);
  };
  for (const entry of entries) visit(join(root, entry));
  return [...new Set(files)].sort((a, b) => posixRelative(a).localeCompare(posixRelative(b)));
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function isStaticSource(rel, prefixes = STATIC_SOURCE_PREFIXES) {
  return prefixes.some((prefix) => rel === prefix.replace(/\/$/, "") || rel.startsWith(prefix));
}

export function scanSourceText(files = collectScanFiles(), staticSourcePrefixes = STATIC_SOURCE_PREFIXES) {
  const findings = [];
  for (const file of files) {
    const rel = posixRelative(file);
    const source = readFileSync(file, "utf8");
    for (const [label, pattern] of SECRET_PATTERNS) {
      const match = source.match(pattern);
      if (match) {
        findings.push({
          type: "secret",
          severity: "high",
          file: rel,
          line: lineNumber(source, match.index),
          message: `possible ${label}`,
        });
      }
    }
    if (!isStaticSource(rel, staticSourcePrefixes)) continue;
    const lines = source.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (STATIC_STATUS_ALLOWLIST.some((pattern) => pattern.test(line))) continue;
      for (const [label, pattern] of [
        ["sensitive value in console logging", SENSITIVE_LOG_PATTERN],
        ["sensitive value in localStorage", LOCAL_STORAGE_SECRET_PATTERN],
        ["JavaScript eval", JAVASCRIPT_EVAL_PATTERN],
        ["dynamic Function constructor", NEW_FUNCTION_PATTERN],
      ]) {
        if (pattern.test(line)) {
          findings.push({
            type: "static",
            severity: "high",
            file: rel,
            line: index + 1,
            message: label,
          });
        }
      }
    }
  }
  return findings;
}

function dependencySections(manifest) {
  return ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
    .flatMap((section) => Object.entries(manifest[section] || {}).map(([name, spec]) => ({ section, name, spec })));
}

export function scanDependencyManifests(manifests = MANIFESTS, lockfiles = LOCKFILES) {
  const findings = [];
  for (const manifestPath of manifests) {
    const absolute = join(root, manifestPath);
    if (!existsSync(absolute)) continue;
    const manifest = JSON.parse(readFileSync(absolute, "utf8"));
    for (const dep of dependencySections(manifest)) {
      if (typeof dep.spec === "string" && PROHIBITED_DEPENDENCY_SOURCES.test(dep.spec)) {
        findings.push({
          type: "dependency",
          severity: "high",
          file: manifestPath,
          line: 1,
          message: `${dep.section}.${dep.name} uses prohibited source ${dep.spec}`,
        });
      }
    }
  }

  for (const lockfilePath of lockfiles) {
    const absolute = join(root, lockfilePath);
    if (!existsSync(absolute)) continue;
    const lockfile = JSON.parse(readFileSync(absolute, "utf8"));
    for (const [packagePath, metadata] of Object.entries(lockfile.packages || {})) {
      if (!metadata || typeof metadata.resolved !== "string") continue;
      const resolved = metadata.resolved;
      if (resolved.startsWith("http") && !ALLOWED_LOCK_RESOLVED.test(resolved)) {
        findings.push({
          type: "dependency",
          severity: "high",
          file: lockfilePath,
          line: 1,
          message: `${packagePath || "root"} resolves outside npm registry`,
        });
      }
      if (/^(?:git\+|github:|gitlab:|bitbucket:|file:|link:)/i.test(resolved)) {
        findings.push({
          type: "dependency",
          severity: "high",
          file: lockfilePath,
          line: 1,
          message: `${packagePath || "root"} uses prohibited lockfile source`,
        });
      }
    }
  }
  return findings;
}

export function runProductionSecurityScan() {
  const files = collectScanFiles();
  const sourceFindings = scanSourceText(files);
  const dependencyFindings = scanDependencyManifests();
  return {
    scannedAt: new Date().toISOString(),
    scannedFiles: files.length,
    findingCount: sourceFindings.length + dependencyFindings.length,
    findings: [...sourceFindings, ...dependencyFindings],
    gates: {
      highConfidenceSecrets: sourceFindings.filter((finding) => finding.type === "secret").length === 0,
      staticSensitivePatterns: sourceFindings.filter((finding) => finding.type === "static").length === 0,
      dependencySourcePolicy: dependencyFindings.length === 0,
    },
  };
}

function main() {
  const result = runProductionSecurityScan();
  if (result.findings.length) {
    console.error("Production security scan failed:");
    for (const finding of result.findings) {
      console.error(`  ${finding.file}:${finding.line} [${finding.type}] ${finding.message}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    `Production security scan passed: ${result.scannedFiles} files; secret, static-sensitive, and dependency-source gates passed.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();







