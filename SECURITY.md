# Security Policy

## Supported versions

Security fixes target the latest released version.

## Trust boundary

`pi-context-broker` is a local Pi/OMP extension. It runs with the same filesystem permissions as the host agent process.

The Tern companion runs as a Luau window plugin and launches its bundled local query through Node.js. It reads configured Skill/catalog metadata and applies native editor events to the selected OMP draft. It does not submit prompts. Candidate strings are never executed as shell commands. Treat the installed plugin and configured files as trusted local code/content.

Configured `skillRoots`, `ruleRoots`, and discovery catalogs are trusted inputs. Do not include untrusted repositories or user-writable shared directories unless you are comfortable sending their matched prompt content to the model.

## Data exposure model

- Matched skill bodies are sent to the configured model provider and persisted in the local session history.
- Bundle records send only index metadata and member paths, not member bodies.
- Paths are home-relative by default where possible. Use `pathMode: hash` for stronger path redaction.
- JSONL decision logs omit paths unless `logPaths: true` is configured.

## Reporting vulnerabilities

Open a private security advisory or contact the maintainer through the repository security channel. Do not include private keys, API tokens, or private skill contents in public issues.
