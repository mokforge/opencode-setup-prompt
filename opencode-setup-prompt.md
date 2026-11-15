# Task: Study the project and set up the OpenCode agent team

You are setting up this repository for development with a team of agents. First study the project yourself and in depth: understand its purpose, architectural approach, working methodology, and tooling. Then, based on what you find, create (or, if a setup already exists, update it according to "Working mode") `.opencode/AGENTS.md` with the core rules for all subagents, six agent files, and connect the rules in the existing `.opencode/opencode.json`. Follow the steps below and do not skip any. Do not invent anything during setup: ask the user about anything unclear in Step 1, offering answer options.

## Setup source and automation

Canonical setup repository: `https://github.com/mokforge/opencode-setup-prompt.git`

The user may give you only this URL. Resolve the setup source before Step 0:

- If `opencode-setup-prompt.md` is already available locally, use its parent directory as the setup root. Its `skills/` directory is the skill catalog and its `templates/agents/` directory contains the agent templates. If the parent directory has no `skills/` or `templates/agents/` directory, clone the setup repository as described below.
- If you were given the repository URL or only a link to the prompt, clone the repository into a temporary directory outside the target project, for example:
  ```bash
  tmp="$(mktemp -d)"
  git clone --depth 1 https://github.com/mokforge/opencode-setup-prompt.git "$tmp"
  ```
  Use `$tmp/opencode-setup-prompt.md` as this prompt, `$tmp/skills/` as the skill catalog, and `$tmp/templates/agents/` as the agent templates.
- Do not copy the setup repository into the target project. Remove the temporary directory when setup is complete.

The target project is the current working directory. All setup files described below are created inside its `.opencode/` directory; the temporary clone of the setup repository is the only allowed exception.

## General conditions

- **Output language.** Use the language selected in "Language selection" for the dialog with the user, generated project files, and reports. The prompt itself stays in English. Do not translate file names, commands, code, paths, permission keys, or technical identifiers.
- All setup and agent files are created strictly inside the `.opencode/` directory at the project root. Do not create or change anything outside it, except for the temporary clone of the setup repository, which must be removed afterward.
- Agents directory: `.opencode/agents/`. Standard agent documentation directory: `.opencode/docs/` (subdirectories `requirements`, `adr`, `architecture`, `diagrams/c4`, `diagrams/sequence`); it is used unless the user chose in Step 1 ("Documentation") to keep the project's existing documentation or to have no documentation maintained by agents. Skills directory: `.opencode/skills/`.
- `.opencode/opencode.json` or `.opencode/opencode.jsonc` may already exist. If one exists, do not change its other settings (providers, models, permissions, MCP, etc.); only add the `.opencode/AGENTS.md` connection to `instructions` and set `default_agent` to `tech-lead` as described in Step 4. If neither exists, create `.opencode/opencode.json` with `$schema`, `instructions`, and `default_agent`.
- Everything you write into the rules must be based on facts from the repository. Do not invent commands, paths, tools, or rules. If something cannot be determined, do not present a guess as fact: ask the user in Step 1. If there is no answer, omit the item or mark it as unconfirmed and mention it in the final report.
- When in doubt, do not invent or guess: collect questions and ask them in Step 1 with answer options. Do not create files before the user answers.
- Permissions are granted according to the role, but must not hinder everyday work. All roles may read code, search it, and run checks. Restrict only what genuinely belongs to another role (developer writes production code, tester writes tests) or is irreversible (destructive git commands, `push`, `commit` without a request). An agent that hits its restriction must not ask the user to do the work manually; it passes the request to another agent through tech-lead.
- **Skills are optional.** The `skills/` directory of the setup repository is the catalog. It may contain any number of skills, and new skills will be added over time. Discover the catalog dynamically in Step 0 and let the user choose which skills to install in Step 1. Never hardcode a list of skill names in this prompt or in generated files.

## Working mode: creation or update

Determine the mode before Step 0. Check whether `.opencode/AGENTS.md`, files in `.opencode/agents/`, the `.opencode/docs/` directory, and the `.opencode/skills/` directory exist.

- If none of the agents or `AGENTS.md` exist: mode "creation"; follow the steps below as written.
- If a setup already exists (even partially, even from earlier versions of this prompt): mode "update". The goal is not to create from scratch but to bring the existing setup to the current template while preserving all project-specific and user content.

In update mode:

1. Read the existing `.opencode/AGENTS.md` and agent files. Extract project data and user rules: commands, branches, conventions, checklists, custom instructions. Do not take them at face value: confirm them against the repository during Step 0, and raise discrepancies as questions in Step 1.
2. Compare the existing files with the Step 3 `AGENTS.md` structure and the role templates in `<setup root>/templates/agents/` (frontmatter and permissions, agent sections including "Project rules", "Documentation updates", "Learning", descriptions) and make a per-file list of differences. Compare structure and meaning, not text: generated files legitimately differ from the templates by language (translated headings and prose), by the `## Project rules` section, and by project-specific permission rules such as the tester's test-location `edit` allow rules (see "Tester write scope"). These are not differences to fix: never revert them to the template defaults (for example, never put `tests/**` back over the project's real test locations).
3. Update rules:
   - `.opencode/AGENTS.md`: bring it to the template structure from Step 3, including the first paragraph with the concrete language name (replace wording such as "the language selected during setup" with the language name). Move role-specific sections (pipeline, "Role rules", documentation and diagram formats, branches and commits, tests, code conventions, review checklist, and similar) into the relevant agents' `## Project rules`, if they are not already there. Keep shared content. Do not delete user sections that have no place in the template: ask where they should go.
   - Agent files: bring them to the template (frontmatter, permissions, sections) while preserving the user's custom instructions, the `model` field, additional fields, the contents of `## Project rules`, and existing project-specific `allow` rules. Do not silently remove permissions that are broader than the template: ask the user.
   - If a file already matches the template, do not touch it. If nothing differs anywhere, write nothing (the working tree must stay unchanged), remove the temporary clone, and report that the setup is already up to date.
   - Do not change documentation and diagrams in `.opencode/docs/` (create only missing directories) or in the project's own documentation locations. If `.opencode/AGENTS.md` has no "Documentation" section yet (a setup from an earlier version of this prompt), ask the Step 1 "Documentation" question; otherwise offer the previous choice. Do not change existing skills in `.opencode/skills/`; only install or update the skills the user selects, according to Step 5.
