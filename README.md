# OpenCode Setup Prompt

One prompt that turns any repository into an OpenCode project with a six-agent team and optional skills.

Repository: <https://github.com/mokforge/opencode-setup-prompt>

> **For AI agents:** when a user asks you to set up a project with this repository, clone `https://github.com/mokforge/opencode-setup-prompt.git` into a temporary directory, read `opencode-setup-prompt.md`, and follow it. Use the `skills/` directory as the skill catalog.

## Quick start

Start OpenCode in the project you want to set up:

```bash
opencode
```

Then send this message:

```text
Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt
```

That is the only input the user needs to provide: the link. The agent clones the setup repository, reads the prompt, and does the rest.

The setup asks questions (language, skills, project details), so use the interactive interface. For scripted runs, `opencode run "..."` also works, but interactive answers may not be available.

The prompt file can be read directly at:

```text
https://raw.githubusercontent.com/mokforge/opencode-setup-prompt/main/opencode-setup-prompt.md
```

## What happens

1. The agent clones the setup repository and studies your project: stack, architecture, commands, tests, branch conventions, services, and existing rules.
2. It asks for the **output language**: English (default) or Russian. All generated rules, agents, and reports use the chosen language. The prompt itself stays in English.
3. It scans `skills/` and offers the **available skills**, marking the ones relevant to the detected stack. You can install the relevant skills, all skills, none, or a selection.
4. It asks the remaining questions in one pass, with suggested answers.
5. It creates `.opencode/AGENTS.md`, six agents in `.opencode/agents/`, the documentation directories, installs the selected skills, and connects the rules in `.opencode/opencode.json` or `.opencode/opencode.jsonc`.

Nothing is committed or pushed. All changes stay in `.opencode/` and are visible in `git status` / `git diff`.

## After setup

Start OpenCode in the project and switch to the primary agent `tech-lead` (Tab). Describe a task normally: `tech-lead` creates the branch, plans the work, and delegates to `analyst`, `architect`, `developer`, `reviewer`, and `tester`.

## Skills

Skills are directories under `skills/`, each with a `SKILL.md` at its root. The prompt reads the catalog at runtime, so adding a skill requires no changes to the prompt. The live catalog is the set of directories matching `skills/*/SKILL.md` (run `ls skills/*/SKILL.md` to list them); each skill's `description` explains when it applies.

The repository currently includes Python and Flet skills. Flet is one skill with separate references for declarative UI and testing.

Selected skills are copied to `.opencode/skills/<id>/`. The installed skill keeps its supporting files and can be invoked automatically by the agent, explicitly as `@<skill-id>`, or by asking the agent to load the skill. Skills are installed as published; the current catalog is in English regardless of the output language chosen for project rules.

To add a skill, follow [CONTRIBUTING.md](CONTRIBUTING.md). The directory name becomes the skill ID.

## What gets created

```text
.opencode/
├── AGENTS.md
├── opencode.json(c)       # instructions key added
├── agents/
│   ├── tech-lead.md
│   ├── analyst.md
│   ├── architect.md
│   ├── developer.md
│   ├── reviewer.md
│   └── tester.md
├── docs/
│   ├── requirements/
│   ├── adr/
│   ├── architecture/
│   └── diagrams/{c4,sequence}/
└── skills/
    └── <selected-skill-id>/
```

## Requirements

- OpenCode V2 (tested with 2.3.0) with a configured provider and model.
- A git repository.
- Network access to GitHub for the agent, or a local clone of this repository.
- `.opencode/opencode.json` or `.opencode/opencode.jsonc` in the project. If neither exists, the prompt creates a minimal `opencode.json`.

## Repository layout

```text
.
├── opencode-setup-prompt.md   # the setup prompt
├── templates/
│   └── agents/
│       ├── tech-lead.md
│       ├── analyst.md
│       ├── architect.md
│       ├── developer.md
│       ├── reviewer.md
│       └── tester.md
├── skills/
│   └── <skill-id>/
│       ├── SKILL.md           # entry point
│       ├── <reference>.md     # optional supporting references
│       └── LICENSE            # MIT
├── .github/PULL_REQUEST_TEMPLATE.md
├── .pre-commit-config.yaml
├── .markdownlint-cli2.yaml
├── .yamllint.yaml
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Development checks

The repository uses [pre-commit](https://pre-commit.com) with off-the-shelf checks:

```bash
pre-commit install
pre-commit run --all-files
```

The hooks run `markdownlint-cli2`, `yamllint`, Prettier in check mode, basic YAML/whitespace checks, merge-conflict/case-conflict/large-file checks, and local `pygrep` checks for skill frontmatter, placeholders, and the primary agent. The same checks cover the prompt, templates, skills, and repository documentation. The pull request template stays intentionally short; it covers only the checks that cannot be automated, such as whether a skill description explains when to use it.

## Licensing

The repository and all skills are licensed under the MIT License. See the root `LICENSE` and the per-skill license files.

## Local or offline run

Clone the repository and start OpenCode in the target project:

```bash
git clone --depth 1 https://github.com/mokforge/opencode-setup-prompt.git /tmp/opencode-setup-prompt
opencode
```

Then send:

```text
Read /tmp/opencode-setup-prompt/opencode-setup-prompt.md and follow it. Setup root: /tmp/opencode-setup-prompt. Target project: the current directory.
```
