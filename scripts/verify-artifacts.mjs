import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { startRpc } from "../packages/context-broker/scripts/context-broker-rpc-harness.mjs";
import { writeFakeProvider, isolatedEnv } from "../packages/context-broker/scripts/context-broker-e2e-fixture.mjs";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--host" || args[1] !== "omp")) throw new Error("Usage: node scripts/verify-artifacts.mjs [--host omp]");
const host = args[1] ?? "omp";
const base = await mkdtemp(join(tmpdir(), "broker-artifacts-"));
console.log(`Artifact workspace retained: ${base}`);
function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, { cwd: base, encoding: "utf8", timeout: 180_000, maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} ${argv.join(" ")} failed: ${result.error?.message ?? result.status}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return result.stdout;
}
async function runtimePath(directory, entry) {
  assert.equal(typeof entry, "string");
  assert.ok(!isAbsolute(entry), `Absolute runtime entry: ${entry}`);
  const path = resolve(directory, entry);
  const local = relative(directory, path);
  assert.ok(local && local !== ".." && !local.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`), `Escaping runtime entry: ${entry}`);
  assert.ok((await stat(path)).isFile(), `Runtime entry is not a file: ${entry}`);
  return path;
}
async function verifyDocumentLinks(directory, entries) {
  const pending = [...entries];
  const visited = new Set();
  while (pending.length > 0) {
    const entry = pending.pop();
    const file = await runtimePath(directory, entry);
    if (!entry.endsWith(".md") || visited.has(file)) continue;
    visited.add(file);
    const document = await readFile(file, "utf8");
    for (const match of document.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const [target, fragment] = match[1].split("#");
      if (/^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      const destination = target ? resolve(dirname(file), decodeURIComponent(target)) : file;
      const local = relative(directory, destination);
      await runtimePath(directory, local);
      if (fragment) {
        const contents = await readFile(destination, "utf8");
        const anchors = [...contents.matchAll(/^#{1,6}\s+(.+)$/gm)].map(heading => heading[1].toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, "").replace(/\s/g, "-"));
        assert.ok(anchors.includes(decodeURIComponent(fragment)), `Missing documentation anchor: ${entry} -> ${match[1]}`);
      }
      pending.push(local);
    }
  }
}
const output = join(base, "archives");
run(process.execPath, [join(root, "scripts/pack.mjs"), "--out-dir", output], { cwd: root, stdio: "inherit" });
const archives = await readdir(output);
const npmArchives = archives.filter(name => name.endsWith(".tgz"));
assert.equal(npmArchives.length, 1);
const npmExtract = join(base, "npm");
const ternExtract = join(base, "tern");
await mkdir(npmExtract);
await mkdir(ternExtract);
run("tar", ["-xzf", join(output, npmArchives[0]), "-C", npmExtract]);
run("tar", ["-xzf", join(output, "tern-context-broker.tar.gz"), "-C", ternExtract]);
const installed = join(npmExtract, "package");
const manifest = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
assert.ok(manifest.pi?.extensions?.length);
assert.ok(manifest.omp?.extensions?.length);
for (const entry of [...manifest.pi.extensions, ...manifest.omp.extensions, ...Object.values(manifest.bin)]) await runtimePath(installed, entry);
await verifyDocumentLinks(installed, ["README.md", "README.zh-CN.md", "docs/reference.md", "docs/reference.zh-CN.md", "CONTRIBUTING.md"]);
await verifyDocumentLinks(ternExtract, ["README.md", "README.zh-CN.md"]);
run("npm", ["install", "--omit=dev", "--ignore-scripts", "--legacy-peer-deps", "--package-lock=false", "--no-audit", "--no-fund"], { cwd: installed, stdio: "inherit" });

const skillRoot = join(base, "skills");
await mkdir(join(skillRoot, "design-review"), { recursive: true });
const marker = "ARTIFACT_PRIVATE_SKILL_BODY_中文😀";
await writeFile(join(skillRoot, "design-review/SKILL.md"), `---\nname: design-review\ndescription: Artifact review\nautoload:\n  enabled: true\n  aliases: [架构评审]\n---\n${marker}\n`);
const config = join(base, "config.yml");
await writeFile(config, `skillRoots:\n  - ${JSON.stringify(skillRoot)}\n`);
const agentDir = join(base, "agent");
await mkdir(agentDir);
const capture = join(base, "provider.jsonl");
const env = isolatedEnv({ base, agentDir, CONTEXT_BROKER_CONFIG: config, CONTEXT_BROKER_ROOTS: skillRoot, CONTEXT_BROKER_HOST: "omp", CONTEXT_BROKER_E2E_PROVIDER_CONTEXT_FILE: capture });
const provider = await writeFakeProvider(base);
const sessionDir = join(base, "sessions");
await mkdir(sessionDir);
const rpc = await startRpc({ host, cwd: base, env, args: ["--no-extensions", "--no-skills", "--no-rules", "--no-tools", "--no-title", "--session-dir", sessionDir, "-e", provider, ...manifest.omp.extensions.flatMap(entry => ["-e", resolve(installed, entry)]), "--model", "context-broker-e2e/fake", "--system-prompt", "Only output OK."] });
try {
  await rpc.prompt("中文😀请使用$design-review。");
  await rpc.prompt("再次使用$design-review。");
} finally {
  await rpc.stop();
}
const contexts = (await readFile(capture, "utf8")).trim().split("\n").map(line => JSON.parse(line).context);
assert.equal(contexts.length, 2, "Expected exactly two provider requests");
for (const [turn, context] of contexts.entries()) assert.equal(JSON.stringify(context).split(marker).length - 1, 1, `Provider turn ${turn + 1}: skill body must appear exactly once`);

const ternManifest = await readFile(join(ternExtract, "plugin.toml"), "utf8");
assert.match(ternManifest, /^schema\s*=\s*1\s*$/m);
const windowEntry = ternManifest.match(/^window\s*=\s*"([^"]+)"\s*$/m)?.[1];
assert.ok(windowEntry, "Tern manifest must declare a window entry");
const visited = new Set();
async function luauClosure(entry) {
  const path = await runtimePath(ternExtract, entry);
  if (visited.has(path)) return;
  visited.add(path);
  const source = await readFile(path, "utf8");
  for (const match of source.matchAll(/require\(\s*"(\.[^"]+)"\s*\)/g)) {
    const dependency = resolve(dirname(path), match[1].endsWith(".luau") ? match[1] : `${match[1]}.luau`);
    await luauClosure(relative(ternExtract, dependency));
  }
  for (const match of source.matchAll(/tern\.plugin\.dir\s*\.\.\s*"\/([^"]+)"/g)) await runtimePath(ternExtract, match[1]);
}
await luauClosure(windowEntry);
const npmQuery = await runtimePath(installed, manifest.bin["context-broker-complete"]);
const ternQuery = await runtimePath(ternExtract, "query/completion.mjs");
await access(npmQuery, constants.X_OK);
await access(ternQuery, constants.X_OK);
const text = "中文😀\n使用 $架构 tail";
const cursor = text.indexOf(" tail");
const request = JSON.stringify({ version: 1, text, cursor, cwd: base, config });
for (const executable of [npmQuery, ternQuery]) {
  // Each invocation starts an independent Node process outside the checkout.
  const response = JSON.parse(run(process.execPath, [executable], { input: request, env }));
  assert.deepEqual(response.edit, { from: text.indexOf("$"), to: cursor, len: text.length, prefix: "$架构" });
  const item = response.items.find(item => item.value === "$design-review");
  assert.ok(item, "Packaged query must discover configured Chinese alias");
  assert.equal(text.slice(0, response.edit.from) + item.value + text.slice(response.edit.to), "中文😀\n使用 $design-review tail");
  assert.ok(!JSON.stringify(response).includes(marker), "Query must not expose skill body");
  const bad = spawnSync(process.execPath, [executable], { cwd: base, env, encoding: "utf8", input: JSON.stringify({ version: 1, text: "😀", cursor: 1, cwd: base, config }), timeout: 20_000 });
  assert.equal(bad.status, 1, "Query must reject a split UTF-16 surrogate pair");
  assert.match(bad.stderr, /surrogate/i);
}
console.log(`Artifact verification passed: bilingual documentation navigation, npm production install, unpacked OMP two-turn provider context, npm and Tern independent Node queries, Tern runtime closure. Fixtures retained: ${base}`);