4. Do not create copies: changes are visible in `git diff`. Nothing is lost: anything removed from one file must end up in another file. If a file you are about to change has uncommitted user edits, report this before writing and ask how to proceed.
5. Ask all questions (disputed moves, broader permissions, user sections, skill conflicts) in Step 1 with options. Before writing, show a summary of changes per file (added, moved, replaced) and wait for confirmation.

## Language selection (first question)

This is the first thing the user sees. Resolve the setup source and the working mode silently first (they need no answers), then ask only this one question, before the study in Step 0 and before any other question. Ask it in English and Russian at once, with choices if a question tool is available: English (default, recommended), Russian, or a custom answer. In update mode, first read the language already used in the existing `.opencode/AGENTS.md` and agent files (the first paragraph of `AGENTS.md`, or the prose of the files if it is missing), offer "keep the current language (<name>)" as the recommended option, and if there is no answer keep the current language instead of switching to English. In creation mode, if there is no answer, use English and note the default in the report.

From the moment the answer arrives, conduct the whole dialog in the selected language: progress remarks during Step 0, every question in Step 1 (including the answer options), the change summary and the duplicate list shown for confirmation, error messages, and the final report. Do not switch back to English between steps. Code, commands, paths, permission keys, and identifiers stay unchanged. If the user later writes in another language or asks to change the language, ask once whether to switch and apply the answer to the rest of the dialog and to files not yet written.

If the user picks a different language than the existing setup uses (update mode), translate only the text that comes from the templates; translate the user's own content (custom rules, the contents of `## Project rules`) only if the user explicitly asks, and list what was translated in the report.

## Step 0. Study the project (read-only)

Study the project the way a new tech lead would on their first day. Read real files instead of guessing from names. You may run any commands that do not change the project state (`git log`, `git branch -a`, `ls`, `<tool> --version`, `--help`, collecting a test list without running it) to confirm facts. Support every claim about the project with a file you have read: do not say a module is responsible for behavior until you have found the file that implements it, and do not draw conclusions about the whole project from one subsystem. For the key scenario, trace the real execution path from the entry point to storage. Determine the following.

