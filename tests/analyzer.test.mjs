import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { DatabaseSync } from "node:sqlite"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  argumentFingerprint,
  captureConfigSnapshot,
  createAnalyzerStore,
  createAnalyzerToolDefinitions,
  getAnalyzerDatabasePath,
  normalizeAnalyzerFilters,
  normalizeEvent,
} from "../templates/plugins/analyzer/index.ts"

const PROJECT_ID = "test-project"
const RANGE = { period_days: 7, from: 0, to: 10_000 }
const DIAGNOSTICS = {
  database: "ready",
  capture: "healthy",
  lostEvents: 0,
  lastErrorCategory: null,
  walEnabled: true,
  startedAt: 1,
  historyTruncated: false,
}

function rawEvent(type, id, created, data = {}) {
  return { id, created, type, data }
}

function save(store, event, mcpServers) {
  const normalized = normalizeEvent(event, mcpServers)
  assert.ok(normalized, `Expected ${event.type} to be normalized`)
  return store.recordEvent(normalized, null)
}

function memoryStore(t, clock = () => 10_000, mcpServers = []) {
  const db = new DatabaseSync(":memory:")
  db.exec("PRAGMA foreign_keys = ON")
  const store = createAnalyzerStore(db, PROJECT_ID, clock, () => mcpServers)
  t.after(() => db.close())
  return { db, store }
}

function startSession(store, sessionId = "session-1", agent = "developer") {
  save(
    store,
    rawEvent("session.created", `${sessionId}-created`, 1_000, {
      sessionID: sessionId,
      projectID: PROJECT_ID,
      agent,
      model: { providerID: "local", id: "coder" },
    }),
  )
}

test("database location is relative to the installed plugin file", () => {
  const expected = fileURLToPath(
    new URL("../templates/plugins/analyzer/data.sqlite", import.meta.url),
  )
  assert.equal(getAnalyzerDatabasePath(), expected)
})

test("normalization keeps only safe metrics and marks missing values unknown", () => {
  const tool = normalizeEvent(
    rawEvent("session.tool.called", "tool-event", 1_000, {
      sessionID: "session-1",
      assistantMessageID: "message-1",
      id: "call-1",
      input: {
        api_key: "secret-marker",
        path: "/private/source.ts",
      },
      executed: true,
    }),
  )
  assert.ok(tool)
  assert.equal(tool.details.inputBytes > 0, true)
  assert.equal(typeof tool.details.argsFingerprint, "string")
  assert.doesNotMatch(JSON.stringify(tool), /secret-marker|private\/source\.ts/)

  const failure = normalizeEvent(
    rawEvent("session.step.failed", "failed-step", 1_100, {
      sessionID: "session-1",
      assistantMessageID: "message-1",
      error: { type: "provider.error", message: "secret-marker" },
    }),
  )
  assert.ok(failure)
  assert.equal(failure.errorCategory, "provider")
  assert.equal(failure.inputTokens, null)
  assert.equal(failure.outputTokens, null)
  assert.doesNotMatch(JSON.stringify(failure), /secret-marker/)

  const content = normalizeEvent(
    rawEvent("session.message.content.updated", "content-event", 1_200, {
      sessionID: "session-1",
      messageID: "message-1",
      content: [
        { type: "text", text: "secret-marker" },
        {
          type: "tool",
          id: "call-1",
          name: "read",
          state: {
            status: "running",
            input: { path: "secret-marker" },
            metadata: { output: "secret-marker" },
          },
        },
      ],
    }),
  )
  assert.ok(content)
  assert.deepEqual(content.details.tools[0].name, "read")
  assert.doesNotMatch(JSON.stringify(content), /secret-marker/)

  const skill = normalizeEvent(
    rawEvent("session.skill.activated", "skill-event", 1_300, {
      sessionID: "session-1",
      id: "private-skill",
      name: "Private Skill",
      text: "secret-marker",
    }),
  )
  assert.ok(skill)
  assert.doesNotMatch(JSON.stringify(skill), /secret-marker/)
})

