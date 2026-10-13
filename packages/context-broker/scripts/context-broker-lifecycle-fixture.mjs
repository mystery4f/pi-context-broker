import { readFileSync } from "node:fs";

// Control only the summary boundary, through the host's public compaction hook.
// Native preparation, branch mutation, session persistence and provider conversion
// still run in OMP. This avoids a network summarizer in a no-secret regression.
export default function lifecycleFixture(pi) {
  pi.on("session_before_compact", (event, ctx) => {
    const mode = readFileSync(process.env.CONTEXT_BROKER_E2E_COMPACTION_MODE_FILE, "utf8").trim();
    const branch = ctx.sessionManager.getBranch();
    const bodyEntry = branch.find((entry) =>
      (entry.type === "custom_message" && entry.customType === "context-broker") ||
      (entry.type === "message" && entry.message?.role === "custom" && entry.message?.customType === "context-broker"),
    );
    if (!bodyEntry) throw new Error("Lifecycle compaction fixture requires an injected body");
    const firstKeptEntryId = mode === "keep" ? bodyEntry.id : branch.at(-1)?.id;
    if (!firstKeptEntryId) throw new Error("Lifecycle compaction fixture has no retained entry");
    const summary = mode === "marker"
      ? '<context-broker-record kind="skill" name="lifecycle-context" path="fixture">An example marker without the skill body.</context-broker-record>'
      : "The previous conversation contains ordinary notes. No skill instructions are included in this summary.";
    if (!["keep", "remove", "marker"].includes(mode)) throw new Error("Unsupported lifecycle compaction mode");
    return { compaction: { summary, firstKeptEntryId, tokensBefore: event.preparation.tokensBefore } };
  });
}
