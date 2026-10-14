# Broker reference

[English](./reference.md) | [中文](./reference.zh-CN.md) · [Project overview](https://github.com/yoyooyooo/pi-context-broker#readme)

Full configuration, discovery and injection reference for the Pi/OMP broker. Start with the [quick start](../README.md#quick-start).

[Skills](#skills) · [Bundles](#bundles) · [Configuration](#configuration) · [Rules](#rule-files) · [Commands](#commands) · [Completion CLI](#completion-cli)

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

Review the design for ownership, boundaries, failure modes, and migration cost.
```

`requireAutoload` defaults to `true` and filters configured Skill invocations and keyword rules to Skills with `autoload.enabled: true`. Explicit `$name` lookup and completion discover configured Skills regardless of that gate. `CONTEXT_BROKER_REQUIRE_ENABLED` overrides the gate for configured invocations and rules.

## Bundles

Bundles live in discovery catalogs. They inject an index, not the full member files.

Context Broker does not generate durable Bundle or Router Skills. A repository distributing a routing entry owns it as an ordinary `SKILL.md`, discovered through `skillRoots`.

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

# If omitted, the broker uses rules next to the config file.
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

See [`discovery-catalog.example.yaml`](../examples/discovery-catalog.example.yaml) for a fuller example.

## Injected payloads

Skill injection:

```xml
<context-broker-record kind="skill" name="design-review" path="~/context/skills/design-review/SKILL.md">
<body>
Review the design for ownership, boundaries, failure modes, and migration cost.
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

## Session deduplication

The broker checks the active branch's effective context before injecting a record. Submitting the same record again produces an `already loaded` notice and does not append another copy. The existing body still travels with the conversation context.

A fork retaining the body still skips it. A rewind or compaction removing the body permits reinjection. XML examples in ordinary user, assistant or tool messages are not loading evidence.

## Completion CLI

The npm package exposes `context-broker-complete`. It reads one version 1 JSON request on stdin and writes one JSON response on stdout. It reads configured roots and catalogs using `cwd`; it does not inherit Skills from the host system prompt. Skill bodies are never returned. Diagnostics go to stderr.

```json
{"version":1,"text":"Use$des","cursor":7,"cwd":"/workspace/example"}
```

`config` is an optional explicit broker config path. All offsets are UTF-16 code units, including the original text length carried by `edit.len`:

```json
{"version":1,"edit":{"from":3,"to":7,"len":7,"prefix":"$des"},"items":[{"value":"$design-review","label":"$design-review [skill]","description":"Review architecture and API trade-offs."}]}
```

This response assumes the quick-start Skill exists in the configured roots. `edit: null` means no `$` prefix ends at the cursor. A cursor inside an emoji surrogate pair is rejected. Candidate aliases, fuzzy ordering and Bundle precedence are shared with the broker; consumers must check the draft is unchanged before applying an edit.