test("migrations are repeatable and model metrics are not double-counted", (t) => {
  const { db, store } = memoryStore(t)
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 1)
  createAnalyzerStore(db, PROJECT_ID, () => 10_000)

  startSession(store)
  save(store, rawEvent("session.execution.started", "execution-start", 1_100, {
    sessionID: "session-1",
  }))
  save(store, rawEvent("session.step.started", "step-start-1", 1_200, {
    sessionID: "session-1",
    assistantMessageID: "message-1",
    agent: "developer",
    model: { providerID: "local", id: "coder" },
    started: 1_200,
  }))
  const completed = rawEvent("session.step.ended", "step-end-1", 1_400, {
    sessionID: "session-1",
    assistantMessageID: "message-1",
    finish: "stop",
    cost: 0.1,
    tokens: {
      input: 10,
      output: 2,
      reasoning: 0,
      cache: { read: 1, write: 0 },
    },
  })
  assert.equal(save(store, completed), true)
  assert.equal(save(store, completed), false)
  save(store, { ...completed, id: "step-end-duplicate-delivery" })

  save(store, rawEvent("session.step.started", "step-start-2", 1_500, {
    sessionID: "session-1",
    assistantMessageID: "message-2",
    agent: "developer",
    model: { providerID: "local", id: "coder" },
    started: 1_500,
  }))
  save(store, rawEvent("session.step.ended", "step-end-2", 1_600, {
    sessionID: "session-1",
    assistantMessageID: "message-2",
    finish: "stop",
  }))
  save(store, rawEvent("session.usage.recorded", "usage-generate", 1_650, {
    sessionID: "session-1",
    source: "generate",
    cost: 0.02,
    tokens: {
      input: 4,
      output: 1,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  }))
  save(store, rawEvent("session.usage.updated", "usage-total", 1_660, {
    sessionID: "session-1",
    cost: 500,
    tokens: {
      input: 999,
      output: 999,
      reasoning: 999,
      cache: { read: 999, write: 999 },
    },
  }))

  const retry = rawEvent("session.retry.scheduled", "retry-1", 1_670, {
    sessionID: "session-1",
    assistantMessageID: "message-1",
    attempt: 2,
    error: { type: "provider.timeout", message: "private error detail" },
  })
  save(store, retry)
  save(store, retry)
  save(store, rawEvent("session.execution.succeeded", "execution-end", 1_800, {
    sessionID: "session-1",
  }))

  const refreshedStore = createAnalyzerStore(db, PROJECT_ID, () => 10_000)
  assert.equal(refreshedStore.summary(RANGE, DIAGNOSTICS).requests.count, 3)
  const summary = store.summary(RANGE, DIAGNOSTICS)
  assert.equal(summary.sessions.count, 1)
  assert.equal(summary.sessions.messages, 2)
  assert.equal(summary.sessions.byStatus[0].status, "idle")
  assert.equal(summary.sessions.observedActiveMs, 700)
  assert.equal(summary.requests.count, 3)
  assert.equal(summary.requests.retries, 1)
  assert.deepEqual(summary.requests.metrics.input, {
    observedTotal: 14,
    observedRequests: 2,
    totalRequests: 3,
  })
  assert.equal(summary.requests.metrics.durationMs.observedRequests, 2)

  const modelDetails = store.details({
    ...RANGE,
    kind: "model",
    id: "local/coder",
  })
  assert.equal(modelDetails.provider, "local")
  assert.equal(modelDetails.model, "coder")
  assert.equal(modelDetails.requests.length, 2)

  const detail = store.details({ ...RANGE, kind: "session", id: "session-1" })
  assert.equal(detail.session.status, "idle")
  assert.ok(detail.events.every((event) => event.sessionId === "session-1"))
  assert.doesNotMatch(JSON.stringify(detail), /private error detail/)
})

test("a database from a newer schema version is preserved", (t) => {
  const db = new DatabaseSync(":memory:")
  t.after(() => db.close())
  db.exec("PRAGMA user_version = 2")
  assert.throws(() => createAnalyzerStore(db, PROJECT_ID), /database_schema_newer/)
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 2)
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'sessions'")
      .get().count,
    0,
  )
})

test("tool calls are deduplicated, summarized, and never persist raw arguments or results", (t) => {
  const { db, store } = memoryStore(t)
  startSession(store)
  save(store, rawEvent("session.step.started", "start-read", 1_100, {
    sessionID: "session-1",
    assistantMessageID: "message-1",
    agent: "developer",
    model: { providerID: "local", id: "coder" },
    started: 1_100,
  }))
  save(store, rawEvent("session.message.content.updated", "tool-name", 1_150, {
    sessionID: "session-1",
    messageID: "message-1",
    content: [{
      type: "tool",
      id: "call-1",
      name: "read",
      executed: true,
      state: { status: "running", input: { path: "private-marker" }, metadata: {} },
    }],
  }))
  const called = rawEvent("session.tool.called", "tool-called", 1_200, {
    sessionID: "session-1",
    assistantMessageID: "message-1",
    id: "call-1",
    input: { path: "private-marker", token: "secret-marker" },
    executed: true,
  })
  assert.equal(save(store, called), true)
  assert.equal(save(store, called), false)
  save(store, rawEvent("session.tool.success", "tool-success", 1_300, {
    sessionID: "session-1",
    assistantMessageID: "message-1",
    id: "call-1",
    content: [{ type: "text", text: "private-result-marker" }],
    executed: true,
  }))

  const summary = store.summary(RANGE, DIAGNOSTICS)
  assert.equal(summary.sessions.toolCalls, 1)
  assert.equal(summary.tools[0].name, "read")
  assert.equal(summary.tools[0].calls, 1)
  assert.equal(summary.tools[0].succeeded, 1)

  const tables = [
    "metadata",
    "config_versions",
    "sessions",
    "agent_runs",
    "model_requests",
    "tool_calls",
    "events",
  ]
  const serialized = JSON.stringify(
    tables.map((table) => db.prepare(`SELECT * FROM ${table}`).all()),
  )
  assert.doesNotMatch(serialized, /private-marker|secret-marker|private-result-marker/)
  assert.doesNotMatch(JSON.stringify(store.details({ ...RANGE, kind: "tool", id: "read" })), /marker/)
})

