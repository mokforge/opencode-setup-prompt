# OpenCode Setup Prompt

One prompt that turns any repository into an OpenCode project for software development or documentation as code. Development uses six agents (`tech-lead`, `analyst`, `architect`, `developer`, `reviewer`, `tester`); documentation uses four (`tech-lead`, `analyst`, `architect`, `reviewer`). Both modes include optional skills, a mandatory security review gate, and a deny-by-default external access policy.

## Install

Run this in the root of your project (a git repository):

```bash
opencode --prompt "Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt"
```

OpenCode opens with the task already sent. The agent clones this repository to a temporary directory and studies your project. In interactive mode, it asks you:

1. the **language** for generated files and reports (English, Russian, or a custom language);
2. how OpenCode will be used: **development** or **documentation (docs-as-code)**;
3. where documentation should live: `.opencode/docs/` or a custom path;
4. which optional **skills** to install (relevant, all, none, or a selection); `security-review` is always installed, and `technical-writing` is installed whenever documentation is maintained;
5. how to handle configured MCP servers, if any;
6. any decision that is genuinely blocking and cannot be determined from the code.

Template-derived files and newly installed catalog skills use the selected language. Existing user-authored rules and kept skills stay in their current language unless you explicitly request translation. Setup files go in `.opencode/`; the chosen documentation root and an explicitly approved skill move are documented exceptions. The temporary clone is removed. Nothing is committed or pushed; review the result with `git status` and `git diff`.

For unattended setup, include this instruction in the prompt:

```text
Use unattended setup defaults. Do not ask non-blocking questions; preserve conflicting or user-owned content and report anything skipped.
```

Unattended setup honors explicit choices in your prompt and uses defaults only for omitted preferences. It still pauses for genuinely blocking business decisions or external/destructive actions that were not explicitly authorized.

Already running OpenCode? Send the same sentence as a message:

```text
Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt
```

## Run again

Run the same command any time to update an existing setup. In interactive mode, the agent shows the per-file change summary and waits for confirmation; it preserves your rules, agents' `## Project rules`, existing skills, and docs. In unattended mode, it applies only unambiguous, non-destructive changes and reports skipped conflicts. If nothing needs changing, it changes nothing. Existing mode and documentation choices are reused by default; switching modes or moving skills requires confirmation.

## What you get

- `.opencode/AGENTS.md`: minimal rules for all agents, connected in `.opencode/opencode.json`.
- `.opencode/agents/`: six development agents or four documentation agents. Documentation mode never creates `developer` or `tester`.
- Documentation root: `.opencode/docs/` by default, or a custom path chosen during setup. It holds requirements, ADRs, architecture, and C4 / sequence diagrams, plus the page types your project needs. In interactive mode, you choose whether agents keep existing documentation, use the root for new documents, or convert it; unattended setup keeps existing docs as source material.
- `.opencode/skills/`: the skills you selected, including the optional PlantUML diagram and Confluence skills, plus the mandatory `security-review` and, when documentation is maintained, `technical-writing`.

`tech-lead` is set as the default agent (`default_agent` in `.opencode/opencode.json`), so OpenCode starts with it. Describe a task: it creates a branch, delegates to the existing agents, and accepts the result. It does not implement the task itself and never creates new agents or roles.

Setup also inspects existing root and nested `AGENTS.md` rules, configured MCP servers and skills outside `.opencode/skills`. MCP settings and user-authored rules are preserved; project-local skills are moved into `.opencode/skills/` only when approved, and a missing `SKILL.md` is created from existing files. Template-derived and catalog-skill prose uses the selected language; moved or existing user-authored skill content stays in its original language unless you request translation.

## Documentation (docs-as-code) mode

Choose documentation when the repository is the documentation source rather than an application. The setup creates four agents and configures the documentation root:

- **`tech-lead`** coordinates the documentation pipeline and accepts with docs-build, link and style evidence.
- **`analyst`** writes requirements, tutorials, how-to and reference pages.
- **`architect`** designs information architecture, architecture pages, ADRs and diagrams.
- **`reviewer`** reviews accuracy, sources, structure, navigation, links, examples, style and documentation safety.

`technical-writing` is required whenever documentation is maintained. Analyst and architect use it for writing; reviewer and tech-lead use it for review and acceptance. See [the skill](skills/technical-writing/SKILL.md) for its detailed guidance. `developer` and `tester` are not created in this mode.

## PlantUML diagrams via skills

The catalog contains two separate skills:

- **`plantuml-c4`** — authoring and validation for C4 diagrams; see [the skill](skills/plantuml-c4/SKILL.md).
- **`plantuml-sequence`** — authoring and validation for interaction diagrams; see [the skill](skills/plantuml-sequence/SKILL.md).

When you choose to maintain PlantUML documentation during setup, select the relevant PlantUML skills (the “relevant” or “all” options include them). OpenCode loads a selected skill through the native `skill` tool when the architect or analyst needs it; the agent templates contain invocation instructions, **not** duplicated PlantUML grammar. The PlantUML skills are installed according to your choice; `security-review` is always installed, and `technical-writing` is installed whenever documentation is maintained.

## Confluence via a skill

The optional [Confluence skill](skills/confluence/SKILL.md) covers read, export, conversion, publishing, and round-trip validation of rich page content. Analyst, architect, reviewer and tech-lead can load it when needed. External access still requires permission.

## OpenAPI / Swagger specifications

The optional [OpenAPI specification skill](skills/openapi-spec-generation/SKILL.md) supports design-first, code-first, and hybrid contract work, validation, and SDK generation when requested. It follows project sources and configured tooling.

## Security review via a skill

`security-review` is installed in every setup and mandatory for reviewer and tech-lead. It applies to code/configuration changes and documentation safety. See [the skill](skills/security-review/SKILL.md) for categories and evidence requirements; templates contain invocation instructions rather than a duplicate checklist.

## External access policy

Generated projects default to repository-only work. External files, network/MCP/database use, dependency downloads, publishing and `git push` require scoped permission; an external documentation root needs permission per task. OpenCode V2 gates web/browser, external directories, MCP, and known network commands with `ask`.

These gates are best-effort, not a sandbox: shell has host filesystem and network authority, and path-scoped `edit` rules do not constrain shell writes. Do not use `--auto` to bypass approvals. See the setup prompt for the full policy.

## Requirements

- OpenCode V2 (tested with 2.3.2) with a configured provider and model.
- Network access to GitHub, or a local clone (below).

## Without network access

```bash
git clone --depth 1 https://github.com/mokforge/opencode-setup-prompt.git /tmp/opencode-setup-prompt
opencode --prompt "Read /tmp/opencode-setup-prompt/opencode-setup-prompt.md and follow it. Setup root: /tmp/opencode-setup-prompt. Target project: the current directory."
```

## Contributing

Skills, agent templates, the prompt itself, and the rest of the repository can all be changed by contributors under the same rules. How to make a change and run the checks: [CONTRIBUTING.md](CONTRIBUTING.md). MIT license.
