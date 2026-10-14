import { build } from "bun";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const broker = join(root, "packages/context-broker");
const tern = join(root, "packages/tern-context-broker");
const result = await build({
  entrypoints: [join(broker, "src/completion-cli.ts")],
  target: "node",
  format: "esm",
  packages: "bundle",
  external: ["@oh-my-pi/pi-coding-agent", "@oh-my-pi/pi-coding-agent/modes/components"],
  minify: true,
});
if (!result.success) throw new AggregateError(result.logs, "Completion query build failed");
const output = result.outputs[0];
if (!output) throw new Error("Completion query build emitted no program");
const yamlLicense = await readFile(join(dirname(createRequire(join(broker, "package.json")).resolve("yaml/package.json")), "LICENSE"), "utf8");
const program = await output.text();
const prefixEnd = program.startsWith("#!") ? program.indexOf("\n") + 1 : 0;
const code = `${program.slice(0, prefixEnd)}/*\nBundled dependency: yaml (ISC)\n${yamlLicense.trim()}\n*/\n${program.slice(prefixEnd)}`;
for (const path of [join(broker, "dist/completion.mjs"), join(tern, "query/completion.mjs")]) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, code);
  await chmod(path, 0o755);
}
for (const name of ["README.md", "README.zh-CN.md", "CONTRIBUTING.md", "LICENSE", "SECURITY.md", "CHANGELOG.md"]) {
  const contents = await readFile(join(root, name), "utf8");
  const projected = contents
    .replaceAll("./packages/context-broker/examples/", "./examples/")
    .replaceAll("./packages/context-broker/docs/", "./docs/")
    .replaceAll("./packages/tern-context-broker/README.md", "https://github.com/yoyooyooo/pi-context-broker/blob/main/packages/tern-context-broker/README.md")
    .replaceAll("./packages/tern-context-broker/README.zh-CN.md", "https://github.com/yoyooyooo/pi-context-broker/blob/main/packages/tern-context-broker/README.zh-CN.md")
    .replaceAll("(.agents/skills/verify-context-broker/SKILL.md)", "(https://github.com/yoyooyooo/pi-context-broker/tree/main/.agents/skills/verify-context-broker/SKILL.md)");
  await writeFile(join(broker, name), projected);
}
await copyFile(join(root, "LICENSE"), join(tern, "LICENSE"));
const manifest = await readFile(join(tern, "plugin.toml"), "utf8");
const metadata = JSON.parse(await readFile(join(tern, "package.json"), "utf8"));
if (!manifest.includes(`version = "${metadata.version}"`)) throw new Error("Tern package and manifest versions differ");
console.log("Built standalone broker query and Tern plugin query");
