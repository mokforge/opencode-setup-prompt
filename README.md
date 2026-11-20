# OpenCode Setup Prompt

One prompt that turns any repository into an OpenCode project with a six-agent team (`tech-lead`, `analyst`, `architect`, `developer`, `reviewer`, `tester`), optional skills, a mandatory security review gate, and a deny-by-default external access policy.

## Install

Run this in the root of your project (a git repository):

```bash
opencode --prompt "Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt"
```

OpenCode opens with the task already sent. The agent clones this repository to a temporary directory, studies your project, and asks you:

1. the **language** for generated files and reports (English or Russian);
2. which optional **skills** to install (relevant, all, none, or a selection); the `security-review` skill is always installed;
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
- `.opencode/skills/`: the skills you selected, including the optional PlantUML diagram skills, plus the mandatory `security-review` skill.

`tech-lead` is set as the default agent (`default_agent` in `.opencode/opencode.json`), so OpenCode starts with it. Describe a task: it creates a branch and delegates to the other agents.

## PlantUML diagrams via skills

The catalog contains two separate skills:

- **`plantuml-c4`** — C4 System Context (L1), Container (L2), and Component (L3) diagrams with the level in every file name (`C4_L1_...`, `C4_L2_...`, `C4_L3_...`); checks C4 scope and PlantUML syntax.
- **`plantuml-sequence`** — sequence diagrams for API calls, events, branches, and failure scenarios.

When you choose to maintain PlantUML documentation during setup, select the relevant PlantUML skills (the “relevant” or “all” options include them). OpenCode loads a selected skill through the native `skill` tool when the architect or analyst needs it; the agent templates contain invocation instructions, **not** duplicated PlantUML grammar. The PlantUML skills are installed according to your choice; `security-review` is always installed.

C4 **L2** shows deployable containers in a software system, while **L3** shows components within a single container. Legacy diagrams that mix these levels must be reviewed and split when modified, without inventing missing architecture. Source diagrams remain editable `.puml` files for JetBrains [PlantUML4Idea](https://plugins.jetbrains.com/plugin/7017-plantuml4idea/). Their syntax should be checked with PlantUML CLI and the IDE preview checked separately; using a local `!include <C4/...>` avoids network-only C4 dependencies.

## Security review via a skill

`security-review` is installed in every setup and is mandatory for the reviewer and tech-lead. It checks SQL injection, broken access control (IDOR/BOLA), authentication and sessions, secrets, XSS/SSRF, path traversal, unsafe deserialization, file handling, cryptography, sensitive data in logs and errors, dependencies, CI/CD and platform configuration. The reviewer must include a security section in every review, and the tech-lead applies the same checklist as the acceptance gate. Agents load it through the native `skill` tool; the templates contain invocation instructions, **not** duplicated security grammar.

## External access policy

Every generated `.opencode/AGENTS.md` contains a deny-by-default policy for anything outside the repository: external files, the internet and external APIs, MCP servers, Confluence, GitLab, databases and remote services, uploads, `git push`, dependency downloads and commands that may use the network. Agents must ask the user before such an action and name the resource, purpose, actions and data that would leave the repository. The role templates enforce the main gates with OpenCode `ask` permissions (`webfetch`, `websearch`, `external_directory`, MCP tools, remote git, package installs and common network commands), and the generated `.opencode/opencode.json` carries the same global tool gates for built-in and future agents; local `git commit` stays allowed and `git push` asks. This is not a sandbox: shell scripts and tools not covered by a rule can bypass the patterns, and `--auto` auto-approves `ask`; the instruction remains mandatory and these limits are stated in the policy.

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
