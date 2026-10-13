import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { appendFile, mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFakeProvider } from "../packages/context-broker/scripts/context-broker-e2e-fixture.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = await mkdtemp(join(tmpdir(), "broker-native-ui-"));
const socket = join(base, "control.sock");
const daemonSocket = join(base, "daemon.sock");
const ternDir = join(base, "tern");
const env = { ...process.env, TERN_CONFIG_DIR: ternDir, TERN_DAEMON_SOCKET: daemonSocket, STENCIL_LOG_DIR: join(base, "logs") };
const shellQuote = text => `'${text.replaceAll("'", "'\\''")}'`;
function run(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: base, env, encoding: "utf8", timeout: 30_000, ...options });
  if (result.status !== 0) throw new Error(`${file}: ${result.stdout || result.stderr || result.error}`);
  return result.stdout;
}
function ctl(...args) {
  const result = JSON.parse(run("tern", ["ctl", "--control", socket, ...args]));
  assert.notEqual(result.ok, false, JSON.stringify(result));
  return result;
}
function nodes(value) {
  if (!value || typeof value !== "object") return [];
  return [...(Array.isArray(value) ? [] : [value]), ...Object.values(value).flatMap(nodes)];
}
function texts(value) { return nodes(value).flatMap(node => typeof node.text === "string" ? [node.text] : []); }
const editor = () => ctl("tree", ".sf-editor").nodes[0];
const type = text => ctl("type", JSON.stringify(text));
const key = chord => ctl("key", chord);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(label, predicate) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) { if (await predicate()) return; await pause(100); }
  throw new Error(`Native UI timed out: ${label}`);
}
const capturePath = join(base, "provider.jsonl");
async function captures() {
  try { return (await readFile(capturePath, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line).context); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
async function draft(text) { key("cmd+a"); key("backspace"); type(text); }
async function accept(prefix) {
  type(prefix);
  await until(`candidate ${prefix}`, () => texts(ctl("tree")).some(text => text.includes("[skill]") || text.includes("[bundle]")));
  key("tab");
}
async function submit(expectedRequest, alpha, bundle) {
  key("enter");
  await until("provider request", async () => (await captures()).length === expectedRequest);
  const context = (await captures()).at(-1);
  const body = JSON.stringify(context.messages);
  assert.equal(body.split("NATIVE_UI_ALPHA_BODY_CANARY").length - 1, alpha);
  assert.equal(body.split('<context-broker-record kind=\\"bundle\\" name=\\"ui-bundle\\"').length - 1, bundle);
  await until("idle composer", () => editor()?.text === "What are we cooking?");
}
const provider = await writeFakeProvider(base);
const skillRoot = join(base, "skills");
for (const [name, marker] of [["ui-alpha", "NATIVE_UI_ALPHA_BODY_CANARY"], ["ui-beta", "NATIVE_UI_BETA_BODY_CANARY"]]) {
  await mkdir(join(skillRoot, name), { recursive: true });
  await writeFile(join(skillRoot, name, "SKILL.md"), `---\nname: ${name}\ndescription: Native UI verification\n---\n${marker}\n`);
}
const config = join(base, "broker.yml");
const catalog = join(base, "catalog.yml");
await writeFile(catalog, "version: 1\nrecords:\n  - kind: bundle\n    name: ui-bundle\n    description: Native UI bundle\n    members:\n      include: [ui-beta]\n");
await writeFile(config, `skillRoots:\n  - ${JSON.stringify(skillRoot)}\ndiscoveryCatalogs:\n  - ${JSON.stringify(catalog)}\n`);
const agentDir = join(base, "agent");
await mkdir(agentDir);
await writeFile(join(agentDir, "config.yml"), "startup:\n  setupWizard: false\n  checkUpdate: false\ncompaction:\n  enabled: false\n");
await mkdir(join(ternDir, "plugin-data/context-broker"), { recursive: true });
await writeFile(join(ternDir, "plugin-data/context-broker/config.json"), JSON.stringify({ config, agentDir }));
const release = join(base, "release");
await mkdir(release);
const archive = join(base, "tern-context-broker.tar.gz");
run("tar", ["-czf", archive, "-C", join(root, "packages/tern-context-broker"), "plugin.toml", "window.luau", "composer.luau", "query", "README.md", "LICENSE"]);
run("tar", ["-xzf", archive, "-C", release]);
const omp = process.env.BROKER_UI_OMP ?? "omp";
const launcher = join(base, "start.sh");
const launchArgs = [omp, "--no-extensions", "--no-skills", "--no-rules", "--no-title", "--no-tools", "--session-dir", join(base, "sessions"), "-e", provider, "-e", join(root, "packages/context-broker/src/index.ts"), "--model", "context-broker-e2e/fake"];
await writeFile(launcher, `#!/bin/sh\nexport PI_CODING_AGENT_DIR=${shellQuote(agentDir)}\nexport CONTEXT_BROKER_CONFIG=${shellQuote(config)}\nexport CONTEXT_BROKER_E2E_PROVIDER_CONTEXT_FILE=${shellQuote(capturePath)}\nexec ${launchArgs.map(shellQuote).join(" ")}\n`, { mode: 0o755 });
let tern;
let daemon;
const ownedProcesses = [];
const processFile = join(base, "owned-processes.json");
async function own(child, role) {
  ownedProcesses.push({ role, pid: child.pid, command: child.spawnargs });
  await writeFile(processFile, JSON.stringify(ownedProcesses, null, 2) + "\n");
}
async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const escalation = setTimeout(() => child.kill("SIGKILL"), 2_000);
  await new Promise(resolve => child.once("close", resolve));
  clearTimeout(escalation);
}
try {
  daemon = spawn("tern", ["daemon", "--socket", daemonSocket], { cwd: base, env, stdio: ["ignore", "ignore", "pipe"] });
  let daemonFailure;
  let daemonLogs = Promise.resolve();
  daemon.on("error", error => { daemonFailure = error; });
  daemon.stderr.on("data", data => { daemonLogs = daemonLogs.then(() => appendFile(join(base, "daemon-start.log"), data)); });
  await own(daemon, "daemon");
  await until("owned daemon socket", async () => {
    if (daemonFailure) throw daemonFailure;
    if (daemon.exitCode !== null || daemon.signalCode !== null) throw new Error("Owned Tern daemon exited before readiness");
    try { return (await stat(daemonSocket)).isSocket(); }
    catch (error) { if (error.code === "ENOENT") return false; throw error; }
  });
  await daemonLogs;
  tern = spawn("tern", ["--control", socket, "--out", join(base, "shots")], { cwd: base, env, stdio: ["ignore", "pipe", "pipe"] });
  await own(tern, "window");
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("Tern control did not become ready")), 30_000);
    let logs = "";
    tern.stderr.on("data", data => { logs += data; if (logs.includes(`control on ${socket}`)) { clearTimeout(deadline); resolve(); } });
    tern.on("error", reject);
    tern.on("exit", code => { clearTimeout(deadline); reject(new Error(`Tern exited early: ${code}`)); });
  });
  run("tern", ["plugin", "install", release, "--json"]);
  const installed = JSON.parse(run("tern", ["plugin", "list", "--json"]));
  assert.ok(installed.plugins.some(plugin => plugin.id === "context-broker" && plugin.status === "ready"));
  assert.deepEqual(installed.problems, []);
  ctl("ready");
  ctl("run", shellQuote(launcher));
  await until("OMP editor", () => Boolean(editor()));
  const rect = editor().rect;
  ctl("click", String(rect[0] + 100), String(rect[1] + 10));
  await accept("中文😀正文$ui-a");
  assert.ok(editor().text.includes("$ui-alpha"));
  key("left"); key("backspace");
  assert.equal(editor().text, "中文😀正文");
  key("ctrl+z");
  assert.ok(editor().text.includes("$ui-alpha"));
  await accept("，再$ui-bu");
  type("，请执行");
  assert.ok(editor().text.includes("$ui-alpha") && editor().text.includes("$ui-bundle"));
  ctl("shot", "automatic-mixed");
  await submit(1, 1, 1);
  const firstUser = (await captures())[0].messages.filter(message => message.role === "user").at(-1);
  assert.ok(JSON.stringify(firstUser).includes("$ui-alpha") && JSON.stringify(firstUser).includes("$ui-bundle"));
  await accept("$ui-a"); type("，再次调用"); await submit(2, 1, 1);
  await draft("前文😀$ui-a tail");
  for (let i = 0; i < 5; i++) key("left");
  key("escape"); key("ctrl+alt+shift+k");
  await until("manual picker", () => ctl("tree", "input").nodes.some(node => node.placeholder === "Search Context Broker Skills and Bundles"));
  ctl("shot", "manual-picker");
  key("enter");
  await until("manual native replacement", () => editor()?.text === "前文😀$ui-alpha tail");
  assert.equal((await captures()).length, 2, "manual selection must not submit a prompt");
  ctl("shot", "manual-replacement");
  await draft("$ui-"); key("escape"); key("ctrl+alt+shift+k");
  await until("cancel picker", () => ctl("tree", "input").nodes.length > 0);
  key("escape"); assert.equal(editor().text, "$ui-");
  await draft("$ui-a"); key("escape"); key("ctrl+alt+shift+k");
  await until("picker before focus change", () => ctl("tree", "input").nodes.length > 0);
  ctl("click", String(rect[0] + 100), String(rect[1] + 10));
  await until("picker dismissed on focus change", () => ctl("tree", "input").nodes.length === 0);
  assert.equal(editor().text, "$ui-a");
  assert.equal((await captures()).length, 2);
  console.log(`Native UI passed: clean Tern release install, automatic chips/delete/undo/mixed submit/dedup, Unicode manual replacement, cancellation and focus dismissal. Evidence: ${base}`);
} finally {
  try { if (tern && tern.exitCode === null && tern.signalCode === null) ctl("quit"); }
  catch {}
  await stop(tern);
  await stop(daemon);
  await writeFile(join(base, "cleanup.json"), JSON.stringify({ stopped: true, processes: ownedProcesses }, null, 2) + "\n");
  console.log(`Native UI fixtures retained: ${base}`);
}
