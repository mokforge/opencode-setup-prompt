# OpenCode Setup Prompt

One prompt that turns any repository into an OpenCode project with a six-agent team (`tech-lead`, `analyst`, `architect`, `developer`, `reviewer`, `tester`) and optional skills.

## Install

Run this in the root of your project (a git repository):

```bash
opencode --prompt "Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt"
```

OpenCode opens with the task already sent. The agent clones this repository to a temporary directory, studies your project, and asks you:

1. the **language** for generated files and reports (English or Russian);
2. which **skills** to install (relevant, all, none, or a selection);
3. anything it cannot determine from the code.

Then it creates everything inside `.opencode/` and removes the temporary clone. Nothing is committed or pushed; review the result with `git status` and `git diff`.

Already running OpenCode? Send the same sentence as a message:

```text
Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt
```

## Run again

Run the same command any time to update an existing setup. The agent keeps your rules, agents' `## Project rules`, existing skills, and docs, asks before changing anything unclear, and reports what it changed. If nothing needs changing, it changes nothing.

## What you get

- `.opencode/AGENTS.md`: minimal rules for all agents, connected in `.opencode/opencode.json`.
- `.opencode/agents/`: the six agents.
- `.opencode/docs/`: folders for requirements, ADRs, architecture, and C4 / sequence diagrams. The setup asks whether agents should maintain documentation at all; if your project already has some, you choose whether they keep it as it is, use this standard for new documents, or convert the existing documents to it.
- `.opencode/skills/`: the skills you selected, including the optional PlantUML diagram skills.

`tech-lead` is set as the default agent (`default_agent` in `.opencode/opencode.json`), so OpenCode starts with it. Describe a task: it creates a branch and delegates to the other agents.

## PlantUML diagrams via skills

The catalog contains two separate skills:

- **`plantuml-c4`** — C4 System Context (L1), Container (L2), and Component (L3) diagrams; checks C4 scope and PlantUML syntax.
- **`plantuml-sequence`** — sequence diagrams for API calls, events, branches, and failure scenarios.

When you choose to maintain PlantUML documentation during setup, select the relevant skills (the “relevant” or “all” options include them). OpenCode loads a selected skill through the native `skill` tool when the architect or analyst needs it; the agent templates contain invocation instructions, **not** duplicated PlantUML grammar. Skills are not installed against your choice.

C4 **L2** shows deployable containers in a software system, while **L3** shows components within a single container. Legacy diagrams that mix these levels must be reviewed and split when modified, without inventing missing architecture. Source diagrams remain editable `.puml` files for JetBrains [PlantUML4Idea](https://plugins.jetbrains.com/plugin/7017-plantuml4idea/). Their syntax should be checked with PlantUML CLI and the IDE preview checked separately; using a local `!include <C4/...>` avoids network-only C4 dependencies.

## Requirements

- OpenCode V2 (tested with 2.3.0) with a configured provider and model.
- Network access to GitHub, or a local clone (below).

## Without network access

```bash
git clone --depth 1 https://github.com/mokforge/opencode-setup-prompt.git /tmp/opencode-setup-prompt
opencode --prompt "Read /tmp/opencode-setup-prompt/opencode-setup-prompt.md and follow it. Setup root: /tmp/opencode-setup-prompt. Target project: the current directory."
```

## Contributing

Skills, agent templates, the prompt itself, and the rest of the repository can all be changed by contributors under the same rules. How to make a change and run the checks: [CONTRIBUTING.md](CONTRIBUTING.md). MIT license.