1. **Purpose and domain.** `README`, documentation, `CONTRIBUTING`, `CHANGELOG`, top-level comments, module and entity names. What the system does, its main concepts and modules.
2. **Stack and environment.** Languages and versions, frameworks, package manager, build and configuration files (`pyproject.toml`, `requirements*.txt`, `setup.py`/`setup.cfg`, `Pipfile`, `uv.lock`/`poetry.lock`, `manage.py`, `package.json`, `go.mod`, `pom.xml`, `Makefile`, `justfile`, `Taskfile`, `docker-compose`, etc.; for monorepos or workspaces, the list of packages and which commands apply to which), databases and migration tool, containerization, environment variables.
3. **Quality tooling.** Linters, formatters, type checking, pre-commit, editor settings, CI configurations (GitHub Actions, GitLab CI, etc.): which checks are mandatory and which commands run them. Verify every command against the config or script that defines it.
4. **Architectural approach.** Determine from directory structure, module dependencies, and naming which approach is used: DDD (contexts, aggregates, layers), layered or hexagonal architecture, MVC, modular monolith, microservices, CQRS, event-driven model, etc. Establish layer boundaries, the allowed dependency direction, and where entities, repositories, services, and adapters live. Check whether the approach is applied consistently and note exceptions.
5. **Methodology and process.** How work is done: commit style; **base branch** (main, master, develop, etc.); **branch naming scheme** (study `git branch -a`, merge history via `git log --merges`, PR templates, `CONTRIBUTING`, CI: prefixes like `feature/` and `fix/`, issue tracker references, case, separators, real name examples; if there are several schemes, choose the predominant one that is current in recent history); TDD or coverage requirements, ADR practice, review process, releases and versioning, documentation rules.
6. **Code conventions.** Naming, file and module structure, error and exception handling, logging, configuration, secrets handling, typing, comment style. Derive them from existing code and look at several representative modules from different layers.
7. **Testing.** Framework, test location and naming, fixtures, levels (unit, integration, e2e), run commands, how to run a single test, coverage requirements. Establish which kinds of tests exist (unit, integration, end-to-end, contract, UI, other) and which of them CI runs, so the developer writes the kinds the project already uses (unit tests by default). If the project has no tests, do not invent a test setup: ask in Step 1 which kind and framework to adopt, offering unit tests with the framework that suits the stack as the recommended option. Find the real test locations with `find`, not by assuming `tests/`: for Python, check `tests/`, `test/`, `tests.py` (Django apps), `*_test.py` and `test_*.py` next to code, per-package `tests/` in monorepos, and `conftest.py`; confirm against `pytest.ini`, `pyproject.toml`, `tox.ini`, or `noxfile.py` (`testpaths`, `python_files`).
8. **Project structure.** A map of top-level and second-level directories with the purpose of each.
9. **Existing rules for AI and people.** `AGENTS.md`, `CONTRIBUTING` at the root and the existing contents of `.opencode/`. Legacy `CLAUDE.md` and `.cursorrules` are not loaded by OpenCode V2; read them only as project documentation, not as active rules. Read files outside `.opencode/` only and take them into account, but do not modify them. Find all nested `AGENTS.md` files in the project (`find . -name AGENTS.md -not -path './.opencode/*'`): do not copy their contents into `.opencode/AGENTS.md`, because they apply to their own directories; list them in the final report.
10. **Services, integrations, and existing diagrams.** Files `*.puml`, `*.mmd`, `workspace.dsl` (Structurizr), `openapi*`/`swagger*`, `asyncapi*`, `docker-compose`, Kubernetes/Helm manifests, API gateway and ingress configs. Build a list of the project's services (containers) and, for each: storage (databases, schemas, caches, object storage), brokers (topics and queues, who publishes and who consumes), external systems it communicates with, and known API consumers. Use existing diagrams outside `.opencode/` as a source and do not change them. Also build a documentation inventory: where documentation lives (`docs/`, `doc/`, wiki folders, ADR directories such as `docs/adr` or `doc/architecture/decisions`, requirements and specification folders), its tooling (`mkdocs.yml`, Sphinx `conf.py`, Docusaurus, Structurizr, OpenAPI), file formats (Markdown, reStructuredText, AsciiDoc), the diagram tool and notation (PlantUML, Mermaid, Structurizr, images), file naming and numbering schemes, the language of the documents, and whether it is up to date and in use (recent commits touching it). If there is no documentation beyond the README, say so.
11. **Available skills.** Locate the setup root (see "Setup source and automation"). List the directories under `<setup root>/skills/` that contain a `SKILL.md`. For each, read only the frontmatter to get `name` and `description`; the skill ID is the directory name. If the frontmatter `name` differs from the directory name, report the skill as invalid and do not offer it. Note whether the skill matches the detected stack (for example, a Python skill for a Python project or a Flet skill for a Flet project). Do not read or copy the full contents yet. If the directory is missing or empty, note that no skills are available.

Record your findings for each item together with the supporting files and confidence level (explicitly confirmed / inferred from code / not determined).

## Step 1. Clarifications

Do not invent anything or make decisions for the user. Collect all questions left after the study into one request (using the question tool with choices if available, otherwise one message). The language was already chosen in "Language selection": ask every question in that language. Ask the skill question first, then the documentation question, then the project questions.

1. **Skills.** Present the catalog discovered in Step 0 as a table with ID (the directory name, which must equal the `name` in the frontmatter), description, and whether the skill matches the detected stack. Ask which skills to install: install the relevant skills (recommended), install all available, install none, or select specific skills. Allow a custom answer with a list of IDs; accept only IDs present in the catalog and ask again about any unknown ID instead of guessing or skipping it. If no skills are available, say so and skip installation. In update mode, add a column with the state of each catalog skill in `.opencode/skills/`: not installed, installed and identical, or installed and different (and say which side is newer if git history shows it); with a language other than English, compare as described in Step 2 so that a translated copy counts as identical. Skills in `.opencode/skills/` that are not in the catalog belong to the user: never touch, list, or offer to replace them, and mention them in the report. If a selected skill already exists in `.opencode/skills/`, include a follow-up question for each conflict: replace, keep the existing version, or merge (merge only if the user asks explicitly; otherwise never overwrite silently).
2. **Documentation.** Always ask, including for a clean project. First, whether agents should maintain documentation at all; second, if the project already has documentation (Step 0 item 10 inventory: locations, formats, diagram tool, naming, language), how to treat it. Options for a project with existing documentation: (a) **Keep the project's existing documentation** as it is: analysts and architects maintain it where it lives, in its formats and naming, and `.opencode/docs/` is not created (recommended when the existing documentation is consistent and in use); (b) **Use the prompt's standard for new documents**: create `.opencode/docs/` with the standard layout and formats (PlantUML C4 and sequence diagrams, `requirements`, `adr`, `architecture`); existing documentation stays where it is untouched and is read as a source, not edited; (c) **Rework existing documentation to the prompt's standard**: convert it into `.opencode/docs/` (copies in the standard layout and formats); originals are not changed or deleted by this setup, and the report lists which originals are now superseded so the user can remove them. For (c), before writing show a conversion plan (source file → target file, and what cannot be converted) and wait for confirmation; do not invent content for gaps, ask or mark them in the report; (d) **No documentation maintained by agents**: `.opencode/docs/` is not created, agents do not create or update documentation files, and requirements, decisions, and diagrams appear only in their reports. Options for a clean project (no documentation beyond the README): (b) **the prompt's standard** in `.opencode/docs/` (recommended), or (d) **no documentation maintained by agents**; allow a custom answer such as a different directory, which is handled like (a) with the user's path. Allow a custom answer in every case. In update mode, if `.opencode/AGENTS.md` already has a "Documentation" section, offer the previous choice as the recommended answer; if `.opencode/docs/` already has content, the previous choice is (b) unless the section says otherwise. If there is no answer, use (a) when existing documentation is consistent, otherwise (b), and note the default in the report.
3. **Project questions.** These may include: competing approaches or conflicting commands, a non-obvious base branch or branch naming scheme, an unclear service composition, a skills directory path if the installed OpenCode version uses another path, and conflicts with existing files (check in advance which files from Steps 3-6 already exist).