test("patterns aggregate repeated shapes, cycles, errors, compaction, and delegation", (t) => {
  const { store } = memoryStore(t)
  startSession(store)
  const sequence = ["read", "grep", "read", "grep", "read"]
  sequence.forEach((name, index) => {
    const messageId = `message-${index}`
    const callId = `call-${index}`
    const at = 1_100 + index * 100
    save(store, rawEvent("session.step.started", `step-${index}`, at, {
      sessionID: "session-1",
      assistantMessageID: messageId,
      agent: "developer",
      model: { providerID: "local", id: "coder" },
      started: at,
    }))
    save(store, rawEvent("session.message.content.updated", `content-${index}`, at + 1, {
      sessionID: "session-1",
      messageID: messageId,
      content: [{
        type: "tool",
        id: callId,
        name,
        executed: true,
        state: { status: "running", input: {}, metadata: {} },
      }],
    }))
    save(store, rawEvent("session.tool.called", `called-${index}`, at + 2, {
      sessionID: "session-1",
      assistantMessageID: messageId,
      id: callId,
      input: { path: `/src/${index}` },
      executed: true,
    }))
    const failed = name === "grep" ? "session.tool.failed" : "session.tool.success"
    save(store, rawEvent(failed, `finished-${index}`, at + 50, {
      sessionID: "session-1",
      assistantMessageID: messageId,
      id: callId,
      content: [{ type: "text", text: "not persisted" }],
      executed: true,
      ...(failed === "session.tool.failed"
        ? { error: { type: "permission.denied", message: "not persisted" } }
        : {}),
    }))
  })
  save(store, rawEvent("session.compaction.started", "compact-1", 1_700, {
    sessionID: "session-1",
    reason: "auto",
  }))
  save(store, rawEvent("session.skill.activated", "skill-activation", 1_650, {
    sessionID: "session-1",
    id: "python-skills",
    name: "Python",
    text: "skill-content-secret",
  }))
  save(store, rawEvent("session.shell.started", "test-command", 1_675, {
    sessionID: "session-1",
    shell: { command: "npm run test -- token=command-secret", cwd: "/private/project" },
  }))
  save(store, rawEvent("session.compaction.started", "compact-2", 1_800, {
    sessionID: "session-1",
    reason: "auto",
  }))
  save(store, rawEvent("session.created", "child-session", 1_900, {
    sessionID: "child-1",
    projectID: PROJECT_ID,
    parentID: "session-1",
    agent: "reviewer",
  }))

  const patterns = store.patterns(RANGE)
  const summary = store.summary(RANGE, DIAGNOSTICS)
  assert.ok(patterns.repeatedArgumentShapes.some((item) => item.tool === "read" && item.occurrences === 3))
  assert.ok(patterns.possibleCycles.some((item) => item.sequence.join(",") === "read,grep,read"))
  assert.ok(patterns.repeatedFailures.some((item) => item.category === "permission"))
  assert.equal(patterns.frequentCompaction[0].occurrences, 2)
  assert.equal(patterns.repeatedDelegation.length, 0)
  assert.equal(summary.skills[0].id, "python-skills")
  assert.equal(summary.checks[0].category, "test")
  assert.doesNotMatch(
    JSON.stringify(store.details({ ...RANGE, kind: "session", id: "session-1" })),
    /skill-content-secret|command-secret|private\/project/,
  )

  save(store, rawEvent("session.created", "child-session-2", 1_950, {
    sessionID: "child-2",
    projectID: PROJECT_ID,
    parentID: "session-1",
    agent: "reviewer",
  }))
  const afterDelegation = store.patterns(RANGE)
  assert.equal(afterDelegation.repeatedDelegation[0].childSessions, 2)
})

