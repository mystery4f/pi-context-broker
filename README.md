# pi-context-broker

[English](./README.md) | [中文](./README.zh-CN.md)

`pi-context-broker` lets you pull local agent context into Pi or OMP with a plain `$name` in your prompt.

```text
$design-review review this API boundary
```

The plugin finds `design-review`, injects the matching local `SKILL.md` or bundle index, and skips duplicate injections in the same active session branch.

Deduplication checks the active branch's effective context. Completing and submitting the same record again produces an `already loaded` notice. A fork retaining the body still skips it; a rewind or compaction removing the body allows it to load again. XML examples in ordinary user, assistant or tool messages are not loading evidence. Deduplication prevents a second copy from being appended; the existing body still travels with the conversation context.

## The problem

Agent setups collect useful context over time: review checklists, project runbooks, team workflows, provider notes, debugging recipes, and personal skills. Loading all of them at startup makes the prompt noisy. Asking the model to remember the right file is unreliable. Opening files by hand breaks flow.

Context Broker adds a small routing layer between your prompt and your local context library. You name the context you want. The plugin resolves it and injects it once.

It does not run a remote indexer, guess from embeddings, or load everything in the background. The user stays in control.

## What you get

- `$name` lookup for local skills and catalog records.
- Pi and OMP interactive autocomplete dropdowns for `$...` entries.
- Rule-based injection, such as `review this design` loading `design-review`.
- Explicit `bundle:<name>` rule targets for keyword-triggered bundle indexes.
- Bundle records for large context areas where the model should see an index before choosing a member.
- `/context-broker` commands for setup checks and lookup debugging.
- Namespace collision checks for names and aliases.
- Duplicate-injection protection for the active session branch.
- Path privacy controls for model payloads, session metadata, and JSONL logs.
- Bounded scanning defaults so a bad root does not read the world.

## How it works

Context Broker has two record types.

| Record | Comes from | What gets injected |
| --- | --- | --- |
| `skill` | A discovered `SKILL.md` file | The full skill body |
| `bundle` | A YAML or JSON catalog | The bundle description, policy, and member list |

A skill is for concrete operating instructions. A bundle is for runtime routing. Use a bundle when you have a group of related skills and want the model to choose the right member instead of receiving every member body up front.

Context Broker does not materialize durable Bundle or Router Skills. Repositories that need a globally distributed routing entry should own it as an ordinary `SKILL.md`; Context Broker will discover it through `skillRoots` like any other skill.

## Install

Pi:

```bash
pi install npm:pi-context-broker
```

OMP:

```bash
omp install npm:pi-context-broker
```

After installing, upgrading or changing OMP extension code, run `/restart` in the OMP composer to restart the process with the same launch flags and resume the current session. OMP 18.10.3 has no `/reload` command. `/reload-plugins` refreshes discovered Skills, commands, agents and MCP state without re-executing loaded extension code. `tern plugin reload` only reloads the Tern companion.

Try a local checkout without installing:

```bash
pi -e ./packages/context-broker/src/index.ts
omp -e ./packages/context-broker/src/index.ts
```

### Tern completion

Type `$` or `$prefix` anywhere in the OMP composer to automatically show a caret-anchored Skill/Bundle dropdown using the same editor UI as `/` completion. The trigger can directly follow prose, and a draft can contain multiple references, such as `Use$design-review then$workspace-collab`. Keep typing to filter, use arrows to select, Tab or Enter to accept, and Esc to dismiss. Accepting only completes the draft; it does not submit it. The OMP broker provides this dropdown without the companion Tern plugin.

Accepted candidates become native atomic chips with the same colors and editing behavior as `/skill:` chips, retaining `$name` to distinguish broker references. Backspace removes the whole chip and undo restores it. Submission expands chips back to `$name` so the broker loads every matching Skill or Bundle. Existing `/skill:` chips can coexist in the draft.

Automatic OMP dropdowns require OMP 18.10.3+ and render beside the input in Tern. The optional Tern companion provides a manual search dialog on **Ctrl+Alt+Shift+K**, requiring Tern 0.8.3+ and Node.js 22+; that dialog supports local panes only.

For a local checkout:

```bash
bun install
bun run build
tern plugin link ./packages/tern-context-broker
tern plugin reload
```

Install the optional Tern companion directly from GitHub after this change is merged:

```bash
tern plugin install github.com/yoyooyooo/pi-context-broker/packages/tern-context-broker
```

The GitHub package includes the bundled query, dependencies and license notices; installation does not need Bun, an npm release or a GitHub Release archive. The companion adds manual search and edits the draft; the OMP broker handles injection when you submit. For the latest broker changes before an npm release, build this checkout and launch OMP with `-e ./packages/context-broker/src/index.ts` as shown above. Both components use configured roots/catalogs in `~/.omp/agent/context-broker/config.yml`; the query does not inherit Skills listed in OMP's system prompt.

Override the Node executable, broker config or OMP profile with optional `node`, `config`, `agentDir` fields in `<Tern config>/plugin-data/context-broker/config.json`. Rebind `plugin.context-broker.complete` in Tern keyboard preferences. See the [Tern package guide](./packages/tern-context-broker/README.md).

## Quick start

### 1. Add a config file

Pi reads:

```text
~/.pi/agent/context-broker/config.yml
```

OMP reads:

```text
~/.omp/agent/context-broker/config.yml
```

Minimal config:

```yaml
skillRoots:
  - ~/context/skills

requireAutoload: false
pathMode: home-relative
logPaths: false
```

### 2. Add a skill

Create:

```text
~/context/skills/design-review/SKILL.md
```

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

### 3. Use it

```text
$design-review review this API boundary
```

The next model turn receives your prompt plus the `design-review` skill body.

### 4. Check what the broker sees

```text
/context-broker doctor
/context-broker find design
/context-broker explain design-review
```

## Skills

Context Broker discovers every `SKILL.md` under `skillRoots`.

For `$` discovery and configured skill invocations, roots are scanned in configured order and the first normalized
skill name wins. Put a distributed runtime root before a source catalog when the
installed copy should take precedence. Directory and `SKILL.md` symlinks are
followed, but the discovered path is preserved for relative references. Broken
links and ancestor cycles are skipped; scan depth, ignore, and size limits still
apply. This does not rewrite links inside skill bodies or explicit bundle member
paths.

```markdown
---
name: design-review
description: Review architecture and API trade-offs.
autoload:
  enabled: true
  aliases:
    - architecture-review
---

Skill body goes here.
```

`autoload.enabled` affects rule-based injection by default. Explicit `$name` lookup can still find configured skills unless you force the autoload gate through config or environment variables.

## Bundles

Bundles live in discovery catalogs. They inject an index, not the full member files.

```yaml
version: 1
records:
  - kind: bundle
    name: workspace-collab
    description: Collaboration contexts for documents, chat, and tasks.
    aliases:
      - collab
    render:
      type: member-index
      rules:
        - This is a context bundle index, not a concrete skill.
        - Select the needed member before acting.
        - Read the selected member file before using member-specific details.
    policy:
      memberBody: read-before-use
      scope: members-only
    members:
      include:
        - docs
        - chat
```

When you type `$workspace-collab`, the model sees the bundle description, policy, and member list. It does not receive `docs` and `chat` bodies unless a later step reads them.

Rules can inject the same lightweight index without loading member bodies:

```yaml
id: collaboration-keywords
inject:
  - bundle:workspace-collab
match:
  - contains:
      - team workspace
```

The `bundle:` prefix is required for rule targets. Unprefixed rule targets keep the existing Skill-only behavior. Bundle rule lookup uses exact names or aliases from configured discovery catalogs and does not fuzzy-match.

## Configuration

Config resolution order:

1. `CONTEXT_BROKER_CONFIG`
2. `<agentDir>/context-broker/config.yml`
3. `<agentDir>/context-broker/config.yaml`
4. `<agentDir>/context-broker/config.json`

`PI_CODING_AGENT_DIR` sets `agentDir` when present. Otherwise the plugin uses the host default:

- Pi: `~/.pi/agent`
- OMP: `~/${PI_CONFIG_DIR:-.omp}/agent`

Full config example:

```yaml
skillRoots:
  - ~/context/skills
extraSkillRoots:
  - ./.agents/skills

# If omitted, the broker uses context-broker/rules next to the config file.
ruleRoots:
  - ./context-broker/rules

discoveryCatalogs:
  - ~/context/catalogs/workspace.yaml
extraDiscoveryCatalogs:
  - ./context/catalogs/project.yaml

requireAutoload: true

# absolute | home-relative | basename | hash
pathMode: home-relative
logPaths: false

scan:
  maxDepth: 8
  maxSkillBytes: 65536
  ignore:
    - .git
    - node_modules
    - dist
    - build
    - coverage
```

### Environment variables

| Variable | Effect |
| --- | --- |
| `CONTEXT_BROKER_CONFIG` | Use one explicit config file |
| `CONTEXT_BROKER_ROOTS` | Replace `skillRoots` with a path-list |
| `CONTEXT_BROKER_EXTRA_ROOTS` | Append skill roots |
| `CONTEXT_BROKER_DISCOVERY_CATALOGS` | Replace `discoveryCatalogs` with a path-list |
| `CONTEXT_BROKER_EXTRA_DISCOVERY_CATALOGS` | Append discovery catalogs |
| `CONTEXT_BROKER_REQUIRE_ENABLED=0` | Allow all discovered skills for rule matching |
| `CONTEXT_BROKER_REQUIRE_ENABLED=1` | Require `autoload.enabled: true` |
| `CONTEXT_BROKER_LOG_FILE` | Write JSONL decisions and injections |
| `CONTEXT_BROKER_HOST=pi\|omp` | Force host default resolution |

Path-list separators follow the platform delimiter: `:` on macOS/Linux, `;` on Windows.

## Rule files

Rule files live under `context-broker/rules/*.yml` by default. Each file describes one trigger profile.

```yaml
id: architecture-review
inject:
  - design-review
  - bundle:workspace-collab
match:
  - exact:
      - review this design
  - regex:
      - '^design review:'
  - contains:
      - architecture
    not:
      - contains:
          - no context
```

A generated file can declare multiple profiles through a top-level `rules` array. This is useful when one scene configuration projects keyword rules for several Bundle indexes:

```yaml
version: 1
rules:
  - id: scene-coding
    inject:
      - bundle:scene-coding
    match:
      - contains:
          - coding context
  - id: scene-research
    inject:
      - bundle:scene-research
    match:
      - contains:
          - deep research
```

The legacy single-profile file remains supported. When a non-empty top-level `rules` array is present, its valid entries are used.

Set `ruleRoots` if you want a different rule directory.

## Discovery catalogs

Catalogs are standalone YAML or JSON files. YAML is easier to review and is the recommended format.

A member can reference a discovered skill by name:

```yaml
members:
  include:
    - docs
    - chat
```

A member can also point to a file relative to the catalog:

```yaml
members:
  - path: ./members/docs/SKILL.md
```

When the file is a `SKILL.md`, Context Broker can read `name` and `description` from frontmatter. Set them manually only when you want to override that metadata.

See [`discovery-catalog.example.yaml`](./packages/context-broker/examples/discovery-catalog.example.yaml) for a fuller example.

## Injected payloads

Skill injection:

```xml
<context-broker-record kind="skill" name="design-review" path="~/context/skills/design-review/SKILL.md">
<body>
...
</body>
</context-broker-record>
```

Bundle injection:

```xml
<context-broker-record kind="bundle" name="workspace-collab" path="~/context/catalogs/workspace.yaml">
  <description>Collaboration contexts for documents, chat, and tasks.</description>
  <rules>
    <rule>Read the selected member file before using member-specific details.</rule>
  </rules>
  <policy memberBody="read-before-use" scope="members-only"></policy>
  <members>
    <member name="docs" path="~/context/skills/docs/SKILL.md">Document reading and editing context.</member>
  </members>
</context-broker-record>
```

## Commands

```text
/context-broker status
/context-broker doctor
/context-broker roots
/context-broker catalogs
/context-broker find <query>
/context-broker explain <record>
```

Use subcommands, not colon-style command names. Pi uses colon suffixes for command conflict disambiguation.

## Security and privacy

This package runs inside the host agent process and has the same local permissions. Install it only from sources you trust.

