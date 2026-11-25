# OpenCode Setup Prompt

Set up a repository for OpenCode V2. Run from the target Git repository with a configured provider:

```bash
opencode --prompt "Set up this project using https://github.com/mokforge/opencode-setup-prompt"
```

Or paste this into OpenCode:

```text
Set up this project using https://github.com/mokforge/opencode-setup-prompt
```

For a local copy, use `opencode-setup-prompt.md` instead of the URL. The setup configures OpenCode; it does not install application dependencies or bootstrap the app.

## Optional plugins

Analyzer and Hooks are opt-in plugins. A request to install Skills does not install either plugin.

### Analyzer

Install interactively by choosing **Yes**, or explicitly request `Install Analyzer.` in unattended setup.

Analyzer is a local, read-only telemetry agent. It is separate from the core team, runs without `tech-lead`, and does not become the default agent. No package install or manifest change is needed. Run it with:

```bash
opencode run --agent analyzer "Summarize agent behavior for the last 7 days."
```

Its database is `.opencode/plugins/analyzer/data.sqlite`. It does not store prompts, model responses, source contents, or raw tool inputs and outputs. If used with a cloud model, analysis results may be sent to that provider.

### Hooks

Install interactively by choosing **Yes**, or explicitly request `Install Hooks.` in unattended setup. Configuration and plugin files live in `.opencode/plugins/hooks/`.

Hooks are disabled by default. Configure events and actions in `hooks.yml`, then set `enabled: true`; reload OpenCode with `/reload`. Hook prompts and commands run in the triggering session, so their turns appear in the same conversation. On OpenCode 2.4.x, `session.idle` hooks are dispatched from `session.execution.succeeded`. Hook-generated turns are marked to prevent recursive dispatch. Hooks can attach Skills and mention agents; they do not run arbitrary shell commands or add agent permissions.
