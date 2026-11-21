# OpenCode Setup Prompt

One prompt that turns any repository into an OpenCode project for software development or documentation as code.

## Usage

Run this in the root of your project (a git repository):

```bash
opencode --prompt "Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt"
```

OpenCode opens with the task already sent. The agent inspects the project and asks about the language, the mode (development or docs-as-code), the documentation location, the external-access profile, and optional skills.

Already running OpenCode? Send the same sentence as a message:

```text
Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt
```

Setup files go in `.opencode/`. Nothing is committed or pushed; review the result with `git status` and `git diff`.

## Run again

Run the same command to update an existing setup. Your rules, skills, documentation, and external-access profile are preserved, and the agent shows changes before applying them.

## Unattended setup

Add this instruction to the prompt:

```text
Use unattended setup defaults. Do not ask non-blocking questions; preserve conflicting or user-owned content and report anything skipped.
```

## Requirements

- OpenCode V2 (tested with 2.3.2) with a configured provider and model.
- Network access to GitHub, or a local clone.

## Without network access

```bash
git clone --depth 1 https://github.com/mokforge/opencode-setup-prompt.git /tmp/opencode-setup-prompt
opencode --prompt "Read /tmp/opencode-setup-prompt/opencode-setup-prompt.md and follow it. Setup root: /tmp/opencode-setup-prompt. Target project: the current directory."
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT license.
