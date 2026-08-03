import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));

export function validateCycloneDxSbom(sbom, expectedName) {
  if (!sbom || sbom.bomFormat !== "CycloneDX") {
    throw new Error("SBOM must use CycloneDX format.");
  }
  if (!/^1\.[5-9]$/.test(String(sbom.specVersion || ""))) {
    throw new Error("SBOM must use CycloneDX 1.5 or newer.");
  }
  if (sbom.metadata?.component?.name !== expectedName) {
    throw new Error(`SBOM component mismatch for ${expectedName}.`);
  }
  if (!Array.isArray(sbom.components) || sbom.components.length === 0) {
    throw new Error(`SBOM for ${expectedName} contains no components.`);
  }
  if (!Array.isArray(sbom.dependencies)) {
    throw new Error(`SBOM for ${expectedName} contains no dependency graph.`);
  }
  return {
    name: expectedName,
    format: sbom.bomFormat,
    specVersion: sbom.specVersion,
    componentCount: sbom.components.length,
    dependencyCount: sbom.dependencies.length,
  };
}

export function generatePackageSbom(packageDirectory, expectedName) {
  const globalNpmCli = process.env.APPDATA
    ? path.join(
        process.env.APPDATA,
        "npm",
        "node_modules",
        "npm",
        "bin",
        "npm-cli.js",
      )
    : "";
  const bundledNpmCli = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  const npmCli =
    process.platform === "win32"
      ? [globalNpmCli, bundledNpmCli].find(
          (candidate) => candidate && existsSync(candidate),
        )
      : null;
  if (process.platform === "win32" && !npmCli) {
    throw new Error("Unable to locate the npm CLI for SBOM generation.");
  }
  const executable = npmCli ? process.execPath : "npm";
  const prefixArguments = npmCli ? [npmCli] : [];
  const raw = execFileSync(
    executable,
    [
      ...prefixArguments,
      "sbom",
      "--package-lock-only",
      "--omit=dev",
      "--sbom-format",
      "cyclonedx",
      "--sbom-type",
      "application",
    ],
    {
      cwd: packageDirectory,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const sbom = JSON.parse(raw);
  return { sbom, summary: validateCycloneDxSbom(sbom, expectedName) };
}

export async function generateWorkspaceSboms(outputDirectory) {
  const targetDirectory = path.resolve(outputDirectory);
  await mkdir(targetDirectory, { recursive: true });
  const targets = [
    { directory: path.join(workspaceRoot, "backend"), name: "backend" },
    { directory: path.join(workspaceRoot, "frontend"), name: "frontend" },
  ];
  const summaries = [];
  for (const target of targets) {
    const { sbom, summary } = generatePackageSbom(
      target.directory,
      target.name,
    );
    const outputPath = path.join(
      targetDirectory,
      `${target.name}.cyclonedx.json`,
    );
    await writeFile(outputPath, `${JSON.stringify(sbom, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    summaries.push({ ...summary, file: path.basename(outputPath) });
  }
  return { ok: true, outputDirectory: targetDirectory, sboms: summaries };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  const outputDirectory =
    process.argv[2] ||
    process.env.SBOM_OUTPUT_DIR ||
    path.join(workspaceRoot, ".artifacts", "sbom");
  const result = await generateWorkspaceSboms(outputDirectory);
  console.log(JSON.stringify(result));
}