test("Analyzer diagnostic sessions and their descendants are excluded from normal metrics", (t) => {
  const { store } = memoryStore(t)
  startSession(store, "analyzer-session", "analyzer")
  save(store, rawEvent("session.step.started", "analyzer-step", 1_100, {
    sessionID: "analyzer-session",
    assistantMessageID: "analyzer-message",
    agent: "analyzer",
    model: { providerID: "local", id: "coder" },
    started: 1_100,
  }))
  save(store, rawEvent("session.step.ended", "analyzer-step-end", 1_200, {
    sessionID: "analyzer-session",
    assistantMessageID: "analyzer-message",
    finish: "stop",
    cost: 1,
    tokens: {
      input: 100,
      output: 100,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  }))
  save(store, rawEvent("session.forked", "analyzer-fork", 1_300, {
    sessionID: "analyzer-child",
    parentID: "analyzer-session",
    boundary: { type: "tool" },
  }))
  save(store, rawEvent("session.step.started", "child-step", 1_400, {
    sessionID: "analyzer-child",
    assistantMessageID: "child-message",
    agent: "reviewer",
    model: { providerID: "local", id: "coder" },
    started: 1_400,
  }))

  const summary = store.summary(RANGE, DIAGNOSTICS)
  assert.equal(summary.sessions.count, 0)
  assert.equal(summary.requests.count, 0)
  assert.deepEqual(summary.tools, [])

  const detail = store.details({ ...RANGE, kind: "session", id: "analyzer-session" })
  assert.equal(detail.session.diagnostic, true)
})

test("configuration snapshots store safe metadata and fingerprints only", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "analyzer-config-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, ".opencode", "agents"), { recursive: true })
  await mkdir(join(directory, ".opencode", "skills", "private-skill"), { recursive: true })
  await mkdir(join(directory, ".opencode", "plugins", "hooks"), { recursive: true })
  await writeFile(
    join(directory, ".opencode", "opencode.jsonc"),
    `{
      // Public model selection and context settings are safe to summarize.
      "apiKey": "database-secret-marker",
      "default_agent": "tech-lead",
      "model": "local/coder#high",
      "compaction": {
        "auto": true,
        "buffer": "15%",
        "keep": { "tokens": 15000, },
      },
      "permissions": [
        { "action": "shell", "resource": "secret-command-marker", "effect": "ask", },
      ],
      "providers": {
        "local": {
          "settings": { "apiKey": "provider-secret-marker", "temperature": 0.3 },
          "models": {
            "coder": {
              "limit": { "context": 32000, "output": 8000 },
              "settings": { "apiKey": "model-secret-marker", "reasoningEffort": "high" },
            },
          },
        },
      },
      "mcp": {
        "servers": {
          "private-mcp": {
            "type": "remote",
            "url": "https://private.example",
            "headers": { "Authorization": "mcp-secret-marker" },
          },
        },
      },
      "plugins": ["private-plugin-source"],
      "skills": ["https://private-skill.example"],
      "instructions": ["private-instruction-path"],
    }`,
  )
  await writeFile(
    join(directory, ".opencode", "agents", "developer.md"),
    "instruction-secret-marker",
  )
  const hooksConfigPath = join(directory, ".opencode", "plugins", "hooks", "hooks.yml")
  await writeFile(
    hooksConfigPath,
    `hooks:\n  session.idle:\n    - enabled: true\n      prompt: "hooks-prompt-secret-marker"\n`,
  )

  const context = {
    app: { version: "2.4.0" },
    agent: {
      list: async () => ({
        data: [{
          id: "developer",
          mode: "subagent",
          system: "instruction-secret-marker",
          permissions: [{ action: "read", resource: "private-path-marker", effect: "allow" }],
        }],
      }),
    },
    model: {
      list: async () => ({
        data: [{
          id: "coder",
          providerID: "local",
          limit: { context: 32_000, output: 8_000 },
          settings: { apiKey: "model-secret-marker", temperature: 0.2 },
        }],
      }),
      default: async () => ({ data: { id: "coder", providerID: "local" } }),
    },
    skill: {
      list: async () => ({
        data: [{
          id: "private-skill",
          content: "skill-secret-marker",
        }],
      }),
    },
    mcp: {
      list: async () => ({
        data: [{
          name: "private-mcp",
          status: { status: "connected", token: "mcp-secret-marker" },
          url: "https://private.example",
        }],
      }),
    },
    plugin: {
      list: async () => ({
        data: [{
          id: "private-plugin",
          state: { status: "active" },
          source: "private-source-marker",
        }],
      }),
    },
  }

  const snapshot = await captureConfigSnapshot(context, PROJECT_ID, directory)
  const output = JSON.stringify(snapshot)
  assert.match(output, /local/)
  assert.match(output, /32000/)
  assert.match(output, /temperature/)
  assert.match(output, /0\.2/)
  assert.match(output, /private-mcp/)
  assert.doesNotMatch(
    output,
    /database-secret-marker|instruction-secret-marker|private-path-marker|model-secret-marker|skill-secret-marker|mcp-secret-marker|private\.example|private-source-marker|hooks-prompt-secret-marker/,
  )
  assert.ok(snapshot.files.some((file) => file.path === ".opencode/opencode.jsonc"))
  const hooksFile = snapshot.files.find((file) => file.path === ".opencode/plugins/hooks/hooks.yml")
  assert.ok(hooksFile)
  assert.ok(snapshot.files.every((file) => /^[a-f0-9]{64}$/.test(file.hash)))
  const configFile = snapshot.files.find((file) => file.path === ".opencode/opencode.jsonc")
  assert.equal(configFile.settings.defaultAgent, "tech-lead")
  assert.equal(configFile.settings.model.id, "coder")
  assert.equal(configFile.settings.model.variant, "high")
  assert.equal(configFile.settings.compaction.keepTokens, 15000)
  assert.equal(configFile.settings.permissions.actionEffects["shell:ask"], 1)
  assert.equal(configFile.settings.providerModels[0].generation.temperature, 0.3)

  const { db, store } = memoryStore(t, () => Date.now())
  const id = store.recordConfig(snapshot)
  assert.equal(store.recordConfig(snapshot), id)
  const detail = store.details({
    kind: "config",
    id: String(id),
    from: 0,
    to: Date.now(),
  })
  assert.equal(detail.versions.length, 1)
  assert.doesNotMatch(
    JSON.stringify(detail),
    /database-secret-marker|provider-secret-marker|model-secret-marker|secret-command-marker|mcp-secret-marker|private\.example|private-plugin-source|private-skill\.example|private-instruction-path/,
  )
  const saved = db.prepare("SELECT * FROM config_versions").all()
  assert.doesNotMatch(
    JSON.stringify(saved),
    /database-secret-marker|provider-secret-marker|model-secret-marker|secret-command-marker|mcp-secret-marker|private\.example|private-plugin-source|private-skill\.example|private-instruction-path|instruction-secret-marker|hooks-prompt-secret-marker/,
  )

  await writeFile(
    hooksConfigPath,
    `hooks:\n  session.idle:\n    - enabled: true\n      prompt: "a different private prompt"\n`,
  )
  const changedHooksSnapshot = await captureConfigSnapshot(context, PROJECT_ID, directory)
  const changedHooksFile = changedHooksSnapshot.files.find(
    (file) => file.path === ".opencode/plugins/hooks/hooks.yml",
  )
  assert.ok(changedHooksFile)
  assert.notEqual(changedHooksFile.hash, hooksFile.hash)
  assert.notEqual(changedHooksSnapshot.fingerprint, snapshot.fingerprint)
  assert.doesNotMatch(JSON.stringify(changedHooksSnapshot), /a different private prompt/)
})

