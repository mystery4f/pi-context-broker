# pi-context-broker

[English](./README.md) | [中文](./README.zh-CN.md)

[Install](#install) · [Quick start](#quick-start) · [Tern](#tern-completion) · [Documentation](#documentation)

Load local Skills and Bundle indexes into Pi or OMP by naming them in your prompt:

```text
$design-review review this API boundary
```

The broker resolves `design-review`, sends its context to the model, and avoids appending another copy while that context remains in the active session branch.

## Why use it

Agent setups accumulate review checklists, runbooks and team workflows. Context Broker lets you choose the context needed for a task without loading every file at startup. It discovers local files and catalogs; it needs no remote index or embeddings.

| Record | Source | What the model receives |
| --- | --- | --- |
| Skill | A discovered `SKILL.md` | Full Skill content |
| Bundle | A YAML or JSON catalog | Description, policy and member index; member bodies are read when needed |

Use `$name` or an alias to select a record. Keyword rules can load Skills or explicit `bundle:<name>` targets. The broker also provides interactive completion and `/context-broker` diagnostics.

## Install

Install into the host you use:

```bash
# Pi
pi install npm:pi-context-broker

# OMP
omp install npm:pi-context-broker
```

The broker package requires Node.js 22+. After installing or upgrading in OMP, run `/restart` in the composer to resume the session with the new extension code. `/reload-plugins` refreshes discovery state without re-executing loaded extensions.

The npm package and GitHub `main` are separate distribution inputs. To try the current checkout before an npm release, run these commands from the repository root:

```bash
bun install --frozen-lockfile
bun run build

# Choose one host
pi -e ./packages/context-broker/src/index.ts
omp -e ./packages/context-broker/src/index.ts
```

The optional Tern companion has its own [GitHub installation](#tern-completion).

## Quick start

### 1. Configure a Skill directory

Create `~/.pi/agent/context-broker/config.yml` for Pi or `~/.omp/agent/context-broker/config.yml` for OMP:

```yaml
skillRoots:
  - ~/context/skills
requireAutoload: false
pathMode: home-relative
logPaths: false
```

If you use a custom agent directory or OMP profile, see [configuration resolution](./packages/context-broker/docs/reference.md#configuration). Restart the host after changing configuration; in OMP, use `/restart`.

### 2. Add a Skill

Create `~/context/skills/design-review/SKILL.md`:

```markdown
---
name: design-review
description: Review architecture and API trade-offs.
autoload:
  enabled: true
  aliases:
    - architecture-review
---

Review the design for ownership, boundaries, failure modes, and migration cost.
```

### 3. Check discovery, then submit

Run these commands in the host composer:

```text
/context-broker doctor
/context-broker find design
/context-broker explain design-review
```

`doctor` should report `Config diagnostics: ok` and no namespace collisions. `explain` should show `kind: skill` and `inject: full-file` for `design-review`.

Then submit:

```text
$design-review review this API boundary
```

The next model request includes the Skill content. Submitting the same record again produces an `already loaded` notice while the content remains loaded. A rewind or compaction that removes the body allows it to load again; deduplication does not remove existing context from subsequent requests.

## Tern completion

With OMP 18.10.3+, typing `$` or `$prefix` shows the broker's automatic dropdown. Use arrows to select, Tab or Enter to accept, and Esc to dismiss. Accepted entries become native chips; submission expands them to `$name` for injection. This works directly after prose and with multiple references in a draft.

The optional Tern companion adds a manual search dialog on **Ctrl+Alt+Shift+K**. It requires Tern 0.8.3+, OMP 18.10.3+ and Node.js 22+, and supports local OMP panes. Install it directly from GitHub:

```bash
tern plugin install github.com/yoyooyooo/pi-context-broker/packages/tern-context-broker
```

The GitHub directory includes the query and its dependencies, so installation needs no Bun build or npm release. Both completion paths edit the draft; the broker injects context when you submit.

Both plugins can be installed together: Tern renders the native interface while OMP continues to run the broker extension, which owns context injection. When switching from the automatic dropdown to manual search, press **Esc** first, then **Ctrl+Alt+Shift+K**. The two menus do not explicitly close each other; simultaneous opening is outside the verified workflow. See [using both plugins](./packages/tern-context-broker/README.md#using-both-plugins).

See the [Tern package guide](./packages/tern-context-broker/README.md) for configuration, updating, removal and local development.

## Documentation

- [Broker reference](./packages/context-broker/docs/reference.md): Skill precedence, Bundles, configuration, environment variables, rules, payloads and completion CLI.
- [Tern package guide](./packages/tern-context-broker/README.md): manual search, profiles, draft safety and switching between GitHub and local builds.
- [Configuration examples](./packages/context-broker/examples/config.example.yml) and [catalog example](./packages/context-broker/examples/discovery-catalog.example.yaml).
- [Contributing](./CONTRIBUTING.md): development checks, verification and release workflow.
- [Changelog](./CHANGELOG.md) and [security policy](./SECURITY.md).

## Privacy and support

The broker runs with the host agent's local permissions. Selected Skill content is sent to your configured model provider and stored in session history. Bundles expose member metadata and paths; their bodies are loaded separately. Use trusted roots and catalogs. Paths are home-relative by default; `pathMode: hash` provides stronger path redaction, and decision logs omit paths unless enabled.

Local Pi/OMP checks have run on macOS; CI runs CLI and artifact checks on Linux. Windows path-list separators are supported, but Windows runtime behavior remains unverified. Native Tern UI checks require macOS; remote panes and the Tern web client are unsupported by the manual companion.

Report bugs through [GitHub Issues](https://github.com/yoyooyooo/pi-context-broker/issues); use the [private security reporting channel](https://github.com/yoyooyooo/pi-context-broker/security/advisories/new) for vulnerabilities. Licensed under [MIT](./LICENSE); bundled dependency notices are included in the distributed query.
