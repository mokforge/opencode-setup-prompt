# OpenCode Setup Prompt

Configure any repository for development or documentation as code in OpenCode.

## Use

From the root of your project (a git repository), either run this in a terminal:

```bash
opencode --prompt "Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt"
```

Or paste this prompt directly into the OpenCode chat:

```bash
Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt
```

Any wording or language works. You can also provide only the prompt URL or a local path to `opencode-setup-prompt.md`. Analyzer and Hooks are separate optional components, not Skills; unattended setup installs either only when explicitly requested.

The prompt detects whether the project is new or already configured and sets it up or updates it accordingly. No exact phrase or extra rerun instruction is needed to run setup. Existing project choices and user-owned content are preserved; new or refreshed catalog skills are adapted to verified repository facts without weakening their general safeguards. Prose in every installed skill and explicitly selected plugin is translated into the selected language while code behavior and technical identifiers remain unchanged. Before work, every agent checks the Skills OpenCode advertises, recommends relevant ones, and loads them when permissions allow.

Interactive setup asks for the language and usage mode, then asks about unresolved project choices, optional Skills, Analyzer, and Hooks. It installs the six core roles in Development or four in Documentation (docs-as-code). Analyzer is offered separately and is not part of either core team. Hooks are an optional event-driven plugin with a YAML config and README. On a rerun, the prompt detects existing files, previews proposed updates, and preserves user-edited content when changes are declined or cannot be safely reconciled.

Requires OpenCode V2 with a configured provider and model. Setup files go in `.opencode/`; the optional Analyzer also adds two targeted database ignore rules to `.gitignore` after consent. Hooks are installed only after consent and do not add dependencies or OpenCode config entries. Nothing is committed or pushed. Review the result with `git diff`.

Reusable Skill templates live in `templates/skills/` and install into the target project at `.opencode/skills/`.

## Analyzer

Analyzer is an optional, local telemetry plugin and a separate read-only agent for analyzing how OpenCode agents behave. It can be selected directly as the primary agent and run without `tech-lead`. If the user explicitly asks, `tech-lead` can invoke the installed Analyzer as a subagent with a concise statistics-only brief; it is never called automatically. It recommends changes only to the OpenCode harness—agent instructions, Skills, model/tool settings, permissions, and orchestration—and never proposes application-code, product-test, or build-file changes. It is available in both Development and Documentation modes, is not a Skill, does not become the default agent, and is never added to the normal task pipeline.

### Install

- **Interactive setup:** choose **Yes, install Analyzer** when the prompt offers it. That single choice installs the plugin and paired agent and allows `tech-lead` to invoke Analyzer only when you explicitly ask; there is no separate agent or permission consent.
- **Unattended setup:** Analyzer is not installed by default. Ask for it explicitly, for example: `Install Analyzer.` or `Установи Analyzer.` A request to install all Skills does not include Analyzer.
- **Decline:** setup continues without Analyzer and does not add its files, configuration, or `.gitignore` rules.

The plugin is installed as `.opencode/plugins/analyzer/index.ts` and auto-discovered by supported OpenCode V2 versions. Its agent is `.opencode/agents/analyzer.md`. Opt-in setup also adds a narrowly scoped `tech-lead` permission, the two database ignore rules, and a startup check that does not call a model. The current plugin uses OpenCode's bundled Bun runtime and SQLite, so no package install or manifest change is needed. No `plugins` entry or other OpenCode configuration is normally required. The agent can be selected directly with the CLI:

```bash
opencode run --agent analyzer "Analyze agent behavior for the last 7 days."
```

Or start the interactive interface with Analyzer selected:

```bash
opencode mini --agent analyzer
```

Example questions:

```text
Analyze agent behavior for the last 7 days.
Find recurring failures for developer and propose a specific instruction change.
Compare model usage over the last month, noting where the tasks may not be comparable.
Check whether observed behavior changed after an instruction update.
```

### Data and privacy

The plugin creates its database on first load at:

```text
.opencode/plugins/analyzer/data.sqlite
```

The database and SQLite sidecar files are excluded from Git. The plugin uses OpenCode's bundled Bun runtime and built-in SQLite; it adds no package dependency, backend, external database, or package-manifest change. Collection is passive and local: it does not make its own network requests or LLM calls. Data is retained for up to 90 days, with caps of 10,000 sessions, 50,000 events, 25,000 rows per detail table, and 64 configuration versions. Pruned or incomplete history is reported. Plugin updates use schema migrations and preserve the database; setup does not reset or replace it.

Analyzer stores event IDs, timestamps, session/agent/model/tool identifiers, counters, available token and cost metrics, durations, categorized errors, compaction and delegation events, Skill activations, coarse test/build/lint command categories, safe configuration summaries, and configuration fingerprints. It does **not** store prompts, model responses, source contents, raw shell commands, raw tool arguments or outputs, MCP results, or raw error messages. Tool argument fingerprints represent argument structure, not exact values.

The agent receives data through three bounded, read-only tools: `analyzer_summary` for aggregates, `analyzer_patterns` for candidate behavior patterns, and `analyzer_details` for filtered event and configuration details. They do not expose SQL or data-mutation operations.

When Analyzer is run with a cloud model, the structured results returned by its read-only tools—and any project instructions or files the agent reads—may be included in the model context and sent to that provider. For confidential projects, use a local model and avoid including unnecessary project details in requests.

### Telemetry limits

OpenCode's public event stream is live-only: Analyzer does not backfill sessions from before installation, and a stream interruption can leave a gap. Token, cost, model, and context data are available only when OpenCode exposes them; missing values remain unknown. Context limits are model metadata and may be fallback values, not measured context consumption. Model-step duration is not provider HTTP latency, and OpenCode-reported cost is not necessarily the final provider invoice. An ended session or successful execution event does not prove the task itself succeeded. Analyzer reports these limits and does not recommend changes when the evidence is insufficient.

OpenCode also does not expose a reliable, distinct retry counter for every tool. Analyzer reports repeated calls and argument-shape patterns as observations, not as confirmed retries or proof that the same file or value was repeated. Tool-result sizes are estimates when OpenCode provides no size and are capped at 1 MiB for measurement. The plugin fingerprints project-local configuration files; it does not read or store global/system configuration file contents.

### Updating

On a later setup run, the prompt detects Analyzer's plugin and agent, previews changes, and applies the existing safe-update rules. User-edited files are not silently overwritten; declining an update preserves the current version. The SQLite database and history are never removed or recreated by setup.

## Hooks

Hooks are an optional OpenCode V2 plugin installed only after the setup prompt asks and the user answers Yes. The plugin, starter YAML, and event reference README live at `.opencode/plugins/hooks/`. Hooks are disabled in the starter config; add actions and set `enabled: true` to activate them. After changing `hooks.yml`, reload OpenCode with `/reload`.

The config is YAML and uses OpenCode V2 event names directly (for example, `session.idle`). Each event must contain a list of hook entries; hooks run sequentially in YAML order. Hooks can attach Skills, invoke registered OpenCode commands, and launch OpenCode agents in independent sessions. Hook reports are added to the triggering session without resuming it.

```yaml
hooks:
  session.idle:
    - enabled: true
      skills:
        - security-review
        - code-review
      prompt: Review the current changes and report findings.
```

`commands` contains registered OpenCode command names, not arbitrary shell commands. Agents use their normal OpenCode permissions. The plugin itself does not execute shell processes or add agent permissions. See [`templates/plugins/hooks/README.md`](templates/plugins/hooks/README.md) for supported events, multi-hook examples, and configuration details.