test("empty database returns bounded empty results and unknown metrics", (t) => {
  const { store } = memoryStore(t)
  const summary = store.summary(RANGE, DIAGNOSTICS)
  assert.equal(summary.sessions.count, 0)
  assert.equal(summary.requests.count, 0)
  assert.equal(summary.requests.metrics.input.observedTotal, null)
  assert.equal(summary.requests.metrics.input.observedRequests, 0)
  assert.deepEqual(summary.tools, [])
  assert.deepEqual(summary.errors, [])
  assert.deepEqual(store.patterns(RANGE).possibleCycles, [])
  assert.deepEqual(store.details({ ...RANGE, kind: "session", id: "missing" }).events, [])
})

test("retention prunes old rows and reports truncated history", (t) => {
  const now = 1_000_000_000_000
  const { db, store } = memoryStore(t, () => now)
  const old = now - 100 * 24 * 60 * 60 * 1000
  save(store, rawEvent("session.created", "old-session", old, {
    sessionID: "old-session",
    projectID: PROJECT_ID,
    agent: "developer",
  }))
  save(store, rawEvent("session.execution.started", "old-event", old + 1, {
    sessionID: "old-session",
  }))

  store.prune(now)
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count, 0)
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM events").get().count, 0)
  assert.equal(store.getStatus().historyTruncated, true)
})

test("registered Analyzer tools are bounded, read-only, and agent-scoped", async (t) => {
  const { store, db } = memoryStore(t)
  startSession(store)
  const tools = createAnalyzerToolDefinitions(() => store, DIAGNOSTICS, () => {})
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["summary", "patterns", "details"],
  )
  for (const tool of tools) {
    assert.equal(tool.options.namespace, "analyzer")
    assert.equal(tool.options.codemode, false)
    assert.equal(tool.input.additionalProperties, false)
  }

  const before = db.prepare("SELECT COUNT(*) AS count FROM events").get().count
  const denied = await tools[0].execute(RANGE, { agent: "developer" })
  assert.equal(JSON.parse(denied.content).error, "analyzer_agent_only")
  const empty = await tools[0].execute(RANGE, { agent: "analyzer" })
  assert.equal(JSON.parse(empty.content).sessions.count, 1)
  const detail = await tools[2].execute(
    { ...RANGE, kind: "session", id: "session-1" },
    { agent: "analyzer" },
  )
  assert.equal(JSON.parse(detail.content).session.sessionId, "session-1")
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM events").get().count, before)

  const unavailable = createAnalyzerToolDefinitions(() => null, {
    ...DIAGNOSTICS,
    database: "unavailable",
  }, () => {})
  const result = await unavailable[0].execute(RANGE, { agent: "analyzer" })
  assert.equal(JSON.parse(result.content).error, "analyzer_database_unavailable")
})

test("filters are clamped and result limits are bounded", () => {
  const filters = normalizeAnalyzerFilters(
    {
      period_days: 100_000,
      from: 10_000,
      to: 100_000,
      limit: 10_000,
      agent: "developer",
    },
    20_000,
  )
  assert.equal(filters.periodDays, 365)
  assert.equal(filters.from, 10_000)
  assert.equal(filters.to, 20_000)
  assert.equal(filters.limit, 100)
  assert.equal(filters.agent, "developer")
})

