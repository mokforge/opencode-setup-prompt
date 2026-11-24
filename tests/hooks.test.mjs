import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import hooksPlugin, {
  createHookRuntimeState,
  enabledHookEvents,
  parseHooksYaml,
  runHooksForEvent,
  SUPPORTED_EVENT_TYPES,
} from "../templates/plugins/hooks/index.ts"

test("parses the hook-list YAML shape with a real OpenCode V2 event name", () => {
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      skills:
        - security-review
        - code-review
      prompt: Review the current changes and report findings.
`)

  assert.deepEqual(config.hooks["session.idle"], [{
    enabled: true,
    skills: ["security-review", "code-review"],
    commands: [],
    agents: [],
    prompt: "Review the current changes and report findings.",
  }])
  assert.deepEqual(enabledHookEvents(config), ["session.idle"])
  assert.throws(
    () => parseHooksYaml("hooks:\n  stop:\n    - enabled: true\n      skills: [security-review]\n"),
    /Unsupported OpenCode V2 session event/,
  )
})

test("supports multiple hooks for an event and OpenCode commands and agents", () => {
  const config = parseHooksYaml(`
hooks:
  session.execution.failed:
    - enabled: true
      skills: [security-review]
      prompt: "Check the failure: explain the likely cause."
    - enabled: true
      commands:
        - test
    - enabled: true
      agents:
        - reviewer
`)

  assert.equal(config.hooks["session.execution.failed"].length, 3)
  assert.deepEqual(config.hooks["session.execution.failed"][1].commands, ["test"])
  assert.deepEqual(config.hooks["session.execution.failed"][2].agents, ["reviewer"])
})

test("disables hooks with no actions and rejects unsupported events or fields", () => {
  const disabled = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      skills: []
`)
  assert.deepEqual(enabledHookEvents(disabled), [])
  assert.throws(
    () => parseHooksYaml("hooks:\n  session.idle:\n    enabled: true\n    skills: [security-review]\n"),
    /must contain a YAML list of hooks/,
  )

  assert.throws(
    () => parseHooksYaml("hooks:\n  tool.execute.before:\n    enabled: true\n"),
    /Unsupported OpenCode V2 session event/,
  )
  assert.throws(
    () => parseHooksYaml("hooks:\n  session.idle:\n    - enabled: true\n      shell: [echo]\n"),
    /Unknown hook field/,
  )
})

test("hook sessions use the configured OpenCode agent and return a synthetic report", async () => {
  const calls = []
  const ctx = {
    location: { directory: "/project" },
    session: {
      get: async () => ({
        id: "parent-session",
        agent: "tech-lead",
        location: { directory: "/project" },
      }),
      create: async (input) => {
        calls.push(["create", input])
        return { id: "hook-session" }
      },
      prompt: async (input) => calls.push(["prompt", input]),
      command: async (input) => calls.push(["command", input]),
      wait: async (input) => calls.push(["wait", input]),
      context: async () => [{
        info: { role: "assistant" },
        parts: [{ type: "text", text: "Review complete." }],
      }],
      synthetic: async (input) => calls.push(["synthetic", input]),
    },
  }
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      skills: [security-review]
      agents: [reviewer]
      commands: [test]
`)

  await runHooksForEvent(
    ctx,
    config,
    { id: "event-1", type: "session.idle", data: { sessionID: "parent-session" } },
    createHookRuntimeState(),
    {
      agents: new Set(["reviewer"]),
      commands: new Set(["test"]),
      skills: new Set(["security-review"]),
    },
  )

  const prompt = calls.find(([type]) => type === "prompt")[1]
  assert.equal(prompt.sessionID, "hook-session")
  assert.deepEqual(prompt.skills, [{ id: "security-review" }])
  assert.match(prompt.text, /Run the configured OpenCode hook/)
  const command = calls.find(([type]) => type === "command")[1]
  assert.equal(command.sessionID, "hook-session")
  assert.equal(command.name, "test")
  assert.equal(command.text, "")
  const report = calls.find(([type]) => type === "synthetic")[1]
  assert.equal(report.sessionID, "parent-session")
  assert.match(report.text, /Review complete\./)
  assert.equal(report.metadata.opencodeSetupHooks, true)
})

test("a prompt-only hook runs without Skills, commands, or configured agents", async () => {
  const calls = []
  const ctx = {
    location: { directory: "/project" },
    session: {
      get: async () => ({
        id: "parent-session",
        agent: "developer",
        location: { directory: "/project" },
      }),
      create: async (input) => {
        calls.push(["create", input])
        return { id: "prompt-only-session" }
      },
      prompt: async (input) => calls.push(["prompt", input]),
      command: async () => assert.fail("prompt-only hook must not run a command"),
      wait: async () => {},
      context: async () => [],
      synthetic: async () => {},
    },
  }
  const config = parseHooksYaml(`
hooks:
  session.execution.failed:
    - enabled: true
      prompt: Investigate the failed execution and report the likely cause.
`)

  await runHooksForEvent(
    ctx,
    config,
    {
      id: "failed-execution",
      type: "session.execution.failed",
      data: { sessionID: "parent-session" },
    },
    createHookRuntimeState(),
    { agents: new Set(), commands: new Set(), skills: new Set() },
  )

  const child = calls.find(([type]) => type === "create")[1]
  assert.equal(child.agent, "developer")
  const prompt = calls.find(([type]) => type === "prompt")[1]
  assert.equal(prompt.text, "Investigate the failed execution and report the likely cause.")
  assert.equal(prompt.skills, undefined)
})

test("does not run hook actions for its own report or generated session", async () => {
  let createCount = 0
  const ctx = {
    location: { directory: "/project" },
    session: {
      get: async () => ({ id: "parent-session", agent: "tech-lead" }),
      create: async () => {
        createCount += 1
        return { id: "hook-session" }
      },
      prompt: async () => {},
      command: async () => {},
      wait: async () => {},
      context: async () => [],
      synthetic: async () => {},
    },
  }
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      agents: [reviewer]
`)
  const state = createHookRuntimeState()
  state.generatedSessions.add("hook-session")

  await runHooksForEvent(
    ctx,
    config,
    {
      id: "generated-report",
      type: "session.idle",
      data: {
        sessionID: "parent-session",
        metadata: { opencodeSetupHooks: true },
      },
    },
    state,
    { agents: new Set(["reviewer"]), commands: new Set(), skills: new Set() },
  )
  await runHooksForEvent(
    ctx,
    config,
    { id: "generated-session", type: "session.idle", data: { sessionID: "hook-session" } },
    state,
    { agents: new Set(["reviewer"]), commands: new Set(), skills: new Set() },
  )

  assert.equal(createCount, 0)
})

