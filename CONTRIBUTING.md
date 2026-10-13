# Contributing

## Setup

```bash
bun install
bun run build
bun run check
```

Host and artifact checks require `pi` and `omp` on PATH. CI pins OMP 18.10.3, Pi 1.2.0 and Bun 1.3.14:

```bash
bun run test:host
bun run test:global-config
bun run test:lifecycle
bun run test:release
bun run test:artifacts
```

Host runners resolve Volta shims before isolating HOME and invoke Node host entries directly. Fake-provider runs do not inherit developer credentials or runtime configuration; timeout cleanup targets only their own process groups.

Tern development requires `tern`, OMP native Surface Protocol and Node.js 22+. Build, then `tern plugin link ./packages/tern-context-broker`; use `tern plugin reload` after edits. Keep test logs/config/data outside the linked source directory to avoid reloads cancelling asynchronous operations.

`bun run test:ui` runs a real isolated macOS Tern window from a clean release install. It exercises automatic completion, atomic deletion/undo, mixed Skill/Bundle submission, actual provider-body counts, Unicode manual replacement, cancellation and focus changes. Screenshots and fixtures are retained. Keep UI checks local; they require Tern 0.8.3+ and OMP 18.10.3+.

`bun run test:model` explicitly calls only `magpie/group/flash-free` through the existing login. It verifies instruction use, repeat deduplication, real default compaction and reinjection, and records safe selector/body-count evidence at the actual transport boundary. It rejects other model selectors and does not record credentials, headers or request URLs. Do not put authenticated model runs into CI.

All runtime checks retain evidence directories. Inspect them before moving them to the system trash; scripts never permanently delete them.

The project verification Skill lives at [.agents/skills/verify-context-broker/SKILL.md](.agents/skills/verify-context-broker/SKILL.md). Start from its feature map, then run `node .agents/skills/verify-context-broker/scripts/control.mjs doctor editor` and `run editor` for native UI changes. The helper records actual versions, commands, exit statuses and retained evidence paths. Choose `injection`, `lifecycle`, `model` or `distribution` for those surfaces; `/maintain-verification-skill` keeps the map current. Native UI teardown records its owned daemon/window PIDs and waits for their exits; evidence survives cleanup.

## Development rules

- Keep both packages independently installable: the npm broker must not require a workspace checkout, and the committed Tern GitHub directory must include its bundled query and LICENSE. Rebuild and commit those files whenever their inputs change; the query retains bundled dependency license text.
- Do not hard-code local absolute paths, API keys, tokens, or private service endpoints.
- Broker discovery/ranking owns candidate semantics; Tern owns its picker and guarded native draft edits. Do not duplicate discovery in Luau.
- Add or update smoke coverage for config resolution, discovery, injection, and privacy behavior.
- Update README and examples when config fields or user-visible behavior change.

## Release

Tern installs directly from `github.com/yoyooyooo/pi-context-broker/packages/tern-context-broker`, without an npm release. Broker npm releases are tag-driven:

```bash
bun run release:check patch --no-push
bun run release patch
```

The release script creates a temporary local release branch, writes version files, and executes the declared `checkCommand` before any release commit, tag or push. Check failure prevents those actions. `--no-push` also runs the gate; `release:check` and `--dry-run` are planning commands and do not run checks. Publication additionally requires code, both-host, lifecycle, release-policy and artifact gates in GitHub Actions.

Publication builds both artifacts, publishes npm from `packages/context-broker`, and attaches an optional `tern-context-broker.tar.gz` to the GitHub Release. The Tern version is owned by its package and manifest and may differ from the broker's npm version. `bun scripts/pack.mjs` rehearses both artifact formats locally; Tern GitHub installs use the committed directory independently of this workflow.
