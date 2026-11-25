import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import hooksPlugin, {
  createHookRuntimeState,
  enabledHookEvents,
  eventTypesForHooks,
  enqueueHooksForEvent,
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
  assert.throws(
    () => parseHooksYaml("hooks:\n  session.status:\n    - enabled: true\n      prompt: Unsupported on OpenCode 2.4.x.\n"),
    /Unsupported OpenCode V2 session event/,
  )
})

test("maps session.idle hooks to the emitted completion event on OpenCode 2.4.x", () => {
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      prompt: Ask the user how they are.
`)

  assert.deepEqual(eventTypesForHooks(config, "2.4.1"), [
    "session.execution.succeeded",
    "session.execution.failed",
    "session.execution.interrupted",
    "session.deleted",
  ])
  assert.ok(eventTypesForHooks(config, "2.5.0").includes("session.idle"))
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

test("parses literal and folded multiline prompts", () => {
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      prompt: |
        Review the current changes.
        List the important findings.
        Preserve #markers inside the prompt.

        Include the evidence.
    - enabled: true
      prompt: >
        Summarize the changes
        and report any risks.

        Keep the answer concise.
    - enabled: true
      prompt: >
        Start the report.
          Keep this indented line separate.
        Continue the report.
`)

  assert.equal(
    config.hooks["session.idle"][0].prompt,
    "Review the current changes.\nList the important findings.\nPreserve #markers inside the prompt.\n\nInclude the evidence.\n",
  )
  assert.equal(
    config.hooks["session.idle"][1].prompt,
    "Summarize the changes and report any risks.\n\nKeep the answer concise.\n",
  )
  assert.equal(
    config.hooks["session.idle"][2].prompt,
    "Start the report.\n  Keep this indented line separate.\nContinue the report.\n",
  )
})

test("rejects duplicate YAML mapping keys and unsupported block scalar options", () => {
  assert.throws(
    () => parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
  session.idle:
    - enabled: false
`),
    /Duplicate event key/,
  )
  assert.throws(
    () => parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      enabled: false
`),
    /Duplicate hook field/,
  )
  assert.throws(
    () => parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      prompt: |-
        This block indicator is outside the supported subset.
`),
    /Unsupported prompt block scalar indicator/,
  )
  assert.throws(
    () => parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      prompt: &shared text
`),
    /anchors, aliases, and tags are not supported/,
  )
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

