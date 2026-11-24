# Hooks plugin

This OpenCode V2 plugin listens to OpenCode session events through the plugin
event API and runs the configured hook entries. It reads `hooks.yml` from this
directory. Configuration is YAML only; no external package is required.

## Configure hooks

Edit `.opencode/plugins/hooks/hooks.yml`. Use the exact OpenCode event name as
the mapping key. Each event value must be a YAML list, even when it has only one
hook:

```yaml
hooks:
  session.idle:
    - enabled: true
      skills:
        - security-review
      prompt: Review the current changes for security issues and report findings.
    - enabled: true
      agents:
        - reviewer
      prompt: Review the current working-tree diff and return actionable findings.
    - enabled: true
      commands:
        - test
      prompt: Run the project's configured test command.
```

Entries run sequentially in the order listed. The next entry starts after the
previous entry's command/agent session has finished.

Supported fields on each hook:

- `enabled`: set to `true` to activate the hook. It defaults to `false`.
- `skills`: installed OpenCode Skill IDs to attach to the hook prompt.
- `commands`: registered OpenCode command names (without `/`). When present,
  `prompt` is passed as the command text/arguments.
- `agents`: OpenCode agent IDs. Each ID runs in its own independent session.
- `prompt`: optional task text for the configured Skills, command, or agent.
  When omitted, the plugin asks the selected agent to run the hook and return
  a concise report.

A `prompt` can be the only field besides `enabled`; it runs with the triggering
session's agent even when `skills`, `commands`, and `agents` are omitted. The
opposite also works: configure Skills, commands, and/or agents without a
`prompt`. The plugin supplies a default task prompt for Skills/agents, while
commands receive empty arguments.

Commands are registered OpenCode commands, not arbitrary shell strings. They
use OpenCode's normal session and permission behavior. Agents use their normal
OpenCode permissions. The plugin itself does not spawn shell processes or edit
project files.

The starter YAML keeps hooks disabled. After editing `hooks.yml`, reload
OpenCode with `/reload`. Unknown Skills, commands, or agents are skipped and
reported in the OpenCode log.

## Available OpenCode V2 session events

Use the exact event names in this table. Global events and events without a
session ID are not supported because hook actions need a triggering session.

| Event                            | When it occurs                                   |
| -------------------------------- | ------------------------------------------------ |
| `session.created`                | A new session is created.                        |
| `session.agent.selected`         | The selected agent changes.                      |
| `session.model.selected`         | The selected model changes.                      |
| `session.moved`                  | The session is moved to another location.        |
| `session.renamed`                | The session title changes.                       |
| `session.metadata.updated`       | Session metadata is updated.                     |
| `session.permissions`            | The session's permission rules are updated.      |
| `session.viewed`                 | The session is opened or viewed.                 |
| `session.archived`               | The session is archived.                         |
| `session.unarchived`             | The session is restored from the archive.        |
| `session.usage.updated`          | Cumulative usage information is updated.         |
| `session.forked`                 | A fork of a session is created.                  |
| `session.inbox.enqueued`         | A prompt or other inbox item is queued.          |
| `session.inbox.delivered`        | A queued inbox item is delivered.                |
| `session.inbox.cancelled`        | A queued inbox item is cancelled.                |
| `session.inbox.delivery.changed` | An inbox item's delivery mode changes.           |
| `session.execution.started`      | Agent execution starts.                          |
| `session.execution.succeeded`    | Agent execution completes successfully.          |
| `session.execution.failed`       | Agent execution fails.                           |
| `session.execution.interrupted`  | Agent execution is interrupted.                  |
| `session.idle`                   | The session becomes idle after execution.        |
| `session.instructions.updated`   | Session instructions are updated.                |
| `session.synthetic`              | A synthetic message is added to the session.     |
| `session.skill.activated`        | A Skill is activated in the session.             |
| `session.shell.started`          | A shell command starts in the session.           |
| `session.shell.ended`            | A shell command ends in the session.             |
| `session.step.started`           | An agent model step starts.                      |
| `session.step.first-token`       | The first output token for a model step arrives. |
| `session.step.ended`             | An agent model step ends.                        |
| `session.step.failed`            | An agent model step fails.                       |
| `session.text.started`           | An assistant text part starts.                   |
| `session.text.ended`             | An assistant text part ends.                     |
| `session.reasoning.started`      | An assistant reasoning part starts.              |
| `session.reasoning.ended`        | An assistant reasoning part ends.                |
| `session.tool.input.started`     | A tool input starts streaming.                   |
| `session.tool.input.ended`       | A tool input finishes streaming.                 |
| `session.tool.called`            | A tool is called.                                |
| `session.tool.success`           | A tool call succeeds.                            |
| `session.tool.failed`            | A tool call fails.                               |
| `session.retry.scheduled`        | A provider retry is scheduled.                   |
| `session.compaction.started`     | Session compaction starts.                       |
| `session.compaction.ended`       | Session compaction completes.                    |
| `session.compaction.failed`      | Session compaction fails.                        |
| `session.revert.staged`          | A session revert is staged.                      |
| `session.revert.cleared`         | A staged revert is cleared.                      |
| `session.revert.committed`       | A staged revert is committed.                    |
| `session.status`                 | The session status changes.                      |

High-volume streaming events (`session.text.delta`,
`session.reasoning.delta`, `session.step.streamed`,
`session.tool.input.delta`, `session.tool.progress`, and
`session.compaction.delta`) are intentionally not accepted; firing a hook for
every streamed update could create excessive sessions and model calls.
`session.deleted` is excluded because its session is no longer available for a
follow-up.

## How a hook runs

The plugin creates a separate OpenCode session at the triggering session's
location. It applies the configured Skill IDs, command names, or agent IDs in
that session, waits for it to finish, and posts the result to the original
session as a synthetic message. The original session is not resumed. Plugin-
created sessions and reports are excluded from hook dispatch to avoid loops.

Enabling a hook can create model requests through configured Skills, commands,
and agents. Their prompts, project files they read, and responses are subject
to the selected model provider's normal data handling. Keep only trusted IDs
in this project-local configuration; the plugin itself does not send data to
another service.
