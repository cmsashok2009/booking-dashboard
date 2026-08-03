import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = [path.join(backendRoot, "server.js"), path.join(backendRoot, "src")];
const maxLines = 510;

async function collect(entry) {
  const statEntries = await readdir(entry, { withFileTypes: true }).catch(() => null);
  if (!statEntries) return [entry];
  const nested = await Promise.all(
    statEntries
      .filter((item) => !item.name.startsWith("."))
      .map((item) => collect(path.join(entry, item.name))),
  );
  return nested.flat();
}

const files = (await Promise.all(sourceRoots.map(collect)))
  .flat()
  .filter((file) => file.endsWith(".js"));
const contents = new Map(
  await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")])),
);
const oversized = [...contents].filter(([, source]) => source.split(/\r?\n/).length > maxLines);

const dependencies = new Map(
  [...contents].map(([file, source]) => {
    const imports = [...source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)]
      .map((match) => path.resolve(path.dirname(file), match[1]))
      .map((target) => (path.extname(target) ? target : `${target}.js`))
      .filter((target) => contents.has(target));
    return [file, imports];
  }),
);

const visiting = new Set();
const visited = new Set();
function findCycle(file, stack = []) {
  if (visiting.has(file)) return [...stack.slice(stack.indexOf(file)), file];
  if (visited.has(file)) return null;
  visiting.add(file);
  for (const dependency of dependencies.get(file) || []) {
    const cycle = findCycle(dependency, [...stack, file]);
    if (cycle) return cycle;
  }
  visiting.delete(file);
  visited.add(file);
  return null;
}

const cycle = files.map((file) => findCycle(file)).find(Boolean);
if (oversized.length || cycle) {
  for (const [file, source] of oversized) {
    console.error(`${path.relative(backendRoot, file)} exceeds ${maxLines} lines (${source.split(/\r?\n/).length})`);
  }
  if (cycle) console.error(`Dependency cycle: ${cycle.map((file) => path.relative(backendRoot, file)).join(" -> ")}`);
  process.exitCode = 1;
} else {
  console.log(`Backend architecture passed: ${files.length} production modules <= ${maxLines} lines; no dependency cycles.`);
}