test("hook actions run in the triggering session and keep agent mentions there", async () => {
  const calls = []
  const userMessages = []
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      skills: [security-review]
      agents: [reviewer]
      commands: [test]
      prompt: Review the current changes.
`)
  const state = createHookRuntimeState()
  const catalog = {
    agents: new Set(["reviewer"]),
    commands: new Set(["test"]),
    skills: new Set(["security-review"]),
  }
  const ctx = {
    app: { version: "2.4.1" },
    location: { directory: "/project" },
    session: {
      prompt: async (input) => {
        calls.push(["prompt", input])
        userMessages.push({ type: "user", metadata: input.metadata })
      },
      command: async (input) => calls.push(["command", input]),
      wait: async ({ sessionID }) => {
        calls.push(["wait", sessionID])
        const eventID = `generated-idle-${calls.filter(([type]) => type === "wait").length}`
        const generatedIdle = await enqueueHooksForEvent(
          ctx,
          config,
          { id: eventID, type: "session.execution.succeeded", data: { sessionID } },
          state,
          catalog,
        )
        assert.equal(generatedIdle, undefined)
      },
      context: async () => userMessages,
    },
  }

  await runHooksForEvent(
    ctx,
    config,
    { id: "event-1", type: "session.idle", data: { sessionID: "parent-session" } },
    state,
    catalog,
  )

  const command = calls.find(([type]) => type === "command")[1]
  assert.equal(command.sessionID, "parent-session")
  assert.equal(command.name, "test")
  assert.equal(command.text, "Review the current changes.")
  const prompt = calls.find(([type]) => type === "prompt")[1]
  assert.equal(prompt.sessionID, "parent-session")
  assert.deepEqual(prompt.skills, [{ id: "security-review" }])
  assert.deepEqual(prompt.agents, [{ name: "reviewer" }])
  assert.equal(prompt.text, "@reviewer\n\nReview the current changes.")
  assert.equal(prompt.metadata.opencodeSetupHooks.generated, true)
  assert.equal(calls.filter(([type]) => type === "prompt").length, 1)
  assert.equal(calls.some(([type]) => type === "create" || type === "synthetic"), false)
})

test("a prompt-only hook runs without Skills, commands, or configured agents", async () => {
  const calls = []
  const userMessages = []
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      prompt: Ask the user how they are.
  `)
  const state = createHookRuntimeState()
  const catalog = { agents: new Set(), commands: new Set(), skills: new Set() }
  const ctx = {
    app: { version: "2.4.1" },
    location: { directory: "/project" },
    session: {
      prompt: async (input) => {
        calls.push(["prompt", input])
        userMessages.push({ type: "user", metadata: input.metadata })
      },
      command: async () => assert.fail("prompt-only hook must not run a command"),
      wait: async ({ sessionID }) => {
        const generatedIdle = await enqueueHooksForEvent(
          ctx,
          config,
          { id: "hook-generated-success", type: "session.execution.succeeded", data: { sessionID } },
          state,
          catalog,
        )
        assert.equal(generatedIdle, undefined)
      },
      context: async () => userMessages,
    },
  }

  await runHooksForEvent(
    ctx,
    config,
    { id: "execution-event", type: "session.execution.succeeded", data: { sessionID: "parent-session" } },
    state,
    catalog,
  )

  const prompt = calls.find(([type]) => type === "prompt")[1]
  assert.equal(prompt.sessionID, "parent-session")
  assert.equal(prompt.text, "Ask the user how they are.")
  assert.equal(prompt.skills, undefined)
  assert.equal(prompt.metadata.opencodeSetupHooks.generated, true)
  assert.equal(calls.some(([type]) => type === "create" || type === "synthetic"), false)
})

