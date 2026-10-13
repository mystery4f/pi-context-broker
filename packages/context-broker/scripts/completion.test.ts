import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { completeDollarRequest, parseCompletionRequest } from "../src/completion";
import { createDollarSkillAutocompleteProvider } from "../src/dollar";

const root = await mkdtemp(join(tmpdir(), "broker-completion-"));
await mkdir(join(root, "design-review"));
await writeFile(join(root, "design-review/SKILL.md"), "---\nname: design-review\ndescription: Review API boundaries\nautoload:\n  aliases: [架构评审]\n---\nPRIVATE_BODY_MARKER\n");
const config = { skillRoots: [root], requireAutoload: false };
const draft = "中文😀\n使用 $架构 tail";
const cursor = draft.indexOf(" tail");
const result = await completeDollarRequest(parseCompletionRequest({ version: 1, text: draft, cursor, cwd: root }), config);
assert.deepEqual(result.edit, { from: draft.indexOf("$"), to: cursor, len: draft.length, prefix: "$架构" });
assert.equal(result.items[0]?.value, "$design-review");
assert.equal(draft.slice(0, result.edit!.from) + result.items[0]!.value + draft.slice(result.edit!.to), "中文😀\n使用 $design-review tail");
assert.ok(!JSON.stringify(result).includes("PRIVATE_BODY_MARKER"));
assert.equal((await completeDollarRequest({ version: 1, text: "$missing", cursor: 8, cwd: root }, config)).items.length, 0);
assert.throws(() => parseCompletionRequest({ version: 1, text: "😀", cursor: 1, cwd: root }), /surrogate/);
assert.throws(() => parseCompletionRequest({ version: 2, text: "$", cursor: 1, cwd: root }), /version/);
const provider = createDollarSkillAutocompleteProvider({
  async getSuggestions() { return null; },
  applyCompletion(lines, cursorLine, cursorCol) { return { lines, cursorLine, cursorCol }; },
}, Promise.resolve([{ name: "design-review", normalizedName: "design-review", description: "Review", normalizedDescription: "review", aliases: [], normalizedAliases: [], path: join(root, "design-review/SKILL.md") }]));
const hostSignal = new AbortController();
assert.equal((await provider.getSuggestions(["$des"], 0, 4, hostSignal.signal))?.items[0]?.value, "$design-review");
const inlineDraft = "中文😀使用$des tail";
const inlineCursor = inlineDraft.indexOf(" tail");
const inlineSuggestions = await provider.getSuggestions([inlineDraft], 0, inlineCursor);
assert.equal(inlineSuggestions?.items[0]?.value, "$design-review");
const inlineCompleted = provider.applyCompletion([inlineDraft], 0, inlineCursor, inlineSuggestions!.items[0], inlineSuggestions!.prefix);
assert.equal(inlineCompleted.lines[0], "中文😀使用$design-review tail");
const repeatedDraft = "先$design-review 再$des";
assert.equal((await provider.getForceFileSuggestions!([repeatedDraft], 0, repeatedDraft.length))?.items[0]?.value, "$design-review");
hostSignal.abort();
assert.equal(await provider.getSuggestions(["$des"], 0, 4, hostSignal.signal), null);
console.log(`Completion behavior passed; fixtures retained: ${root}`);
