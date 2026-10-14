# Changelog

## Unreleased

- Shorten the bilingual project entrypoints, move detailed broker configuration into bundled package references, and make the bilingual Tern package guides own installation, profiles, updates and local development. Include documentation link targets and both Tern languages in distribution artifacts.
- Document OMP/Tern plugin coexistence, sole ownership of injection by the OMP broker, and the verified Esc-then-shortcut sequence for switching to manual search; simultaneous menus are not covered.
- Split the repository into independently distributable Pi/OMP and Tern packages. Preserve the npm name `pi-context-broker` and move local extension entry paths under `packages/context-broker`.
- Add a standalone JSON completion CLI shared with the Tern distribution, preserving Skill/Bundle discovery and ranking.
- Add an optional Tern native search dialog on Ctrl+Alt+Shift+K with UTF-16 draft replacement, stale-draft cancellation, and a bundled query requiring Node.js 22+. The dialog does not submit prompts.
- Include the bundled Tern query and license notices in Git so the companion installs directly from its GitHub subdirectory without a build or npm release.
- Add automatic caret-anchored OMP Skill/Bundle dropdowns using the native editor completion UI, including native Surface edits. Keep the Tern centered picker as an optional manual command.
- Accept OMP's AbortSignal autocomplete contract as well as Pi's options object so candidate queries no longer fail on OMP 18.10.3.
- Allow `$` completion directly after prose and multiple times in one draft, with matching submit-time invocation parsing.
- Render accepted OMP Skill/Bundle candidates as native atomic chips using `/skill:` styling, whole-chip deletion and undo, while expanding back to `$name` on submission. Preserve built-in autocomplete hints, inline replacements and forced file completion.
- Correct OMP activation guidance: use `/restart` after extension code updates; `/reload-plugins` refreshes discovery state and `/reload` is not a built-in command in OMP 18.10.3.
- Restrict XML fallback deduplication to broker custom messages with matching record kinds, so ordinary quoted examples and same-name bundles cannot suppress real skill loading.
- Add actual provider-body-count regressions for both CLI hosts, compaction retention/removal, forks, rewinds and persistent continuation; run pinned host checks before CI publication.
- Add independent artifact installation checks, repeatable native Tern/OMP interaction acceptance, and an explicit guarded `magpie/group/flash-free` default-compaction smoke with transport evidence.
- Execute the configured release `checkCommand` before release commits, tags and pushes; remove the obsolete local-check bypass and add behavior regressions for failure, success and planning modes.
- Resolve Volta host shims before isolating fixture HOME, launch Node host entries directly, and terminate only fixture process groups on timeout to prevent recursive Pi startup.
- Add the project-local `.agents/skills/verify-context-broker` Skill with five feature maps and a read-only Doctor, execution/evidence helper; retain command transcripts and actual runtime versions.
- Start and retain ownership of the native UI verification daemon explicitly; wait for the owned window/daemon to exit and preserve process and cleanup receipts with screenshots.

- Apply first-root normalized-name precedence to configured skill invocations as well as `$` discovery, so overlapping runtime and source roots do not make `skill:` and keyword-rule targets ambiguous.

- Follow directory and `SKILL.md` symlinks during discovery while preserving the discovered path for relative references. Skip broken links and ancestor cycles, retain scan limits, and cover first-root precedence through autocomplete and injection.

- Remove entity Bundle Skill materialization (`exposeBundlesAsSkills`, `/context-broker materialize`, generated lifecycle, compact entity routing, and member path anchors). Context Broker now keeps runtime virtual Bundle discovery/injection separate from durable Router Skills owned by the distributing Skill repository.

- Support multiple keyword trigger profiles in one rule file through a top-level `rules` array, enabling generated scene-to-Bundle rule projections while preserving legacy single-profile files.
- Allow keyword rules to inject catalog bundle indexes with explicit `bundle:<name>` targets.
- Keep unprefixed rule targets Skill-only and make Bundle rule lookup exact and fail-closed.

## 0.0.2

- Let a catalog bundle intentionally shadow a same-name skill in `$` lookup.
- Rank matching bundles before same-score skills in `$` autocomplete.

## 0.0.1

- Initial standalone Pi/OMP context-broker package.
- Supports explicit `$name` context injection for skills and bundle records.
- Adds `/context-broker` diagnostics commands.
- Adds path privacy controls and bounded skill scanning defaults.