test("skips hook-generated turns for every configured event type", async () => {
  let promptCount = 0
  const ctx = {
    location: { directory: "/project" },
    session: {
      context: async () => [{
        type: "user",
        metadata: {
          opencodeSetupHooks: {
            generated: true,
            event: "session.idle",
          },
        },
      }],
      prompt: async () => {
        promptCount += 1
      },
      command: async () => assert.fail("generated prompts must not dispatch commands"),
      wait: async () => {},
    },
  }
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      prompt: Ask the user a follow-up question.
  session.execution.succeeded:
    - enabled: true
      prompt: Ask the user another follow-up question.
`)

  const state = createHookRuntimeState()
  for (const [id, type] of [
    ["generated-idle", "session.idle"],
    ["generated-execution", "session.execution.succeeded"],
  ]) {
    const queued = await enqueueHooksForEvent(
      ctx,
      config,
      { id, type, data: { sessionID: "parent-session" } },
      state,
      { agents: new Set(["reviewer"]), commands: new Set(), skills: new Set() },
    )
    assert.equal(queued, undefined)
  }
  assert.equal(promptCount, 0)
})

test("plugin config and README remain YAML-only and document OpenCode V2 events", async () => {
  const yaml = await readFile(new URL("../templates/plugins/hooks/hooks.yml", import.meta.url), "utf8")
  const readme = await readFile(new URL("../templates/plugins/hooks/README.md", import.meta.url), "utf8")
  const setupPrompt = await readFile(new URL("../opencode-setup-prompt.md", import.meta.url), "utf8")
  const normalizedPrompt = setupPrompt.replace(/\s+/g, " ")
  assert.doesNotMatch(yaml, /^\s*\{/m)
  assert.match(yaml, /^hooks:/m)
  assert.match(readme, /session\.idle/)
  assert.match(readme, /Each event value must be a YAML list/i)
  assert.match(readme, /Entries run sequentially in the order listed/i)
  assert.match(readme, /registered OpenCode command names/i)
  assert.match(readme, /in the session that produced the\s+event/i)
  assert.match(readme, /assistant's response appears there/i)
  assert.match(readme, /prevent recursive hooks/i)
  assert.match(
    readme,
    /For OpenCode 2\.4\.x,\s*a `session\.idle` hook is dispatched from\s*`session\.execution\.succeeded`/i,
  )
  assert.match(readme, /A `prompt` can be the only field/i)
  assert.match(readme, /commands receive empty arguments/i)
  assert.match(readme, /strict YAML subset/i)
  assert.match(readme, /Duplicate event or hook-field\s+keys are errors/i)
  assert.match(readme, /literal `\|` or\s+folded `>` block style/i)
  assert.match(readme, /queued and run in arrival order/i)
  assert.match(readme, /refreshes the available Skills,\s*commands, and agents for each dispatched event/i)
  assert.match(readme, /waiting queue is bounded to 256 events\s+overall and 32 per session/i)
  assert.match(readme, /\|\s*Event\s*\|\s*When it occurs\s*\|/)
  assert.doesNotMatch(readme, /\bstop\b/)
  assert.match(setupPrompt, /Will you use the optional Hooks plugin/)
  assert.match(setupPrompt, /translate human-readable prose in all installed plugin files/i)
  assert.match(normalizedPrompt, /send a prompt as a normal turn in the triggering session/)
  assert.match(normalizedPrompt, /loop prevention for hook-generated turns/)
  assert.match(normalizedPrompt, /On OpenCode 2\.4\.x, `session\.idle` configuration is dispatched on `session\.execution\.succeeded`/)
  assert.match(normalizedPrompt, /no duplicate event or hook-field keys, no anchors\/aliases\/tags, and single-line or `\|`\/`>` prompts/i)
  assert.match(normalizedPrompt, /queues events in order per session, caps concurrent hook processing at four sessions/)
  assert.match(normalizedPrompt, /Refresh Skills, commands, and agents before each dispatched hook event/)
  assert.match(normalizedPrompt, /per-session event queuing\/backpressure, catalog refresh after additions\/removals/)
  for (const event of SUPPORTED_EVENT_TYPES) {
    assert.ok(readme.includes(`\`${event}\``), `README documents ${event}`)
  }
})

