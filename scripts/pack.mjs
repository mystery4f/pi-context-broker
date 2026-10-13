import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dry = process.argv.includes("--dry-run");
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out-dir");
const requestedOut = outIndex < 0 ? undefined : args[outIndex + 1];
if (outIndex >= 0 && (!requestedOut || !isAbsolute(requestedOut))) throw new Error("--out-dir requires an absolute directory");
if (args.some((arg, index) => arg !== "--dry-run" && arg !== "--out-dir" && !(outIndex >= 0 && index === outIndex + 1))) throw new Error("Usage: node scripts/pack.mjs [--dry-run] [--out-dir /absolute/path]");
const out = requestedOut ?? join(root, "dist");
if (!dry) await mkdir(out, { recursive: true });
const build = spawnSync("bun", ["scripts/build-tern.mjs"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);
const npm = spawnSync("npm", ["pack", "--ignore-scripts", "--json", ...(dry ? ["--dry-run"] : ["--pack-destination", out])], {
  cwd: join(root, "packages/context-broker"), stdio: "inherit",
});
if (npm.status !== 0) process.exit(npm.status ?? 1);
if (!dry) {
  const archive = spawnSync("tar", ["-czf", join(out, "tern-context-broker.tar.gz"), "-C", join(root, "packages/tern-context-broker"), "plugin.toml", "window.luau", "composer.luau", "query", "README.md", "LICENSE"], { stdio: "inherit" });
  if (archive.status !== 0) process.exit(archive.status ?? 1);
}
