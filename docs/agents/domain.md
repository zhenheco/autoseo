# Domain Docs

This repo uses a single-context domain-doc layout.

Primary project context:

- `CLAUDE.md`
- `AGENTS.md`
- `openspec/project.md`
- `docs/`
- `openspec/changes/`

Consumer rules:

- Read `CLAUDE.md` and `AGENTS.md` before planning substantial changes.
- Read `openspec/AGENTS.md` and create an OpenSpec change for new capabilities, architecture shifts, or security-sensitive flows.
- Prefer existing 1waySEO domain language: company, website config, article jobs, sync targets, external website, OAuth connection, and AI Gateway.
- Keep secrets out of docs and issues; reference 1Password items and field names instead.
