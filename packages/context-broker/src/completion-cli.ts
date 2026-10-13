#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { completeDollarRequest, parseCompletionRequest } from "./completion";

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`Usage: context-broker-complete\n\nRead one JSON request from stdin and write one JSON response to stdout.\nRequest: {"version":1,"text":"use $des","cursor":8,"cwd":"/workspace","config":"/optional/config.yml"}\nOffsets use UTF-16 code units. Only configured Skill roots and catalogs are queried.\nEnvironment: CONTEXT_BROKER_CONFIG, PI_CODING_AGENT_DIR, CONTEXT_BROKER_HOST.\n`);
    return;
  }
  if (process.argv.length > 2) throw new Error("Unexpected arguments; use --help");
  const input: unknown = JSON.parse(readFileSync(0, "utf8"));
  const request = parseCompletionRequest(input);
  process.chdir(request.cwd);
  process.env.CONTEXT_BROKER_HOST = "omp";
  if (request.config) process.env.CONTEXT_BROKER_CONFIG = request.config;
  const result = await completeDollarRequest(request);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`context-broker-complete: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
