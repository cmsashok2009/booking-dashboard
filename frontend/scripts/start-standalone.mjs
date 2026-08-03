import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next", "standalone");
await mkdir(path.join(standalone, ".next"), { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
  force: true
});
await cp(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
  force: true
});
process.env.NODE_ENV = "production";
process.env.HOSTNAME ||= "127.0.0.1";
process.env.PORT ||= "3010";
await import("../.next/standalone/server.js");
