import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = join(root, ".next/server/app/page_client-reference-manifest.js");
const source = readFileSync(manifestPath, "utf8");
const marker = 'globalThis.__RSC_MANIFEST["/page"] = ';
const assignment = source.indexOf(marker);
const manifest = JSON.parse(source.slice(assignment + marker.length).replace(/;\s*$/, ""));
const pageKey = "[project]/app/page";
const toBytes = (path) => statSync(join(root, ".next", path.replace(/^\/?_next\//, ""))).size;
const pageJs = [...new Set(manifest.entryJSFiles[pageKey] || [])];
const pageCss = [...new Set((manifest.entryCSSFiles[pageKey] || []).map(({ path }) => path))];
const pageJsBytes = pageJs.reduce((sum, path) => sum + toBytes(path), 0);
const pageCssBytes = pageCss.reduce((sum, path) => sum + toBytes(path), 0);
const chunks = readdirSync(join(root, ".next/static/chunks"))
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name, bytes: statSync(join(root, ".next/static/chunks", name)).size }));
const largest = chunks.sort((a, b) => b.bytes - a.bytes)[0];
const budgets = { pageJs: 250 * 1024, pageCss: 120 * 1024, lazyChunk: 1024 * 1024 };
const failures = [];
if (pageJsBytes > budgets.pageJs) failures.push(`Dashboard entry JS ${pageJsBytes} exceeds ${budgets.pageJs} bytes`);
if (pageCssBytes > budgets.pageCss) failures.push(`Dashboard CSS ${pageCssBytes} exceeds ${budgets.pageCss} bytes`);
if (largest.bytes > budgets.lazyChunk) failures.push(`Largest JS chunk ${largest.name} is ${largest.bytes} bytes`);

const kb = (bytes) => (bytes / 1024).toFixed(1);
console.log(`Dashboard entry JS: ${kb(pageJsBytes)} KiB / 250 KiB`);
console.log(`Dashboard CSS: ${kb(pageCssBytes)} KiB / 120 KiB`);
console.log(`Largest lazy/shared JS chunk: ${kb(largest.bytes)} KiB / 1024 KiB (${largest.name})`);
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log("Bundle budgets passed.");
}
