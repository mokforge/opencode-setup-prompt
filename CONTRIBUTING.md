# Contributing

This repository contains an OpenCode setup prompt and reusable skills.
Documentation and skills are written in English.

## Skills

Each skill is a directory under `skills/`:

```text
skills/<skill-id>/
├── SKILL.md       # entry point, required
├── <reference>.md # optional supporting references
└── LICENSE        # MIT
```

- Use a lowercase kebab-case directory name. It becomes the skill ID.
- `SKILL.md` must start with YAML frontmatter containing `name` and `description`.
- `description` must explain when the skill applies, not only what it contains.
- Keep `SKILL.md` focused on the rules needed for most tasks. Move long, topic-specific guidance into reference files and link them from `SKILL.md`.
- Put scripts, templates, and reference material in the same directory as `SKILL.md`.
- Skills in this repository are MIT. Do not include material you cannot license under MIT.

## Adding or updating a skill

1. Create or update `skills/<skill-id>/SKILL.md`.
2. Add supporting files only when they keep `SKILL.md` shorter and easier to scan.
3. Update `README.md` only if the repository-level description or usage changes.
4. Check the skill locally before committing.

## Automated checks

Install the hooks once, then run them before a commit:

```bash
pre-commit install
pre-commit run --all-files
```

The hooks run `markdownlint-cli2`, `yamllint`, Prettier in check mode, and basic YAML/whitespace checks. Prettier skips `opencode-setup-prompt.md` because it contains nested Markdown templates.

## Manual checks

Run these checks before a commit:

- Frontmatter is valid YAML, starts on the first line, and contains non-empty `name` and `description`.
- The directory name and skill ID are unique under `skills/`.
- Every file referenced from `SKILL.md` exists.
- Markdown code fences are balanced.
- The skill contains no placeholder text or unfinished sections.
- Commands and paths are either real for the target project or clearly marked as examples.
- The skill is written in English unless it is intentionally project-specific.
- The skill can be distributed under the repository's MIT license.
- The skill installs as `.opencode/skills/<skill-id>/` and its `SKILL.md` stays at the directory root.

## Commits

- Keep changes focused. Do not mix prompt changes, README changes, and skill additions in one commit when they can be reviewed separately.
- Do not commit generated secrets, local editor files, or `.env` files.

## Pull requests

Push a branch and open a pull request. The template asks for a summary and a short manual checklist. After the one-time `pre-commit install`, run `pre-commit run --all-files` before pushing.
