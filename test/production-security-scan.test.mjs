import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  scanDependencyManifests,
  scanSourceText,
} from "../scripts/production-security-scan.mjs";

test("source scan reports high-confidence secrets without printing their values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "booking-security-scan-"));
  const file = join(directory, "source.js");
  await writeFile(file, 'export const token = "ghp_abcdefghijklmnopqrstuvwxyz123456";\n', "utf8");
  try {
    const findings = scanSourceText([file]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].type, "secret");
    assert.match(findings[0].message, /GitHub token/);
    assert.equal(JSON.stringify(findings).includes("abcdefghijklmnopqrstuvwxyz123456"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("dependency scan blocks direct git, file, and remote manifest sources", async () => {
  const findings = scanDependencyManifests(["test/fixtures/security-scan-bad-package.json"], []);
  assert.deepEqual(
    findings.map((finding) => finding.message),
    [
      "dependencies.bad-git uses prohibited source git+https://example.invalid/repo.git",
      "devDependencies.bad-file uses prohibited source file:../local-package",
    ],
  );
});

test("dependency scan blocks non-registry lockfile resolution", async () => {
  const findings = scanDependencyManifests([], ["test/fixtures/security-scan-bad-lock.json"]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].message, "node_modules/bad resolves outside npm registry");
});

test("static scan allows scanner status text but blocks sensitive console output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "booking-security-static-"));
  const statusFile = join(directory, "status.js");
  const leakFile = join(directory, "leak.js");
  await writeFile(statusFile, 'console.error("Secret scan failed:");\n', "utf8");
  await writeFile(leakFile, 'console.log("token", token);\n', "utf8");
  try {
    const findings = scanSourceText([statusFile, leakFile], [""]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].type, "static");
    assert.equal(findings[0].message, "sensitive value in console logging");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});


