# Tern Context Broker

[中文使用说明](https://github.com/yoyooyooo/pi-context-broker/blob/main/README.zh-CN.md#tern-补全) · [English usage](https://github.com/yoyooyooo/pi-context-broker#tern-completion)

The OMP broker automatically shows a caret-anchored Skill/Bundle dropdown when you type `$` or `$prefix` anywhere in the draft, including directly after prose and after earlier references. Use arrows to select, Tab or Enter to accept, and Esc to dismiss. Accepted candidates become native atomic chips with `/skill:` styling; submission expands them back to `$name` for broker injection. This automatic dropdown is supplied by the OMP extension and does not require this Tern companion.

This optional Tern window plugin adds a separate manual search dialog: press **Ctrl+Alt+Shift+K** after `$` or `$prefix`, search, then select. Selection edits the draft without submitting it. The companion never opens its centered dialog automatically.

Requires Tern 0.8.3 or later with `session:surface`, `session:event`, and `cx:pick`; OMP 18.10.3 or later with native Surface Protocol editing; Node.js 22+ on Tern's PATH. Remote panes and the Tern web client are unsupported.

After changing the OMP extension code, run `/restart` in its composer to start a new process with the same flags and resume the session. OMP 18.10.3 has no `/reload`; `/reload-plugins` refreshes discovery state without re-executing loaded extensions. `tern plugin reload` only reloads this companion.

## Local development

From the repository root:

```bash
bun install
bun run build
tern plugin link ./packages/tern-context-broker
tern plugin reload
omp -e ./packages/context-broker/src/index.ts
```

From the repository root, `bun run test:ui` installs an isolated release archive and opens a real Tern window. It verifies automatic chips, deletion/undo, mixed Skill/Bundle submission and provider-body counts, then manual Chinese/emoji replacement, cancellation and focus dismissal. Screenshots and provider evidence remain in the reported temporary directory; the runner closes its isolated window and daemon.

## GitHub installation

After this change is merged, install directly from the repository:

```bash
tern plugin install github.com/yoyooyooo/pi-context-broker/packages/tern-context-broker
```

The committed package includes `query/completion.mjs`, its bundled dependencies and license notices. Installation requires Node.js 22+ at runtime, with no Bun build, npm publication or dependency installation. To update an installed copy, repeat the install command with `--force`; remove it with `tern plugin remove context-broker`.

The companion only searches and edits the draft. The OMP broker must be loaded to inject the selected context on submission. For the latest broker changes before an npm release, build this checkout and start OMP with `-e ./packages/context-broker/src/index.ts`. Automatic dropdowns and chips come from that broker, not this companion.

An optional `tern-context-broker.tar.gz` release archive contains the same plugin directory and can also be extracted and installed with `tern plugin install <directory>`.

## Configuration

Use the same configured roots and catalogs as the broker at `~/.omp/agent/context-broker/config.yml`. The query uses the pane's working directory and queries configured records only; it does not infer OMP's hidden or dynamically discovered Skills from its system prompt.

Optional overrides live outside plugin source, at `<Tern config>/plugin-data/context-broker/config.json`:

```json
{
  "node": "/absolute/path/to/node",
  "config": "/absolute/path/to/context-broker/config.yml",
  "agentDir": "/absolute/path/to/profile/agent"
}
```

All fields are optional. For a named OMP profile, set `agentDir` or `config` to that profile's broker configuration so query and injection agree. Tern's default macOS config directory is `~/Library/Application Support/Tern`; `TERN_CONFIG_DIR` overrides it. Rebind `plugin.context-broker.complete` in Tern keyboard preferences if the default chord conflicts.

## Draft ownership

OMP owns text and cursor. The plugin snapshots both, queries the bundled CLI, then verifies pane focus, surface id, editor id, text and cursor before showing the picker and again before applying its result. The edit carries the original UTF-16 text length; OMP rejects stale edits. Chinese and emoji offsets are converted to UTF-16. Cancelling the picker leaves the draft unchanged.

This plugin queries local files and runs Node.js with your permissions. It never evaluates candidate text as shell code. Selecting a candidate only inserts its `$name`; the OMP broker loads its body when you submit the prompt.
