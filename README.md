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
- `.opencode/docs/`: folders for requirements, ADRs, architecture, and C4 / sequence diagrams.
- `.opencode/skills/`: the skills you selected.

`tech-lead` is set as the default agent (`default_agent` in `.opencode/opencode.json`), so OpenCode starts with it. Describe a task: it creates a branch and delegates to the other agents.

## Requirements

- OpenCode V2 (tested with 2.3.0) with a configured provider and model.
- Network access to GitHub, or a local clone (below).

## Without network access

```bash
git clone --depth 1 https://github.com/mokforge/opencode-setup-prompt.git /tmp/opencode-setup-prompt
opencode --prompt "Read /tmp/opencode-setup-prompt/opencode-setup-prompt.md and follow it. Setup root: /tmp/opencode-setup-prompt. Target project: the current directory."
```

## Contributing

Adding skills and running repository checks: [CONTRIBUTING.md](CONTRIBUTING.md). MIT license.
