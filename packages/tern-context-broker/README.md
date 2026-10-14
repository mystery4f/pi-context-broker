# Tern Context Broker

[English](./README.md) | [中文](./README.zh-CN.md) · [Project overview](https://github.com/yoyooyooo/pi-context-broker#readme)

[Install](#install) · [Use](#use) · [Configuration](#configuration) · [Development](#local-development)

An optional Tern window plugin for searching local Skills and Bundles from the OMP draft. Press **Ctrl+Alt+Shift+K**, choose a record, then submit the completed prompt when ready.

The OMP broker supplies automatic `$` dropdowns and native chips. This companion adds manual search and edits the draft; the broker loads the selected context on submission.

## Requirements

- Tern 0.8.3+ with native `session:surface`, `session:event` and `cx:pick` APIs.
- OMP 18.10.3+ with the Context Broker extension loaded.
- Node.js 22+ on Tern's PATH, or an explicit `node` setting.
- A local OMP pane. Remote panes and the Tern web client are unsupported.

Install and configure the broker using the [project quick start](https://github.com/yoyooyooo/pi-context-broker#quick-start). GitHub `main` may include broker changes ahead of npm; that guide also describes launching the current checkout.

## Install

```bash
tern plugin install github.com/yoyooyooo/pi-context-broker/packages/tern-context-broker
tern plugin list --json
```

The committed directory includes `query/completion.mjs`, bundled dependencies and license notices. Installation needs no Bun build, npm release or dependency installation. `plugin list` should show `context-broker` with `status: ready` and no problems. Installation reloads the running daemon; if no daemon is running, changes apply at its next start.

Update the installed copy by repeating the install command with `--force`:

```bash
tern plugin install github.com/yoyooyooo/pi-context-broker/packages/tern-context-broker --force
```

Remove the plugin with `tern plugin remove context-broker`. Optional release archives can also be extracted and installed with `tern plugin install <directory>`.

## Use

1. Focus a local OMP pane and place the cursor after `$` or `$prefix`, for example `Review $des`.
2. If the automatic dropdown is visible, press **Esc** to dismiss it. Then press **Ctrl+Alt+Shift+K** to open manual search, filter the returned candidates and choose one.
3. Check that the draft contains `$design-review`. Selection does not submit the prompt; cancelling leaves the draft unchanged.
4. Submit when ready. The loaded OMP broker resolves the reference and injects its context.

The query searches configured Skill roots and catalogs in the pane's working directory. It does not inherit dynamically discovered Skills from OMP's system prompt. Rebind `plugin.context-broker.complete` in Tern keyboard preferences if the default shortcut conflicts.

## Using both plugins

Tern renders OMP's native interface; OMP still runs its own extensions and model requests. The broker and companion can be installed together, with these responsibilities:

| Installed components | Available behavior |
| --- | --- |
| OMP broker | Automatic `$` completion, native chips and context injection |
| Tern companion | Manual search and `$name` insertion; broker context injection requires the OMP extension |
| Both | Broker behavior plus the manual Tern search dialog |

The companion edits the draft only when its shortcut is invoked; it does not submit prompts or inject context. Injection and deduplication belong to the OMP broker. If the text, cursor or focus changes during manual search, the companion cancels the stale operation.

The automatic dropdown and manual dialog have independent triggers and no explicit mutual exclusion. Close the automatic dropdown with **Esc** before opening manual search with **Ctrl+Alt+Shift+K**. Native UI verification covers that sequence; opening both menus at once is not covered, so coexistence does not guarantee conflict-free simultaneous menus.

The OMP instance launched by Tern must load the broker from its active agent directory or profile. Match the companion's configuration to that profile as described below.


## Configuration

By default, the query reads `~/.omp/agent/context-broker/config.yml`, using the same roots and catalogs as the broker. Full discovery settings live in the [broker reference](https://github.com/yoyooyooo/pi-context-broker/blob/main/packages/context-broker/docs/reference.md#configuration).

Optional overrides live at `<Tern config>/plugin-data/context-broker/config.json`, outside the installed plugin source:

```json
{
  "node": "/absolute/path/to/node",
  "config": "/absolute/path/to/context-broker/config.yml",
  "agentDir": "/absolute/path/to/profile/agent"
}
```

All fields are optional; replace paths with your actual installation and profile paths. For a named OMP profile, set `agentDir` or `config` to match the broker's configuration. Tern's default macOS config directory is `~/Library/Application Support/Tern`; `TERN_CONFIG_DIR` overrides it. Updating the plugin source leaves this separate configuration in place.

## Local development

For switching between local builds and GitHub, use copied installations. From the repository root:

```bash
bun install --frozen-lockfile
bun run build
tern plugin install ./packages/tern-context-broker --force
omp -e ./packages/context-broker/src/index.ts
```

After TypeScript query changes, rebuild and repeat the local installation. Luau-only edits need only another installation. Return to GitHub with the update command above. Each install replaces the same copied plugin; its `plugin-data` configuration remains separate.

For live Luau development, `tern plugin link ./packages/tern-context-broker` uses the source directory directly, and `tern plugin reload` reloads it. Linking fails if a copy is already installed, and `--force` never replaces a linked plugin. Back up or move an existing copy to the system trash before linking. Run `tern plugin unlink context-broker` before returning to copied installations. Keep logs and runtime configuration outside the linked source.

After changing broker extension code or configuration, run `/restart` in OMP. `/reload-plugins` does not re-execute loaded extensions, and `tern plugin reload` reloads only the companion.

Run `bun run test:ui` from the repository root for isolated native UI verification. It installs the release archive into a separate Tern runtime and checks automatic chips, submission, deduplication and manual Unicode replacement, cancellation and focus changes. Screenshots and provider evidence are retained; the runner closes its own window and daemon.

## Troubleshooting and draft safety

If the command does not open a picker, focus the OMP composer and place the cursor after `$` or a prefix. If no candidates match, run `/context-broker doctor` and `/context-broker find <query>` in OMP, then verify that the companion uses the same profile and configured roots. For Node startup errors, check Node.js 22+ is available to Tern or set `node` explicitly.

OMP owns the text and cursor. The companion checks pane focus, surface, editor, text and cursor before showing the picker and before applying its result. OMP rejects edits with a stale original text length. Chinese and emoji offsets use UTF-16. A draft or focus change cancels the pending completion.

The companion reads local files and launches Node.js with your permissions. Candidate strings are never executed as shell commands. See the [security policy](https://github.com/yoyooyooo/pi-context-broker/blob/main/SECURITY.md) and bundled [MIT license](./LICENSE).