Give each question 2-4 options found in the repository (with supporting files), mark the recommended one, and leave room for a custom answer. Do not ask what can be determined from code. Wait for the answer, then proceed to Step 2. Record the user's answers as confirmed.

## Step 2. Existing files

In "update" mode, the rules in "Working mode: creation or update" apply instead of the rules in this step.

Before creating any file, check whether it already exists and apply the user's answers from Step 1:

- `.opencode/AGENTS.md`: keep all existing sections verbatim and add the missing ones.
- An agent file with a matching name: follow the user's answer "replace", "merge" (use the template as the base, move custom instructions, the `model` field, and additional fields from the existing file, take permissions from the template and add the existing project-specific `allow` rules; list the differences in the report), or "skip".
- Do not delete or overwrite anything without the user's answer.
- A skill selected for installation that already exists: compare the directories. If they are identical, skip. If they differ, apply the user's answer: replace, keep, or merge. When the selected language is not English, an installed skill legitimately differs from the catalog in prose only because of translation: treat it as identical if the file list, the frontmatter `name`, and all code blocks match the catalog, and as different otherwise (a local edit changed code or structure).

## Step 3. Create `.opencode/AGENTS.md`

This file is loaded into every agent's context, so keep it minimal: only what all roles need. Put anything needed by only one or two roles (branches and commits, documentation and diagram formats, code conventions, review checklist, service list) into those agents' files in Step 6 instead of here. Do not describe the pipeline or other roles: only `tech-lead` knows them. Fill the file with real data found in Step 0. Do not leave placeholders or template brackets. Do not include sections without confirmed data.

Use this structure:

```markdown
# Project Rules

Primary agent: `tech-lead` (switch with Tab); other agents are invoked by it as subagents. Language of reports, of all documents in `.opencode/docs/` (requirements, ADRs, architecture descriptions, diagram titles and labels), and of rules and skills added later: English. When editing an existing file, keep its language.

## About the project

The system's purpose and main modules (2-4 lines).

## Technology and commands

- Language and version, frameworks, package manager, database and migrations.
- Confirmed commands only: install, run, linter, formatting, type checking, all tests, one test, migrations, build.

## Testing

Shared by the developer (writes tests with the code), the reviewer (checks them), and the tester (extends and runs them): the framework, where tests live and how they are named, the kinds of tests the project has (unit, integration, end-to-end, other) with the kinds that must accompany a code change, and how to run each kind. If the project has no tests, record only the kind and framework the user chose in Step 1.

## Project structure

Top-level and second-level directories with their purpose.

## Architecture

Approach, layers, allowed dependency direction, location of key elements. Prohibitions and required practices: short verifiable statements, one per line.

## Documentation

Only when the Step 1 answer is not the plain standard: the documentation mode chosen in Step 1 and the paths, formats, and diagram tool that apply.

## General rules

- Work autonomously: do everything you can with your own tools within your permissions. Do not ask the user to run a command, open a file, or fix it. If an action is outside your permissions or role, describe in the report which agent should receive it (tech-lead delegates it). Ask the user only about `commit` and `push`, secrets and access, and business decisions.
- Stay within the task. Do not invent anything (commands, paths, APIs, project facts). If data is missing, continue only with an assumption explicitly marked in the report; if the result depends on it, stop and ask a question in the report.
- Solve each task in a separate git branch; never work in the base branch. The branch is created by `tech-lead`, or by whoever first changes files if tech-lead is not involved.
- Nested `AGENTS.md`: before reading or changing files in a directory, check whether it or any parent directory (up to the project root) has its own `AGENTS.md`. If it does, read it: its rules and restrictions take precedence over the general rules for that directory; when they conflict, follow the one closest to the file.
- Do not lose other people's uncommitted changes (do not use `reset`, `checkout --`, `stash`, or `clean`): report them to the user.
- Do not commit or push without an explicit request.
- Do not delete or weaken tests just to get a green result.
- Secrets are not stored in code or documentation.
- Documentation in `.opencode/docs/` must match the code. If your work makes it outdated, list the affected files or topics in the report.
- If you notice a recurring mistake or technique that should be captured, add a "Proposals" section to the report (a rule or skill, one or two lines). Do not add rules or skills yourself: the user decides through `tech-lead`.
```

Copy it to `.opencode/AGENTS.md`, replace the generic descriptions with facts from Step 0, and remove any section without confirmed data. In the first paragraph, write the language selected in "Language selection" by name (`English` above is the default): agents run in later sessions and do not know what was chosen during setup, so never write "selected during setup" or similar. Agents read this line to decide the language of their reports and documents. The template does not describe the pipeline or other roles: only `tech-lead` knows them.

The "Documentation" section depends on the Step 1 answer. Option (a): a mapping from each standard location to the real one (requirements, ADRs, architecture descriptions, C4 diagrams, sequence diagrams), the file format and naming of each, the diagram tool, and the sentence "These paths and formats replace the ones in the agents' instructions." Option (b): one line saying that standard documents live in `.opencode/docs/` and that existing documentation at the listed paths is reference material that agents read and do not edit unless asked. Option (c): one line saying that the documents were converted into `.opencode/docs/`, plus the paths of the superseded originals, which agents must not edit. Option (d): "Agents do not create or update documentation files; requirements, decisions, and diagrams are given in reports only. Skip the documentation steps in agent instructions." Omit the section for the plain standard layout on a clean project (nothing to map).