Context Broker sends selected context to the model by design:

- A matched `skill` sends the full `SKILL.md` body to the model and stores it in local session history.
- A matched `bundle` sends member names, descriptions, policies, and member paths, but not member bodies.
- Session JSONL files store injected content.
- `CONTEXT_BROKER_LOG_FILE` records matched queries and record names. It omits paths unless `logPaths: true` is set.
- `pathMode: home-relative` avoids full home-directory paths when possible.
- `pathMode: hash` gives stronger path redaction.

Do not point `skillRoots` at untrusted repositories. A skill is prompt content and can instruct the model.

## Platform support

The package is tested on macOS with Pi and OMP. Linux should work. Windows path-list separators are supported, but Windows is best-effort until CI covers it.

## Maintainers and contributors

### Local development

```bash
bun install
bun run check
bun run test:host
bun run test:global-config
bun run test:lifecycle
bun run test:release
bun run test:artifacts
bun run pack:dry
```

The workspace contains `packages/context-broker` (npm `pi-context-broker`) and `packages/tern-context-broker` (Tern Luau). `bun run build` bundles the query into both distributions. Commit the Tern query and LICENSE with source changes so GitHub URL installations work without a build. `bun scripts/pack.mjs` also creates an npm tarball and a Tern installation archive for optional releases.

CI pins OMP 18.10.3, Pi 1.2.0 and Bun 1.3.14, then runs code checks, both CLI hosts, lifecycle, release policy and independent artifact regressions. Lifecycle checks count the bodies actually received by the provider for repetition, fork, rewind, compaction retaining/removing bodies, persistent continuation and first loading after an XML example.

On macOS with Tern 0.8.3+, run `bun run build` followed by `bun run test:ui`. The runner installs the Tern archive into an isolated runtime and verifies automatic chips, deletion/undo, multiple-reference submission, deduplication, Chinese/emoji manual replacement, cancellation and focus changes. Screenshots and provider evidence are retained.

For explicit real-model acceptance, run `bun run test:model` using an existing login. It only calls `magpie/group/flash-free`, checking skill-specific output, the real default summarizer, reinjection after the body is removed, and model selectors on ordinary and summarizer transport requests. Real models and native UI are not run automatically in credential-free Linux CI. Verification scripts retain their temporary evidence directories for inspection and disposal through the system trash.

Agents taking over this checkout should use the [project verification Skill](.agents/skills/verify-context-broker/SKILL.md). Read its feature map, run `node .agents/skills/verify-context-broker/scripts/control.mjs doctor editor`, then `run editor` for native UI. The helper records actual versions, commands, exit statuses and retained evidence paths; other feature arguments are `injection`, `lifecycle`, `model` and `distribution`. Use `/maintain-verification-skill` when entry points change.

The public `context-broker-complete` CLI reads version 1 JSON `{version:1,text,cursor,cwd,config?}` on stdin and writes `{version:1,edit,items}` on stdout. Offsets use UTF-16 code units. A null edit means no `$` prefix ending at the cursor; the prefix can directly follow prose. Candidates reuse the broker's aliases, fuzzy ordering and Bundle precedence. Diagnostics go to stderr; Skill bodies are never returned.


### Release flow

Tern GitHub URL installation uses the committed plugin directory and does not require an npm release. The following tag flow publishes the broker to npm and optionally provides a Tern archive. After npm Trusted Publishing is configured:

```bash
bun run release:check patch --no-push
bun run release patch
```

The script creates a temporary local release branch, updates version files, and requires the configured `.github/release.config.json` `checkCommand` to pass before committing, tagging and pushing. GitHub Actions runs all publication gates before publishing. `--no-push` still runs the check; `release:check` (`--precheck`) and `--dry-run` only print a plan without running checks or creating a release.

### First manual publish

Before Trusted Publishing exists, publish from a real TTY so npm can complete 2FA or web authentication:

```bash
bun run build
npm login --auth-type=web --registry https://registry.npmjs.org
npm publish ./packages/context-broker --access public --registry https://registry.npmjs.org --auth-type=web
```

Agent shell tools are usually not a TTY and may fail with `EOTP`.