test("plugin config and README remain YAML-only and document OpenCode V2 events", async () => {
  const yaml = await readFile(new URL("../templates/plugins/hooks/hooks.yml", import.meta.url), "utf8")
  const readme = await readFile(new URL("../templates/plugins/hooks/README.md", import.meta.url), "utf8")
  const setupPrompt = await readFile(new URL("../opencode-setup-prompt.md", import.meta.url), "utf8")
  assert.doesNotMatch(yaml, /^\s*\{/m)
  assert.match(yaml, /^hooks:/m)
  assert.match(readme, /session\.idle/)
  assert.match(readme, /Each event value must be a YAML list/i)
  assert.match(readme, /Entries run sequentially in the order listed/i)
  assert.match(readme, /registered OpenCode command names/i)
  assert.match(readme, /independent session/i)
  assert.match(readme, /A `prompt` can be the only field/i)
  assert.match(readme, /commands receive empty arguments/i)
  assert.match(readme, /\|\s*Event\s*\|\s*When it occurs\s*\|/)
  assert.doesNotMatch(readme, /\bstop\b/)
  assert.match(setupPrompt, /Will you use the optional Hooks plugin/)
  assert.match(setupPrompt, /translate human-readable prose in all installed plugin files/i)
  for (const event of SUPPORTED_EVENT_TYPES) {
    assert.ok(readme.includes(`\`${event}\``), `README documents ${event}`)
  }
})

test("hooks plugin is an opt-in V2 plugin with a YAML config file", () => {
  assert.equal(hooksPlugin.id, "hooks")
  assert.equal(typeof hooksPlugin.setup, "function")
})

test("multiple hooks for one event run sequentially in YAML order", async () => {
  const calls = []
  let childIndex = 0
  const ctx = {
    location: { directory: "/project" },
    session: {
      get: async () => ({
        id: "parent-session",
        agent: "tech-lead",
        location: { directory: "/project" },
      }),
      create: async (input) => {
        calls.push(`create:${input.title}`)
        childIndex += 1
        return { id: `hook-session-${childIndex}` }
      },
      prompt: async (input) => calls.push(`prompt:${input.text}`),
      command: async () => {},
      wait: async ({ sessionID }) => calls.push(`wait:${sessionID}`),
      context: async () => [],
      synthetic: async ({ text }) => calls.push(`report:${text.split("\n")[0]}`),
    },
  }
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      skills: [security-review]
      prompt: First hook
    - enabled: true
      agents: [reviewer]
      prompt: Second hook
`)

  await runHooksForEvent(
    ctx,
    config,
    { id: "event-order", type: "session.idle", data: { sessionID: "parent-session" } },
    createHookRuntimeState(),
    {
      agents: new Set(["reviewer"]),
      commands: new Set(),
      skills: new Set(["security-review"]),
    },
  )

  const promptTexts = calls
    .filter((call) => call.startsWith("prompt:"))
    .map((call) => call.slice("prompt:".length))
  assert.deepEqual(promptTexts, ["First hook", "Second hook"])
  assert.ok(calls.indexOf("report:OpenCode hook `session.idle` completed in session `hook-session-1`.") <
    calls.indexOf("create:[Hooks] session.idle · reviewer"))
})