Formulate rules as short verifiable statements, one per line. If you find discrepancies between the code and the identified approach, do not "fix" the code: record the rule for the target approach (if it is obvious) and note the discrepancies in the final report. If a language other than English was selected in "Language selection", translate this template and all generated content into that language, keeping code, commands, paths, and identifiers unchanged.

## Step 4. Connect the rules in `.opencode/opencode.json` or `.opencode/opencode.jsonc`

Check for `.opencode/opencode.json` and `.opencode/opencode.jsonc`. If one exists, use it. If both exist, ask which one to update; do not merge them silently. If neither exists, create `.opencode/opencode.json`.

Read the chosen file and make the minimal change:

- If the `instructions` key is missing, add `"instructions": [".opencode/AGENTS.md"]`.
- If `instructions` already exists, add `.opencode/AGENTS.md` to the array if it is not already there. Do not change or reorder existing elements.
- Make `tech-lead` the agent that OpenCode starts with. If the `default_agent` key is missing, add `"default_agent": "tech-lead"`. If it is already `"tech-lead"`, do nothing. If it is set to another agent, do not overwrite it silently: ask the user (in the selected language) whether to replace it with `tech-lead` (recommended) or keep the current value, and record the answer in the report. Also check the project's root `opencode.json` or `opencode.jsonc` (if any) for `default_agent`, because it may override this file: if it sets another agent, tell the user and ask, but do not edit the root file; the setup changes files only inside `.opencode/`. `tech-lead` is a primary agent (`mode: primary` in its file), which `default_agent` requires.
- Leave all other keys, values, order, comments, and formatting unchanged. Make the change precisely (with an editing tool), not by rewriting the whole file.
- If the file was missing and you created it, note this in the final report.

Verify from the installed OpenCode version's help (`opencode --help`, documentation, existing configs) that `instructions` from the project configuration are loaded. Each agent reads `.opencode/AGENTS.md` at the start of its work anyway, so the rules apply regardless. If loading cannot be confirmed, do not create files outside `.opencode/`; report it in the final report.

## Step 5. Create documentation directories and install skills

If the user chose to keep the existing documentation (option (a)) or no documentation (option (d)) in Step 1 "Documentation", do not create `.opencode/docs/`. Otherwise create the directories `.opencode/docs/requirements/`, `.opencode/docs/adr/`, `.opencode/docs/architecture/`, `.opencode/docs/diagrams/c4/`, `.opencode/docs/diagrams/sequence/` and put an empty `.gitkeep` file in each.

Create `.opencode/skills/` if it does not exist. For each skill selected in Step 1, copy the whole directory from `<setup root>/skills/<id>/` to `.opencode/skills/<id>/`:

```bash
mkdir -p ".opencode/skills/<id>"
cp -R "<setup root>/skills/<id>/." ".opencode/skills/<id>/"
```

- The skill must keep its structure: `.opencode/skills/<id>/SKILL.md` and any supporting files.
- Copy the skill files first, then, if a language other than English was selected in "Language selection", translate the installed copy into that language (never the source clone). Translate prose in every `.md` file and the value of `description` in the `SKILL.md` frontmatter. Keep unchanged: the `name` and all other frontmatter keys and values, file and directory names, the `LICENSE` file, fenced code blocks, inline code, commands, paths, URLs, link targets, and identifiers. Do not add, drop, merge, or reorder rules, headings, or code blocks, and do not rephrase a rule so that its meaning changes; translate sentence by sentence. Non-text files and scripts are copied as they are. With English selected, skills are copied byte for byte and not edited. If a skill already exists, follow the conflict answer from Step 1. When replacing, start from a clean `.opencode/skills/<id>/` directory so files removed from the source do not remain.
- If no skills are selected and `.opencode/skills/` is empty, create `.opencode/skills/.gitkeep` so the directory is kept in git. Do not create it when the directory already contains skills.
- Current OpenCode V2 reads `.opencode/skills/`. Verify the path against the installed version's documentation; if it uses another path (for example, the older `.opencode/skill/`), use that path and note it in the report.

## Step 6. Create the agents in `.opencode/agents/`

Create six files from the templates in `<setup root>/templates/agents/`:

- `tech-lead.md` (primary agent)
- `analyst.md`
- `architect.md`
- `developer.md`
- `reviewer.md`
- `tester.md`

