# OpenCode Setup Prompt

One prompt that turns any repository into an OpenCode project for software development or documentation as code. Development uses six agents (`tech-lead`, `analyst`, `architect`, `developer`, `reviewer`, `tester`); documentation uses four (`tech-lead`, `analyst`, `architect`, `reviewer`). Both modes include optional skills, a mandatory security review gate, and a configurable project-scoped external-access profile with strict access as the default.

## Install

Run this in the root of your project (a git repository):

```bash
opencode --prompt "Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt"
```

OpenCode opens with the task already sent. The agent clones this repository to a temporary directory and studies your project. In interactive mode, it asks you:

1. the **language** for generated files and reports (English, Russian, or a custom language);
2. how OpenCode will be used: **development** or **documentation (docs-as-code)**;
3. where documentation should live: `.opencode/docs/` or a custom path;
4. the **external-access profile**: strict, public web research, or a custom HTTPS web allowlist;
5. if the project is empty, which initial **project structure** and approach to plan for, with options for the selected mode;
6. which optional **skills** to install (relevant, all, none, or a selection); `security-review` is always installed, and `technical-writing` is installed whenever documentation is maintained;
7. how to handle configured MCP servers, if any;
8. any decision that is genuinely blocking and cannot be determined from the code.

Template-derived files and newly installed catalog skills use the selected language. Existing user-authored rules and kept skills stay in their current language unless you explicitly request translation. Setup files go in `.opencode/`; the chosen documentation root and an explicitly approved skill move are documented exceptions. The temporary clone is removed. Nothing is committed or pushed; review the result with `git status` and `git diff`.

For unattended setup, include this instruction in the prompt:

```text
Use unattended setup defaults. Do not ask non-blocking questions; preserve conflicting or user-owned content and report anything skipped.
```

Unattended setup honors explicit choices in your prompt and uses defaults only for omitted preferences. New setups default to strict external access; updates preserve the existing profile unless you explicitly change it. Empty-project structure is recorded as a plan; the setup does not create an application scaffold or install dependencies. It still pauses for genuinely blocking business decisions or external/destructive actions that were not explicitly authorized.

Already running OpenCode? Send the same sentence as a message:

```text
Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt
```

## Run again

Run the same command any time to update an existing setup. In interactive mode, the agent shows the per-file change summary and waits for confirmation; it preserves your rules, agents' `## Project rules`, existing skills, docs, and external-access profile. Changing the profile requires confirmation. In unattended mode, it applies only unambiguous, non-destructive changes and reports skipped conflicts. If nothing needs changing, it changes nothing. Existing mode, documentation and security choices are reused by default; switching modes or moving skills requires confirmation.

## What you get

- `.opencode/AGENTS.md`: minimal rules for all agents, connected in `.opencode/opencode.json`.
- `.opencode/agents/`: six development agents or four documentation agents. Documentation mode never creates `developer` or `tester`.
- Documentation root: `.opencode/docs/` by default, or a custom path chosen during setup. It holds requirements, ADRs, architecture, and C4 / sequence diagrams, plus the page types your project needs. In interactive mode, you choose whether agents keep existing documentation, use the root for new documents, or convert it; unattended setup keeps existing docs as source material.
- `.opencode/skills/`: the skills you selected, including the optional PlantUML diagram and Confluence skills, plus the mandatory `security-review` and, when documentation is maintained, `technical-writing`.
- For an empty project, `.opencode/AGENTS.md` records the user-selected starter structure as a plan, not an existing scaffold. The setup may create the standard empty documentation support directories, but does not invent a stack, create application source files or docs-framework configuration, or install dependencies.

`tech-lead` is set as the default agent (`default_agent` in `.opencode/opencode.json`), so OpenCode starts with it. Describe a task: it creates a branch, delegates to the existing agents, and accepts the result. It does not implement the task itself and never creates new agents or roles.

Setup also inspects existing root and nested `AGENTS.md` rules, configured MCP servers and skills outside `.opencode/skills`. MCP settings and user-authored rules are preserved; project-local skills are moved into `.opencode/skills/` only when approved, and a missing `SKILL.md` is created from existing files. Template-derived and catalog-skill prose uses the selected language; moved or existing user-authored skill content stays in its original language unless you request translation.

## Empty projects

If the selected mode has no established structure, setup asks for the intended approach and explains trade-offs. Development options include a minimal starter, layered/hexagonal architecture, or a modular/domain-oriented structure. Docs-as-code options include Markdown-first, reader/page-type information architecture, or a framework-backed site. It records the choice as a plan for the first tech-lead task; it does not generate application code, docs-site configuration, or dependencies during setup.

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

Setup asks for an external-access profile. **Strict** (default) keeps external actions at `ask`. **Public research** allows `websearch` and `webfetch` for public pages, not APIs; **custom** allows only user-specified HTTPS `webfetch` patterns for public documentation pages and optionally public search. External directories, browser automation, MCP, databases, network shell commands, dependency downloads, uploads, publishing and `git push` still require approval.

Web search queries and fetch URLs leave the repository. Never include source code, configuration, logs, secrets, personal data or confidential project details in them. The profile is project-scoped, not a network sandbox: OpenCode cannot enforce that an allowed web request targets only public hosts. Use strict mode or external network controls when that boundary matters.

Global permission gates remain `ask`; profile-specific web allows are added only to generated agent permissions. OpenCode's **Allow always** approval can save additional project-scoped allows; this setup does not manage those, so use one-time approvals for Strict. Shell has host filesystem and network authority, and path-scoped `edit` rules do not constrain shell writes. Do not use `--auto` to bypass approvals. See the setup prompt for the full policy.

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
