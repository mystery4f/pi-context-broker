import { execFileSync, spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, open, realpath, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

export function isolatedEnv({ base, agentDir, ...overrides }) {
  // Keep runtime lookup, but never inherit model credentials, host configuration,
  // NODE_OPTIONS, extension discovery flags, or the developer's home directory.
  const env = {
    PATH: process.env.PATH,
    HOME: base,
    USER: "context-broker-e2e",
    LOGNAME: "context-broker-e2e",
    LANG: "C.UTF-8",
    PI_CODING_AGENT_DIR: agentDir,
    OMP_CODING_AGENT_DIR: agentDir,
    ...overrides,
  };
  if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  return env;
}

const hostCommands = new Map();

async function resolveHost(host) {
  if (hostCommands.has(host)) return hostCommands.get(host);
  let executable;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(dir, host);
    try { await access(candidate, constants.X_OK); executable = await realpath(candidate); break; }
    catch (error) { if (error.code !== "ENOENT" && error.code !== "EACCES" && error.code !== "ENOTDIR") throw error; }
  }
  if (!executable) throw new Error(`${host}: executable not found on PATH`);
  const prefix = async (path) => {
    const handle = await open(path, "r");
    try {
      const buffer = Buffer.alloc(4096);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytesRead).toString("utf8");
    } finally { await handle.close(); }
  };
  const source = await prefix(executable);
  const voltaBin = join(process.env.VOLTA_HOME ?? join(homedir(), ".volta"), "bin");
  if (executable.startsWith(`${voltaBin}/`) || (source.startsWith("#!") && source.includes(`${voltaBin}/`))) {
    // Resolve shims with the real host environment before HOME is isolated.
    // A Volta shim under fixture HOME can recursively rediscover itself on PATH.
    executable = execFileSync(join(voltaBin, "volta"), ["which", host], {
      env: process.env, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    await access(executable, constants.X_OK);
  }
  const script = await prefix(executable);
  const command = /^#![^\n]*\bnode\b/.test(script)
    ? { file: process.execPath, prefix: [executable] }
    : { file: executable, prefix: [] };
  hostCommands.set(host, command);
  return command;
}

export async function spawnHost(host, args, options) {
  const command = await resolveHost(host);
  return spawn(command.file, [...command.prefix, ...args], { ...options, detached: process.platform !== "win32" });
}

export function signalHost(child, signal) {
  try {
    if (process.platform === "win32") child.kill(signal);
    else if (child.pid) process.kill(-child.pid, signal);
  } catch (error) { if (error.code !== "ESRCH") throw error; }
}

export async function runCommand(file, args, { cwd, env, timeoutMs = 120_000 }) {
  const child = await spawnHost(file, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    let escalation;
    const timer = setTimeout(() => {
      timedOut = true;
      signalHost(child, "SIGTERM");
      escalation = setTimeout(() => signalHost(child, "SIGKILL"), 2_000);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => { clearTimeout(timer); clearTimeout(escalation); reject(error); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      clearTimeout(escalation);
      const result = { stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") };
      if (!timedOut && code === 0) resolve(result);
      else reject(new Error(`${file}: ${timedOut ? `timed out after ${timeoutMs}ms` : `exited (code=${code}, signal=${signal})`}; stdout: ${result.stdout}; stderr: ${result.stderr}`));
    });
  });
}

export function preserveTemp(path) {
  // Ephemeral CI runners discard these automatically; locally retain evidence.
  // Never permanently delete a user's temporary session files.
  console.log(`E2E evidence retained: ${path}`);
}

export async function writeFakeProvider(base) {
  const path = join(base, "fake-provider.mjs");
  await writeFile(path, `
import { appendFileSync } from "node:fs";

function stream(model, context) {
  const captureFile = process.env.CONTEXT_BROKER_E2E_PROVIDER_CONTEXT_FILE;
  if (!captureFile) throw new Error("Missing isolated provider context capture path");
  appendFileSync(captureFile, JSON.stringify({ model: model.id, context }) + "\\n");
  const output = {
    role: "assistant", content: [{ type: "text", text: "OK" }],
    api: model.api, provider: model.provider, model: model.id,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop", timestamp: Date.now(),
  };
  const events = [
    { type: "start", partial: output },
    { type: "text_start", contentIndex: 0, partial: output },
    { type: "text_delta", contentIndex: 0, delta: "OK", partial: output },
    { type: "text_end", contentIndex: 0, content: "OK", partial: output },
    { type: "done", reason: "stop", message: output },
  ];
  let sent = false;
  return { push() {}, end() {}, result: async () => output,
    async *[Symbol.asyncIterator]() {
      if (sent) return;
      sent = true;
      for (const event of events) yield event;
    },
  };
}

export default function provider(pi) {
  pi.registerProvider("context-broker-e2e", {
    name: "Context Broker E2E Fixture", api: "context-broker-e2e-api",
    apiKey: "fixture-no-secret", baseUrl: "http://127.0.0.1",
    streamSimple: stream,
    models: [{ id: "fake", name: "Fixture", input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1_000_000, maxTokens: 4096 }],
  });
}
`);
  return path;
}