Read each role template and write the result to `.opencode/agents/<role>.md` with three kinds of changes only: translation when another language was selected, the permission changes described below (for example, the tester's test locations), and the `## Project rules` section added at the end. Do not edit the instructions in the body of the template and do not insert project facts into them (for example, "there is no linter" into a step, or a project path into a rule): the body is shared by all projects, and every project fact goes only into `## Project rules` or `.opencode/AGENTS.md`.

Each template in `<setup root>/templates/agents/` contains a complete `permissions` array: role-specific `edit` rules followed by shell and webfetch rules. Edit the permissions in the template for the role that needs a change; the generated agent copies the complete array. Permissions are intentionally independent per agent, so changing one role does not affect the others.

Permission principles:

- Permissions are granted according to the role and must not hinder work. Rules are evaluated top to bottom, and the last match wins (verify against the installed OpenCode version's documentation). Therefore the general `shell` rule with resource `"*"` and effect `allow` comes first, followed by exceptions.
- All roles get shell access allowed by default. The templates deny force pushes in any argument position, `git -C` variants, `git reset --hard`, `git clean`, `git stash`, `git checkout --`, `git restore`, discard-changes switches, and `sudo`; recursive or forced `rm` goes through `ask`. Keep the rules in each agent template and edit them independently when a role needs different permissions.
- Only file writes are genuinely restricted: `reviewer` does not write; `tester` writes only tests (in the project's real test locations, see "Tester write scope"); `analyst` and `architect` write only to `.opencode/docs/`; `tech-lead` additionally writes to `.opencode/agents/`, `.opencode/skills/`, and `.opencode/AGENTS.md` (only with user confirmation, see "Learning"); `developer` writes everywhere.
- Do not add a `model` field: agents use the default model from the configuration. Do not add `temperature`: V2 ignores it, and sampling belongs on a model variant.
- The templates use native V2 permissions: an ordered `permissions` array of `{action, resource, effect}` objects with `shell` for commands. If the installed version is V1, convert them to the singular `permission` map and the `bash` action while preserving every rule.
- `mode: primary` appears only in `tech-lead.md`; all other templates use `mode: subagent`.
- **Documentation write scope.** The templates let `analyst` and `architect` edit only `.opencode/docs/**`, and `tech-lead` additionally `.opencode/agents/**`, `.opencode/skills/**`, and `.opencode/AGENTS.md`. With option (a) in Step 1 "Documentation", add `edit` allow rules for the project's real documentation paths from the mapping in `.opencode/AGENTS.md` (for example `docs/**` or `doc/adr/**`) to `analyst`, `architect`, and `tech-lead`, and drop the `.opencode/docs/**` rule from the agents that no longer write there; never allow more than the documentation paths. With option (d), remove the `.opencode/docs/**` allow rules from `analyst`, `architect`, and `tech-lead`, so analyst and architect become read-only (the preceding `edit` `*` deny rule remains) and tech-lead keeps only its `.opencode/agents/**`, `.opencode/skills/**`, and `.opencode/AGENTS.md` rules. With options (b) and (c), keep the template rules.
- **Tester write scope.** The template allows editing only `tests/**`, which is a default and not a fact about the project. In `.opencode/agents/tester.md`, keep the preceding `edit` `*` deny rule and replace the `tests/**` allow rule with one allow rule per real test location found in Step 0 item 7: for example `test/**`, `**/tests/**`, `**/tests.py` (Django), `**/test_*.py`, `**/*_test.py` (tests next to code), `**/conftest.py`, or `services/*/tests/**` in a monorepo. Add both the root form (`tests/**`) and the nested form (`**/tests/**`) when tests exist at both levels, because wildcard matching may not treat a leading `**/` as optional. Never allow production code paths. If test locations cannot be determined, ask in Step 1.

Each agent file ends with a `## Project rules` section containing the project data needed only by that role. Write each fact once, in one place, and decide the place before writing. A fact that every role needs, or that is already in `.opencode/AGENTS.md` ("Technology and commands", "Architecture", "General rules"), stays only there: agents already read that file, so do not restate it in `## Project rules` and do not copy a rule that the role template body already contains, even in other words (before writing each line, compare it with the template body and `.opencode/AGENTS.md`; keep only the project-specific value, such as a command, path, or fact, and drop the instruction around it) (for example, commit and push only on request, do not weaken tests, layer boundaries and dependency direction from "Architecture"). Do not write "absent" facts into agents (no linter, no type checker, no migrations): they belong once in `.opencode/AGENTS.md` or are omitted. A role's `## Project rules` holds only facts that no other file has and that only this role needs. Do not add information about other roles or the pipeline to an agent (exception: `tech-lead`). The section contents:

- tech-lead: base branch, branch naming scheme with 2-3 real examples from history, commit style, and the project's own acceptance checks (real commands and documents) that Pipeline step 6 does not already say.
- analyst: domain terminology, project-specific points for requirements that the template rules do not already say, the list of project services with a short purpose (participants of sequence diagrams), known API consumers.
- architect: constraints of the project's approach that are not already in the "Architecture" section of `.opencode/AGENTS.md` (the architect reads that section; do not copy it), the list of project services with a short purpose (for `C4_<ServiceName>.puml` names), which layers and modules to show on diagrams, ADR practice.
- developer: the project's test-writing details that are not in the "Testing" section of `.opencode/AGENTS.md` (for example, fixture helpers), project-specific code conventions (naming, logging, typing, configuration, and error handling only where it differs from the template's "Standards"), rules for migrations and databases, base branch and branch naming scheme (briefly), commit style.
- reviewer: project checklist items that are not in `.opencode/AGENTS.md`: conventions, migration, test, and security requirements, mandatory CI checks. Layer boundaries and dependency directions are checked against the "Architecture" section of `.opencode/AGENTS.md` and are not copied here.
- tester: fixtures and test data, which kinds of tests to add on top of the developer's (integration, end-to-end, edge cases) and when, coverage requirements. The framework, locations, naming, kinds, and run commands are in the "Testing" section of `.opencode/AGENTS.md` and are not repeated here.

If a language other than English was selected in "Language selection", translate all templates and generated text into that language, including section headings such as `## Project rules`, `## Documentation updates`, and `## Learning`; keep frontmatter keys, permission keys, code, commands, paths, and identifiers unchanged.

## Step 7. Find and remove duplicates

This runs after Step 6, when the templates have already been merged with the user's existing setup (in creation mode too, if files were merged according to Step 2). The goal: every rule and restriction is recorded once, in the right place.

1. Read `.opencode/AGENTS.md`, all agent files, and the project's nested `AGENTS.md` files (the latter read-only). Build a list of rules and restrictions: rule items and prohibitions. Permission arrays are independent per agent and may intentionally be identical or diverge; do not report cross-agent permission duplication.
2. Find duplicates:
   - the same rule in `.opencode/AGENTS.md` and an agent file, in several agents, or in several sections of one file (including by meaning, not only verbatim);
   - user rules that repeat template rules, and vice versa;
   - duplicate permission rules within one agent;
   - a rule in a nested `AGENTS.md` that repeats the root one.
3. Decide where to keep the single copy: a rule for all roles in `.opencode/AGENTS.md`, a rule for one role in its file, a directory rule in its nested `AGENTS.md`. If a rule is needed by two or three roles as an action of that role (for example, the reviewer checking that a shared rule is followed), it is not a duplicate; keep it.
4. Do not remove or weaken anything that cannot be unambiguously identified as a duplicate. If the wording differs in meaning (one is stricter, values differ, they contradict each other), that is a conflict, not a duplicate: do not choose yourself; ask the user with options and show both wordings with their files. Do not remove prohibitions or permission restrictions without an answer.
5. Duplicates that this run introduced itself in creation mode (text it just wrote from the templates and Step 0 facts, with nothing the user wrote involved) are removed without asking, keeping the single copy chosen by the placement rule in Step 6; list them in the final report. For every other duplicate (update mode, merged or pre-existing user content), show the user the list: what (verbatim), where it is, and where the single copy will remain, and delete only after confirmation. If there are no duplicates, say so.
6. Do not create copies or backup files (changes are visible in `git diff`). Nothing is lost: only the repetition is removed, and the single copy remains.

## Step 8. Verification

1. Make sure all six agent files exist in `.opencode/agents/`, along with `.opencode/AGENTS.md` and the `.opencode/docs/*` directories, and that `.opencode/opencode.json` or `.opencode/opencode.jsonc` was changed only by adding `.opencode/AGENTS.md` to `instructions` and, if the user did not decline, `"default_agent": "tech-lead"` (check the diff before and after).
2. Verify that all agents' frontmatter is correct (three dashes, valid YAML, `mode: primary` only for `tech-lead`, `description` in double quotes so colons inside do not break parsing).
3. Verify that `.opencode/AGENTS.md` and the agents have no placeholders or service comments like `# here ...`, `...`, `{...}`, `<...>` (except what the role templates contain on purpose: `<topic>`, `NNNN`, `<ServiceName>`, `<ProcessName>`, `<id>`, `<file>` in file-name templates, paths, and commands, and PlantUML syntax such as `!include <C4/C4_Container>`, `!include <C4/C4_Component>`, and `<<external system>>`; do not remove these).
4. Verify that all commands in `.opencode/AGENTS.md` and agent permissions actually exist in the project configs.
5. Verify that every agent references `.opencode/AGENTS.md`.
6. Verify that nothing outside `.opencode/` was created or changed (for example, with `git status`).
7. Verify that the base branch and branch naming scheme with real examples are recorded in the project-rules section of `tech-lead.md` and `developer.md` (the localized equivalent of `## Project rules`), and that the "new branch for every task" rule is in `.opencode/AGENTS.md` and `tech-lead.md`. If the scheme is not defined and the user did not answer, do not invent it: leave the item without a scheme and note it in the final report.
8. Verify documentation layout: with the standard layout (options (b) and (c), including a clean project that chose the standard), `.opencode/docs/diagrams/c4/` and `.opencode/docs/diagrams/sequence/` were created, `analyst.md` and `architect.md` describe the diagram formats (headers `@startuml Sequence_<...>` and `@startuml C4_<...>` with `!include <C4/C4_Container>` and `LAYOUT_WITH_LEGEND()`), and these agents have write permission to `.opencode/docs/`. With option (a), `.opencode/docs/` was not created, the "Documentation" section of `.opencode/AGENTS.md` maps every standard location to a real path that exists, and these agents have write permission to exactly those paths. With option (d), `.opencode/docs/` was not created, the "Documentation" section says agents do not maintain documentation, and analyst and architect have no `edit` allow rule.
9. Do not run the full test suite or build. Run safe checks (`--version`, `--help`, collecting a test list without running, the linter in check mode) to confirm commands.
10. Verify permissions: all six agents use the `permissions` array with a general shell rule of `allow` and bans on destructive commands; file writes are restricted only for reviewer (denied), tester (every existing test file path of the project matches one of its `edit` allow rules, and no production path does), analyst and architect (`.opencode/docs/**`, or the mapped documentation paths with option (a)), and tech-lead (the same documentation paths, `.opencode/agents/**`, `.opencode/skills/**`, `.opencode/AGENTS.md`); `.opencode/AGENTS.md` has the autonomous-work rule.
11. Verify that `.opencode/AGENTS.md` has the nested `AGENTS.md` rule and that `reviewer.md` checks compliance with them.
12. Verify scope: `.opencode/AGENTS.md` does not contain the pipeline, diagram formats, code conventions, or review rules, and its "Testing" section holds only the shared testing facts; each agent ends with a project-rules section (the localized equivalent of `## Project rules`) containing real data, without duplicating `.opencode/AGENTS.md` or the instructions in the role template body; the body of every agent matches its template apart from translation and permissions.
13. Verify documentation: the first paragraph of `.opencode/AGENTS.md` names the language for documents in `.opencode/docs/`, and `analyst.md`, `architect.md`, and `tech-lead.md` point to it where they write documents, rules, or skills; `tech-lead.md` has a documentation step before acceptance and an item in the final report; `analyst.md` and `architect.md` have a documentation-updates section (the localized equivalent of `## Documentation updates`); the developer's report has an item about outdated documentation.
14. Verify learning: `tech-lead.md` has a learning section (the localized equivalent of `## Learning`; changes are applied directly to agent files, `.opencode/AGENTS.md`, and skills after user confirmation, without intermediate files); the tech-lead final report has an item about rule and skill changes; `.opencode/AGENTS.md` has a rule about a proposals section; `.opencode/skills/` exists with installed skills or a `.gitkeep` file.
15. Verify duplicates: no repeated project rules, conflicting wording, or duplicate permission rules within one agent remain, or they were raised to the user; cross-agent permission arrays are intentionally independent and are not duplicate findings. Removed repetitions are shown in the summary.
16. Verify skills: every selected skill exists at `.opencode/skills/<id>/SKILL.md`, its files match the source directory (byte for byte with English; with another language only the prose differs, while the file list, frontmatter `name` and keys, the `LICENSE`, the number and order of headings, and every code block are unchanged), except where the user answered "keep the existing version", and this run installed no unselected skill; skills that were already in `.opencode/skills/` before the run are unchanged unless the user chose to replace them. If no skills were selected and the directory is empty, `.opencode/skills/.gitkeep` exists.
17. Verify language: all generated prose (`.opencode/AGENTS.md`, agent files, installed skills, reports) is in the language selected in "Language selection"; for skills, read every installed `.md` file and confirm no English prose remains outside code; code, commands, paths, permission keys, and identifiers are unchanged. The first paragraph of `.opencode/AGENTS.md` names the concrete language, and no generated file contains setup-time wording such as "selected during setup" or "selected output language" (or its translation).
18. In update mode, verify that all project data and user rules from the old files are found in the new files; the change summary was shown to the user.
19. Verify templates: every generated agent contains a complete `permissions` array copied or adjusted from its role template; no template markers or comments remain.
20. Verify testing roles: `.opencode/AGENTS.md` has a "Testing" section with real data (or the user's answer from Step 1 if the project had no tests); `developer.md` tells the developer to write tests together with the code and to list them in the report; `reviewer.md` checks the developer's tests as a separate item; `tester.md` extends the developer's tests instead of rewriting them; `tech-lead.md` assigns tests to the developer in the pipeline.
21. Verify documentation mode: the Step 1 "Documentation" answer is reflected consistently in `.opencode/AGENTS.md`, agent permissions, and the created directories; nothing outside `.opencode/` was changed; with option (c), every converted file is listed in the report with its original.
22. Verify task discipline: `reviewer.md` has the "Strictly by the task" checklist item and the report item for content not in the task, and `developer.md` has the report item for assumptions and additions.

## Step 9. Final report

Answer the user briefly, in the language selected in "Language selection":

- Working mode (creation or update).
- Output language (the user's choice, the kept current language, or the English default).
- Which files were created, changed, or skipped (and why); for an update, what was added, moved, or replaced, per file, and what was deliberately left untouched (user content, existing skills, `.opencode/docs/`).
- For an update: the language kept or changed (and what was translated), the state of each catalog skill before and after (installed, kept, replaced, skipped), the questions asked and the answers, and the permissions that were broader than the template and kept by the user's decision.
- What you learned about the project: purpose, stack, architectural approach, methodology, main tools (3-7 lines).
- What was explicitly confirmed, what was inferred from code, and what was not determined.
- Base branch and branch naming scheme (identified or specified by the user; if not determined, say so).
- Discovered services and existing diagrams (if any).
- Discovered nested `AGENTS.md` files (paths).
- Discrepancies between the identified approach and the actual code (if any).
- The user's answers to clarifications and items left "not determined".
- Documentation: the option chosen in Step 1, the locations agents will use, and for option (c) the converted files, what could not be converted, and the superseded originals.
- Installed skills: IDs and source directories, the language they were translated into (or that they were copied unchanged), skipped or kept skills and why.
- Agent permissions: who can do what (one line per role).
- Found and removed rule duplicates (file, rule, where the copy remains) and unresolved wording conflicts.
- What needs to be clarified or checked manually.
- How to switch to `tech-lead` and start the first task.

## Limitations

- Do not change the project's source code, build configs, or dependencies. Only files inside `.opencode/` are created or changed: `.opencode/AGENTS.md`, agent files in `.opencode/agents/`, `.opencode/docs/` directories (including `diagrams/c4` and `diagrams/sequence`) with `.gitkeep` (not created when the user keeps the project's existing documentation), documents converted into `.opencode/docs/` when the user chose option (c) in Step 1 "Documentation", selected skills in `.opencode/skills/`, and only the `instructions` and `default_agent` elements in `.opencode/opencode.json`.
- Do not commit and do not create branches as part of the setup itself: the branch rule applies to the agents' future work.
- Do not invent commands, paths, or rules: take them from the repository or ask.
- Do not overwrite existing files: merge them according to Step 2 or the update-mode rules.
- Do not modify skill contents when copying them, except for the translation described in Step 5 when a language other than English was selected. Use the temporary clone of the setup repository only for reading and copying; remove it afterward.