test("concurrent Node processes can migrate and write to one WAL database", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "analyzer-concurrency-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const databasePath = join(directory, "data.sqlite")
  const setup = new DatabaseSync(databasePath)
  setup.exec("PRAGMA busy_timeout = 2500")
  setup.exec("PRAGMA journal_mode = WAL")
  setup.exec("PRAGMA foreign_keys = ON")
  createAnalyzerStore(setup, PROJECT_ID)
  setup.close()

  const analyzerUrl = import.meta.resolve("../templates/plugins/analyzer/index.ts")
  const childSource = `
    import { DatabaseSync } from "node:sqlite";
    const plugin = await import(${JSON.stringify(analyzerUrl)});
    const db = new DatabaseSync(process.argv[1]);
    db.exec("PRAGMA busy_timeout = 2500");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    const store = plugin.createAnalyzerStore(db, ${JSON.stringify(PROJECT_ID)});
    for (let i = 0; i < 40; i++) {
      const event = plugin.normalizeEvent({
        id: process.argv[2] + "-" + i,
        created: Date.now() + i,
        type: "config.updated",
        data: {},
      });
      store.recordEvent(event, null);
    }
    db.close();
  `

  function runWriter(label) {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--experimental-strip-types", "--input-type=module", "-e", childSource, databasePath, label],
        { env: { ...process.env, NODE_NO_WARNINGS: "1" }, stdio: "ignore" },
      )
      child.once("error", reject)
      child.once("exit", (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Analyzer test writer exited with ${code}`))
      })
    })
  }

  await Promise.all([runWriter("writer-a"), runWriter("writer-b")])
  const result = new DatabaseSync(databasePath)
  assert.equal(result.prepare("SELECT COUNT(*) AS count FROM events").get().count, 80)
  result.close()
})

test("setup prompt and README keep Analyzer complete, opt-in, and paired", async () => {
  const prompt = await readFile(new URL("../opencode-setup-prompt.md", import.meta.url), "utf8")
  const normalizedPrompt = prompt.replace(/\s+/g, " ")
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8")
  const ignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8")
  const agent = await readFile(new URL("../templates/agents/analyzer.md", import.meta.url), "utf8")
  const normalizedAgent = agent.replace(/\s+/g, " ")
  const plugin = await readFile(new URL("../templates/plugins/analyzer/index.ts", import.meta.url), "utf8")
  const techLead = await readFile(new URL("../templates/agents/tech-lead.md", import.meta.url), "utf8")
  assert.match(normalizedPrompt, /Analyzer is separate from Skills/i)
  assert.match(normalizedPrompt, /available in both modes/i)
  assert.match(normalizedPrompt, /do not install it by default/i)
  assert.match(normalizedPrompt, /only when the current request explicitly asks for it/i)
  assert.match(normalizedPrompt, /do not infer consent from any Skills choice/i)
  assert.match(normalizedPrompt, /One explicit Yes to installing Analyzer authorizes installing both files/i)
  assert.match(normalizedPrompt, /only dependencies explicitly required by the approved Analyzer source if any/i)
  assert.match(normalizedPrompt, /do not ask separately about the agent, permission, or these component dependencies/i)
  assert.match(normalizedPrompt, /current template has no third-party package dependencies/i)
  assert.match(normalizedPrompt, /exact project-local manifest, lockfile, and dependency-installation artifacts are also allowed/i)
  assert.match(normalizedPrompt, /The current `templates\/plugins\/analyzer\/index\.ts` uses Node built-ins and OpenCode's bundled Bun `bun:sqlite`/)
  assert.match(normalizedPrompt, /Do not run a package manager, create\/change a package manifest or lockfile, or add a dependency for this template/i)
  assert.match(normalizedPrompt, /If the user chooses No.*do not create the plugin, agent/i)
  assert.match(normalizedPrompt, /recommend only OpenCode harness changes/i)
  assert.match(normalizedPrompt, /restore only the missing part of a partial installation/i)
  assert.match(normalizedPrompt, /preserve it and report the skipped change/i)
  assert.match(normalizedPrompt, /Make installation and updates idempotent/i)
  assert.match(normalizedPrompt, /Analyzer is not `default_agent`/i)
  assert.match(normalizedPrompt, /Do not add a `plugins` entry to `opencode\.json\(c\)`/i)
  assert.match(normalizedPrompt, /No agent commits or pushes unless the current user request explicitly authorizes it/i)
  assert.match(normalizedPrompt, /the tech-lead's `git commit` permission is `ask`/i)
  assert.match(normalizedPrompt, /auto-discovers local plugin directories with `index\.ts`/)
  assert.match(normalizedPrompt, /opencode debug agents --help.*opencode run --help.*opencode debug agents.*lists `analyzer`/i)
  assert.match(normalizedPrompt, /opencode run --log-level warn --standalone --archived --agent analyzer --model invalid\/none/)
  assert.match(normalizedPrompt, /do not substitute a real model call.*setup as incomplete/i)
  assert.match(normalizedPrompt, /\{ action: "subagent", resource: "analyzer", effect: "allow" \}` only to the generated `tech-lead\.md` permissions/i)
  assert.match(normalizedPrompt, /only on the user's explicit request/i)
  assert.match(normalizedPrompt, /mark Analyzer installation incomplete/i)
  assert.match(normalizedPrompt, /preserve and report any pre-existing component the user chose to keep/i)
  assert.match(prompt, /never inspect its contents, copy, delete, reset, or replace it/)
  assert.match(prompt, /A refusal preserves the current files and version/i)
  assert.match(ignore, /^\.opencode\/plugins\/analyzer\/data\.sqlite$/m)
  assert.match(ignore, /^\.opencode\/plugins\/analyzer\/data\.sqlite-\*$/m)
  assert.match(agent, /^mode: all$/m)
  assert.match(agent, /action: skill\s+resource: "\*"\s+effect: allow/)
  assert.match(agent, /analyzer_summary/)
  assert.match(agent, /do not apply the change/i)
  assert.match(normalizedAgent, /Never suggest or generate an application-code patch/i)
  assert.doesNotMatch(agent, /action: read\s+resource: "\*"\s+effect: allow/)
  assert.doesNotMatch(agent, /action: glob\s+resource: "\*"\s+effect: allow/)
  assert.match(normalizedAgent, /selected directly as the primary agent and run without `tech-lead`/)
  assert.match(readme, /run without `tech-lead`/)
  assert.match(readme, /no package install or manifest change is needed/i)
  assert.match(normalizedPrompt, /can run directly without `tech-lead`/)
  assert.match(techLead, /Never create a commit or ask a subagent to commit unless the current user request explicitly authorizes it/)
  assert.match(techLead, /If it is installed and the current user explicitly asks for statistical analysis through you, you may invoke `analyzer` as a subagent/)
  assert.match(techLead, /resource: "\*git \*commit\*"\s+effect: ask/)
  assert.doesNotMatch(techLead, /resource: "analyzer"/)
  assert.match(plugin, /new URL\("\.\/data\.sqlite", import\.meta\.url\)/)
  assert.match(plugin, /import\("bun:sqlite"\)/)
  assert.doesNotMatch(plugin, /\b(?:from|import\()\s*["'](?!node:|bun:)[^"']+["']/)
  assert.match(plugin, /export function createAnalyzerToolDefinitions/)
  assert.doesNotMatch(plugin, /\bfetch\s*\(|\bWebSocket\s*\(/)
  assert.match(readme, /opencode run --agent analyzer/)
  assert.match(readme, /\.opencode\/plugins\/analyzer\/data\.sqlite/)
  assert.match(readme, /does not become the default agent/)
})

test("tech-lead caps parent-supplied context in subagent handoffs", async () => {
  const techLead = await readFile(new URL("../templates/agents/tech-lead.md", import.meta.url), "utf8")
  const normalizedTechLead = techLead.replace(/\s+/g, " ")
  assert.match(
    normalizedTechLead,
    /each assignment's parent-supplied handoff context \(task brief, compact checkpoint, and copied excerpts combined\) to an estimated maximum of 8,000 tokens/i,
  )
  assert.match(
    normalizedTechLead,
    /If it would exceed the budget, preserve the required task and validation details but split the assignment into smaller tasks or give exact file\/line pointers/i,
  )
})

test("shared setup rules require every agent to identify relevant Skills before work", async () => {
  const prompt = await readFile(new URL("../opencode-setup-prompt.md", import.meta.url), "utf8")
  const normalizedPrompt = prompt.replace(/\s+/g, " ")
  assert.match(normalizedPrompt, /Skill selection before work: at the start of each task/)
  assert.match(normalizedPrompt, /briefly recommend them in your initial plan\/status/)
  assert.match(normalizedPrompt, /load them with the native `skill` tool before the related work/)
  assert.match(normalizedPrompt, /Never install Skills, widen permissions/)
  assert.match(
    normalizedPrompt,
    /exclude `<setup root>\/templates\/skills\/` and its descendants from this target-project scan/i,
  )

  const agents = [
    "tech-lead",
    "analyst",
    "architect",
    "developer",
    "reviewer",
    "tester",
    "analyzer",
  ]
  for (const agent of agents) {
    const source = await readFile(
      new URL(`../templates/agents/${agent}.md`, import.meta.url),
      "utf8",
    )
    assert.match(source, /\.opencode\/AGENTS\.md/, `${agent} inherits shared rules`)
    assert.match(
      source,
      /action: skill\s+resource: "\*"\s+effect: allow/,
      `${agent} can load Skills added after setup`,
    )
  }

  const analyzer = await readFile(
    new URL("../templates/agents/analyzer.md", import.meta.url),
    "utf8",
  )
  assert.match(analyzer.replace(/\s+/g, " "), /recommend relevant Skills in the initial plan/i)
  assert.match(analyzer.replace(/\s+/g, " "), /load them with the native `skill` tool/i)
  assert.match(analyzer.replace(/\s+/g, " "), /cannot widen this agent's scope/i)
})

test("development pipeline approves and hands off documentation before implementation", async () => {
  const techLead = await readFile(
    new URL("../templates/agents/tech-lead.md", import.meta.url),
    "utf8",
  )
  const techLeadPermissions = techLead.split("---")[1]
  const pipeline = techLead
    .slice(techLead.indexOf("## Pipeline"))
    .split("## Planning, checklist, and context management")[0]
  const analystStep = pipeline.indexOf("**analyst**")
  const architectStep = pipeline.indexOf("**architect**")
  const baselineApproval = pipeline.indexOf("Approve the design baseline before implementation")
  const implementationLoop = pipeline.indexOf("For each task:")
  const developerStep = pipeline.indexOf("**developer**")
  const testerStep = pipeline.indexOf("**tester**")
  const reviewerStep = pipeline.lastIndexOf("**reviewer**")
  assert.ok(analystStep < architectStep)
  assert.ok(architectStep < baselineApproval)
  assert.ok(baselineApproval < implementationLoop)
  assert.ok(implementationLoop < developerStep)
  assert.ok(developerStep < testerStep)
  assert.ok(testerStep < reviewerStep)
  assert.match(techLead, /including trivial and one-line changes/i)
  assert.match(pipeline, /Never skip the analyst's impact assessment/i)
  assert.match(pipeline, /Never skip the architect's impact assessment/i)
  assert.match(pipeline, /same approved baseline as the developer and tester/i)
  assert.match(pipeline, /Do not assign implementation until the baseline is accepted/i)
  assert.match(pipeline, /assignment prompt must include the approved requirements, acceptance criteria, current documentation relevant to the task/i)
  assert.match(pipeline, /receive the same approved baseline as the developer and tester/i)
  assert.match(pipeline, /receive the same approved requirements, current relevant documentation and acceptance criteria as the developer/i)
  assert.match(pipeline, /Do not assign post-implementation edits merely to make docs match code/i)
  assert.match(techLead, /Only the analyst and architect author or update project documentation/i)
  assert.match(techLead, /Route a requirements or acceptance-criteria gap to the analyst/i)
  assert.match(techLead, /If the developer discovers missing, incorrect or conflicting documentation, stop the affected implementation/i)
  assert.match(techLead, /## Blockers and decisions/)
  assert.match(techLead, /must not invent an answer or continue the affected work on an assumption/i)
  assert.match(techLead, /never ask again for a question already answered in the current documentation/i)
  assert.doesNotMatch(
    techLeadPermissions,
    /action:\s*edit\s+resource:\s*"\.opencode\/docs\/\*\*"\s+effect:\s*allow/,
  )

  const developer = await readFile(
    new URL("../templates/agents/developer.md", import.meta.url),
    "utf8",
  )
  const developerPermissions = developer.split("---")[1]
  const tester = await readFile(
    new URL("../templates/agents/tester.md", import.meta.url),
    "utf8",
  )
  const testerPermissions = tester.split("---")[1]
  const reviewer = await readFile(
    new URL("../templates/agents/reviewer.md", import.meta.url),
    "utf8",
  )
  const reviewerPermissions = reviewer.split("---")[1]
  const analyst = await readFile(
    new URL("../templates/agents/analyst.md", import.meta.url),
    "utf8",
  )
  const architect = await readFile(
    new URL("../templates/agents/architect.md", import.meta.url),
    "utf8",
  )

  assert.match(developer, /approved design baseline included in the assignment prompt/i)
  assert.match(developer, /Do not create, edit, move or delete project documentation/i)
  assert.match(
    developerPermissions,
    /action:\s*edit\s+resource:\s*"\.opencode\/docs\/\*\*"\s+effect:\s*deny/,
  )
  assert.match(tester, /You are read-only/i)
  assert.match(tester, /Do not add, rewrite, repair or delete tests/i)
  assert.doesNotMatch(tester, /add missing tests/i)
  assert.match(testerPermissions, /action:\s*edit\s+resource:\s*"\*"\s+effect:\s*deny/)
  assert.doesNotMatch(
    testerPermissions,
    /action:\s*edit\s+resource:\s*"[^\n]+"\s+effect:\s*allow/,
  )
  assert.match(reviewer, /never edit or fix files/i)
  assert.match(reviewer, /review the tester's test-run evidence/i)
  assert.doesNotMatch(
    reviewerPermissions,
    /action:\s*edit\s+resource:\s*"[^\n]+"\s+effect:\s*allow/,
  )
  assert.match(analyst, /Own the requirements baseline/i)
  assert.match(analyst, /Do not guess, invent an answer or continue affected requirements work on an assumption/i)
  assert.match(architect, /Own the technical solution and its documentation/i)
  assert.match(tester, /same approved baseline the developer received/i)
  assert.match(tester, /approved baseline as the source of expected behavior/i)
  assert.match(tester, /do not infer expected behavior from current code/i)
  assert.match(reviewer, /include the same baseline given to the developer and tester/i)
  assert.match(reviewer, /report the exact question to tech-lead instead of guessing/i)
  assert.match(reviewer, /compare the changed code and tests with the same documents/i)

  const setupPrompt = await readFile(new URL("../opencode-setup-prompt.md", import.meta.url), "utf8")
  const normalizedSetupPrompt = setupPrompt.replace(/\s+/g, " ")
  assert.match(
    normalizedSetupPrompt,
    /Every development task, including trivial edits, must be orchestrated by tech-lead/i,
  )
  assert.match(normalizedSetupPrompt, /documentation is maintained in both usage modes/i)
  assert.match(
    normalizedSetupPrompt,
    /If any agent encounters missing, ambiguous, contradictory or unverified information.*it must not invent an answer/i,
  )
  assert.match(normalizedSetupPrompt, /do not use an assumption as a substitute/i)
  assert.doesNotMatch(normalizedSetupPrompt, /No documentation maintained by agents/i)
})