test("queue backpressure can be cancelled during plugin shutdown", async () => {
  const state = createHookRuntimeState()
  state.pendingCount = 256
  const controller = new AbortController()
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      prompt: Handle this event.
`)
  const ctx = {
    location: { directory: "/project" },
    session: {},
  }
  const waiting = enqueueHooksForEvent(
    ctx,
    config,
    { id: "backpressured-event", type: "session.idle", data: { sessionID: "parent-session" } },
    state,
    undefined,
    controller.signal,
  )
  controller.abort()

  assert.equal(await waiting, undefined)
  assert.equal(state.queueWaiters.length, 0)
  assert.equal(state.pendingCount, 256)
})

test("hooks plugin is an opt-in V2 plugin with a YAML config file", () => {
  assert.equal(hooksPlugin.id, "hooks")
  assert.equal(typeof hooksPlugin.setup, "function")
})

test("multiple hooks for one event run sequentially in YAML order", async () => {
  const calls = []
  const ctx = {
    location: { directory: "/project" },
    session: {
      prompt: async (input) => calls.push(`prompt:${input.text}`),
      command: async () => {},
      wait: async ({ sessionID }) => calls.push(`wait:${sessionID}`),
      context: async () => [],
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
  assert.deepEqual(promptTexts, ["First hook", "@reviewer\n\nSecond hook"])
  assert.deepEqual(
    calls.filter((call) => call.startsWith("wait:")),
    ["wait:parent-session", "wait:parent-session"],
  )
})

test("same-session events queue in order instead of being dropped while a hook is active", async () => {
  const calls = []
  let markFirstWait
  let releaseFirstWait
  let waitCount = 0
  const firstWaitStarted = new Promise((resolve) => {
    markFirstWait = resolve
  })
  const firstWaitGate = new Promise((resolve) => {
    releaseFirstWait = resolve
  })
  const ctx = {
    location: { directory: "/project" },
    session: {
      prompt: async ({ text }) => calls.push(`prompt:${text}`),
      command: async () => {},
      wait: async ({ sessionID }) => {
        calls.push(`wait:${sessionID}`)
        waitCount += 1
        if (waitCount === 1) {
          markFirstWait()
          await firstWaitGate
        }
      },
      context: async () => [],
    },
  }
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      prompt: Inspect this event.
`)
  const state = createHookRuntimeState()
  const firstRun = runHooksForEvent(
    ctx,
    config,
    { id: "queued-event-1", type: "session.idle", data: { sessionID: "parent-session" } },
    state,
    { agents: new Set(), commands: new Set(), skills: new Set() },
  )

  await firstWaitStarted
  const queued = await enqueueHooksForEvent(
    ctx,
    config,
    { id: "queued-event-2", type: "session.idle", data: { sessionID: "parent-session" } },
    state,
    { agents: new Set(), commands: new Set(), skills: new Set() },
  )
  assert.ok(queued)
  assert.equal(state.pendingCount, 1)

  releaseFirstWait()
  await Promise.all([firstRun, queued.done])
  assert.deepEqual(
    calls.filter((call) => call.startsWith("prompt:")),
    ["prompt:Inspect this event.", "prompt:Inspect this event."],
  )
  assert.deepEqual(
    calls.filter((call) => call.startsWith("wait:")),
    ["wait:parent-session", "wait:parent-session"],
  )
  assert.equal(state.seenEvents.has("queued-event-1"), true)
  assert.equal(state.seenEvents.has("queued-event-2"), true)
  assert.equal(state.pendingCount, 0)
  assert.equal(state.activeCount, 0)
})

test("refreshes Skills, commands, and agents for each dispatched event", async () => {
  let catalogAvailable = false
  let agentReads = 0
  let commandReads = 0
  let skillReads = 0
  const calls = []
  const ctx = {
    location: { directory: "/project" },
    agent: {
      list: async () => {
        agentReads += 1
        return { data: catalogAvailable ? [{ id: "reviewer" }] : [] }
      },
    },
    command: {
      list: async () => {
        commandReads += 1
        return { data: catalogAvailable ? [{ name: "test" }] : [] }
      },
    },
    skill: {
      list: async () => {
        skillReads += 1
        return { data: catalogAvailable ? [{ id: "manual-review" }] : [] }
      },
    },
    session: {
      prompt: async (input) => calls.push(["prompt", input]),
      command: async (input) => calls.push(["command", input]),
      wait: async () => {},
      context: async () => [],
    },
  }
  const config = parseHooksYaml(`
hooks:
  session.idle:
    - enabled: true
      skills: [manual-review]
      commands: [test]
      agents: [reviewer]
`)
  const state = createHookRuntimeState()

  await runHooksForEvent(
    ctx,
    config,
    { id: "catalog-event-1", type: "session.idle", data: { sessionID: "parent-session" } },
    state,
  )
  assert.equal(calls.length, 0)

  catalogAvailable = true
  await runHooksForEvent(
    ctx,
    config,
    { id: "catalog-event-2", type: "session.idle", data: { sessionID: "parent-session" } },
    state,
  )

  assert.equal(agentReads, 2)
  assert.equal(commandReads, 2)
  assert.equal(skillReads, 2)
  assert.equal(calls.find(([type]) => type === "command")[1].sessionID, "parent-session")
  assert.equal(calls.find(([type]) => type === "prompt")[1].sessionID, "parent-session")
  assert.deepEqual(calls.find(([type]) => type === "prompt")[1].agents, [{ name: "reviewer" }])
  assert.deepEqual(
    calls.find(([type]) => type === "prompt")[1].skills,
    [{ id: "manual-review" }],
  )
  assert.equal(calls.find(([type]) => type === "command")[1].name, "test")
})
