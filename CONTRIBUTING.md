# Contributing

This repository contains an OpenCode setup prompt, agent and plugin templates, and reusable skill templates.
Everything in it can be changed by contributors under the same rules: skill, agent and plugin templates, the prompt, documentation, and repository configuration.
Documentation, the prompt, templates, and skills are written in English.

## Skills

Each skill template is a directory under `templates/skills/`:

```text
templates/skills/<skill-id>/
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
- Keep source skills in English. The setup translates the installed copy when the user selects another language; do not add language variants to the source catalog.

## Adding or updating a skill

1. Create or update `templates/skills/<skill-id>/SKILL.md`.
2. Add supporting files only when they keep `SKILL.md` shorter and easier to scan.
3. Update `README.md` only if the repository-level description or usage changes.
4. Check the skill locally before committing.

## Prompt and agent templates

Changes to `opencode-setup-prompt.md`, `templates/agents/*.md`, and `templates/plugins/` follow the same flow as skills: a branch, a focused commit, the automated checks, a pull request.

- `templates/agents/*.md` contains the six universal role templates. Development uses all six; documentation (docs-as-code) uses `tech-lead`, `analyst`, `architect` and `reviewer`. Do not add separate documentation copies of the agents; the prompt chooses which agents to create.
- A template body is shared by every project: do not put project facts into it. Project facts are added by the prompt to `## Project rules` when a project is set up. Source templates stay in English; they are translated in the generated project.
- Keep one source for each rule: shared rules in the prompt's `.opencode/AGENTS.md` structure, role rules and runtime permissions in agent templates. Step 8 of the prompt is the single setup-verification checklist; do not duplicate it here.
- When you add, move, or renumber a step in the prompt, update every reference to it (search for `Step N`) and the matching verification item in Step 8.
- If a change affects how the repository is used, update `README.md` in a separate commit.

## Test suite

Use Node.js 24.x for the test suite; it is verified with Node.js 24.18.0. The
tests use Node's built-in test runner and import the plugin TypeScript files
using Node's built-in TypeScript type stripping.

```bash
node --test tests/*.test.mjs
```

GitHub Actions runs this command on Node.js 24.x for pushes and pull requests.

## Automated checks

Install the hooks once, then run them before a commit:

```bash
pre-commit install
pre-commit run --all-files
```

The hooks run `markdownlint-cli2`, `yamllint`, Prettier in check mode, basic YAML/whitespace checks, merge-conflict/case-conflict/large-file checks, and local `pygrep` checks for skill frontmatter/placeholders/primary mode.

CI also runs `pre-commit run --all-files`; run it locally before opening a pull request.

## Manual checks

Run these checks before a pull request:

- Frontmatter parses as YAML, starts on the first line, and contains non-empty `name` and `description`.
- The directory name and skill ID are unique under `templates/skills/`.
- Every file referenced from `SKILL.md` exists.
- Markdown code fences are balanced.
- Commands and paths are either real for the target project or clearly marked as examples.
- The `description` explains when the skill applies, not only what it contains.
- The skill is written in English unless it is intentionally project-specific.
- The skill can be distributed under the repository's MIT license.
- The skill installs as `.opencode/skills/<skill-id>/` and its `SKILL.md` stays at the directory root.
- References between steps of the prompt (`Step N`, section names) still point to existing text, and the Step 8 checks cover any new behavior.
- The development pipeline keeps requirements and relevant architecture decisions ahead of implementation, and hands the same approved baseline to the developer, tester, and reviewer.

## Commits

- Keep changes focused. Do not mix prompt changes, README changes, and skill additions in one commit when they can be reviewed separately.
- Do not commit generated secrets, local editor files, or `.env` files.

## Pull requests

Push a branch and open a pull request. The template asks for a summary and a short manual checklist. After the one-time `pre-commit install`, run `pre-commit run --all-files` before pushing.
