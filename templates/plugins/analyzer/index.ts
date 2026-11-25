import { createHash } from "node:crypto"
import { mkdir, readdir, readFile } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ANALYZER_ID = "analyzer"
const SCHEMA_VERSION = 1
const DATABASE_URL = new URL("./data.sqlite", import.meta.url)
const BUSY_TIMEOUT_MS = 500
const RETENTION_DAYS = 90
const MAX_SESSIONS = 10_000
const MAX_EVENTS = 50_000
const MAX_DETAIL_ROWS = 25_000
const MAX_QUEUE_SIZE = 500
const MAX_MEASURED_BYTES = 1024 * 1024
const MAX_MEASURE_NODES = 20_000
const MAX_MEASURE_DEPTH = 12
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_CONFIG_FILES = 250
const MAX_CONFIG_FILE_BYTES = 256 * 1024
const SKIP_CONFIG_SCAN_DIRECTORIES = new Set([
  ".cache",
  ".git",
  ".gradle",
  ".idea",
  ".mypy_cache",
  ".next",
  ".pytest_cache",
  ".ruff_cache",
  ".turbo",
  ".venv",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
])

const EVENT_TYPES = [
  "session.created",
  "session.forked",
  "session.agent.selected",
  "session.model.selected",
  "session.inbox.delivered",
  "session.execution.started",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.idle",
  "session.step.started",
  "session.step.first-token",
  "session.step.ended",
  "session.step.failed",
  "session.tool.called",
  "session.tool.success",
  "session.tool.failed",
  "session.retry.scheduled",
  "session.compaction.started",
  "session.compaction.ended",
  "session.compaction.failed",
  "session.skill.activated",
  "session.shell.started",
  "session.shell.ended",
  "session.message.content.updated",
  "session.usage.recorded",
  "session.usage.updated",
  "filesystem.changed",
  "config.updated",
  "agent.updated",
  "model.updated",
  "skill.updated",
  "mcp.status.changed",
] as const

type JsonRecord = Record<string, unknown>

type SqlRow = Record<string, unknown>

interface SqlStatement {
  all(...parameters: unknown[]): SqlRow[]
  get(...parameters: unknown[]): SqlRow | null
  run(...parameters: unknown[]): { changes: number }
}

interface SqlDatabase {
  exec(sql: string): unknown
  prepare(sql: string): SqlStatement
  close?(): void
}

interface ModelReference {
  provider: string | null
  model: string | null
  variant: string | null
}

interface NormalizedEvent {
  id: string
  createdAt: number
  type: string
  sessionId: string | null
  projectId: string | null
  parentId: string | null
  messageId: string | null
  agentName: string | null
  model: ModelReference
  toolCallId: string | null
  toolName: string | null
  actionCategory: string | null
  status: string | null
  errorCategory: string | null
  inputTokens: number | null
  outputTokens: number | null
  reasoningTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
  cost: number | null
  durationMs: number | null
  details: JsonRecord
  diagnostic: boolean
  configPath: string | null
}

interface SafeConfigSnapshot {
  capturedAt: number
  fingerprint: string
  version: string | null
  summary: JsonRecord
  files: Array<{
    path: string
    hash: string
    bytes: number
    settings?: JsonRecord
  }>
}

interface AnalyzerFilters {
  from: number
  to: number
  periodDays: number
  sessionId: string | null
  agent: string | null
  provider: string | null
  model: string | null
  tool: string | null
  errorCategory: string | null
  configId: number | null
  limit: number
}

interface AnalyzerDiagnostics {
  database: "ready" | "unavailable"
  capture: "starting" | "healthy" | "degraded" | "stopped"
  lostEvents: number
  lastErrorCategory: string | null
  walEnabled: boolean
  startedAt: number
  historyTruncated: boolean
}

interface ToolDefinition {
  name: string
  description: string
  input: JsonRecord
  options: { namespace: string; codemode: false }
  execute(
    input: unknown,
    context: { agent?: string; sessionID?: string },
  ): Promise<{ content: string }>
}

interface ToolEditor {
  namespace(input: { name: string; description: string }): void
  add(tool: ToolDefinition): void
}

interface AnalyzerPluginContext {
  app?: { version?: string }
  location: {
    directory?: string
    project?: { id?: string; directory?: string; canonical?: string }
  }
  agent: { list(): Promise<unknown> }
  event: {
    subscribe(input: { types: readonly string[]; signal: AbortSignal }): AsyncIterable<unknown>
  }
  mcp: { list(): Promise<unknown> }
  model: { list(): Promise<unknown>; default(): Promise<unknown> }
  plugin: { list(): Promise<unknown> }
  skill: { list(): Promise<unknown> }
  tool: { transform(callback: (editor: ToolEditor) => void): Promise<unknown> }
}

export function getAnalyzerDatabasePath(): string {
  return fileURLToPath(DATABASE_URL)
}

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function stringValue(value: unknown, maxLength = 200): string | null {
  if (typeof value !== "string" || value.length === 0) return null
  return value.slice(0, maxLength)
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null
}

function integerValue(value: unknown): number | null {
  const number = numberValue(value)
  return number === null ? null : Math.trunc(number)
}

function boolValue(value: unknown): boolean {
  return value === true
}

function jsonString(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    )
  } catch {
    return "{}"
  }
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function modelReference(value: unknown): ModelReference {
  const model = record(value)
  return {
    provider: stringValue(model.providerID),
    model: stringValue(model.id),
    variant: stringValue(model.variant),
  }
}

function tokenMetrics(value: unknown): Pick<
  NormalizedEvent,
  | "inputTokens"
  | "outputTokens"
  | "reasoningTokens"
  | "cacheReadTokens"
  | "cacheWriteTokens"
> {
  const tokens = record(value)
  const cache = record(tokens.cache)
  return {
    inputTokens: numberValue(tokens.input),
    outputTokens: numberValue(tokens.output),
    reasoningTokens: numberValue(tokens.reasoning),
    cacheReadTokens: numberValue(cache.read),
    cacheWriteTokens: numberValue(cache.write),
  }
}

function jsonByteLength(value: unknown): number | null {
  let bytes = 0
  let nodes = 0
  const seen = new WeakSet<object>()

  function addString(value: string): void {
    for (let index = 0; index < value.length && bytes < MAX_MEASURED_BYTES; index += 1) {
      const code = value.charCodeAt(index)
      if (code <= 0x7f) bytes += 1
      else if (code <= 0x7ff) bytes += 2
      else if (
        code >= 0xd800 &&
        code <= 0xdbff &&
        index + 1 < value.length &&
        value.charCodeAt(index + 1) >= 0xdc00 &&
        value.charCodeAt(index + 1) <= 0xdfff
      ) {
        bytes += 4
        index += 1
      } else bytes += 3
    }
  }

  function visit(item: unknown, depth: number): void {
    if (bytes >= MAX_MEASURED_BYTES || nodes >= MAX_MEASURE_NODES) return
    nodes += 1
    if (typeof item === "string") {
      addString(item)
      return
    }
    if (item === null || typeof item === "boolean") {
      bytes += 5
      return
    }
    if (typeof item === "number") {
      bytes += String(item).length
      return
    }
    if (!item || typeof item !== "object") {
      bytes += 8
      return
    }
    if (depth >= MAX_MEASURE_DEPTH || seen.has(item)) {
      bytes += 8
      return
    }
    seen.add(item)
    if (Array.isArray(item)) {
      bytes += 2
      const count = Math.min(item.length, 1000)
      for (let index = 0; index < count && bytes < MAX_MEASURED_BYTES; index += 1) {
        if (index > 0) bytes += 1
        visit(item[index], depth + 1)
      }
      if (item.length > count) bytes += 3
      return
    }
    bytes += 2
    const keys = Object.keys(item as JsonRecord)
    const count = Math.min(keys.length, 1000)
    for (let index = 0; index < count && bytes < MAX_MEASURED_BYTES; index += 1) {
      if (index > 0) bytes += 1
      addString(keys[index])
      bytes += 1
      visit((item as JsonRecord)[keys[index]], depth + 1)
    }
    if (keys.length > count) bytes += 3
  }

  visit(value, 0)
  return Math.min(bytes, MAX_MEASURED_BYTES)
}

function lengthBucket(length: number): string {
  if (length <= 16) return "0-16"
  if (length <= 64) return "17-64"
  if (length <= 256) return "65-256"
  if (length <= 1024) return "257-1024"
  if (length <= 4096) return "1025-4096"
  return "4097+"
}

function argumentShape(value: unknown, depth = 0): unknown {
  if (depth >= 4) return { type: "depth_limit" }
  if (value === null) return { type: "null" }
  if (typeof value === "string") {
    return { type: "string", length: lengthBucket(value.length) }
  }
  if (typeof value === "number") return { type: "number" }
  if (typeof value === "boolean") return { type: "boolean" }
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: lengthBucket(value.length),
      items: value.slice(0, 5).map((item) => argumentShape(item, depth + 1)),
    }
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 50)
      .map(([key, item]) => [key.slice(0, 80), argumentShape(item, depth + 1)])
    return {
      type: "object",
      fields: entries,
      truncated: Object.keys(value as JsonRecord).length > entries.length,
    }
  }
  return { type: "unknown" }
}

export function argumentFingerprint(value: unknown): {
  fingerprint: string
  bytes: number | null
} {
  const shape = jsonString(argumentShape(value))
  return {
    fingerprint: hashText(shape),
    bytes: jsonByteLength(value),
  }
}

function errorCategory(value: unknown): string | null {
  if (!value) return null
  const error = record(value)
  const type = stringValue(error.type, 100)?.toLowerCase() ?? ""
  const message = stringValue(error.message, 500)?.toLowerCase() ?? ""
  const status = integerValue(error.status)

  if (status === 401 || status === 403 || /auth|credential/.test(type)) {
    return "authorization"
  }
  if (status === 429 || /rate.?limit|quota/.test(type + " " + message)) {
    return "rate_limit"
  }
  if (status === 408 || /timeout|timed out/.test(type + " " + message)) {
    return "timeout"
  }
  if (/interrupt|cancel|abort/.test(type + " " + message)) {
    return "interrupted"
  }
  if (/permission|denied/.test(type)) return "permission"
  if (/provider|model/.test(type)) return "provider"
  if (/invalid|schema|validation/.test(type)) return "invalid_input"
  if (/not.?found/.test(type)) return "not_found"
  return "other"
}

function commandCategory(value: unknown): string {
  const shell = record(value)
  const command = stringValue(shell.command, 2048)?.toLowerCase() ?? ""
  if (/\b(test|tests|pytest|vitest|jest|spec)\b/.test(command)) {
    return "test"
  }
  if (/\b(lint|ruff|eslint|prettier|format|typecheck|tsc)\b/.test(command)) {
    return "lint_or_typecheck"
  }
  if (/\b(build|compile|package)\b/.test(command)) return "build"
  if (/\bgit\b/.test(command)) return "version_control"
  if (/\b(npm|pnpm|yarn|bun|pip|uv|cargo)\b/.test(command)) return "package_manager"
  return "other"
}

function toolCategory(name: string | null, mcpServers: readonly string[]): string {
  if (!name) return "unknown"
  if (name.startsWith("analyzer_")) return "analyzer"
  if (name === "subagent") return "delegation"
  if (
    mcpServers.some((server) => {
      const prefix = server.replace(/[^a-z0-9]/gi, "_") + "_"
      return name.startsWith(prefix)
    })
  ) {
    return "mcp"
  }
  if (["read", "glob", "grep", "list"].includes(name)) return "file_read"
  return "tool"
}

function toolParts(
  value: unknown,
  mcpServers: readonly string[],
): Array<JsonRecord> {
  if (!Array.isArray(value)) return []
  return value.flatMap((part) => {
    const item = record(part)
    if (item.type !== "tool") return []
    const state = record(item.state)
    const time = record(item.time)
    const id = stringValue(item.id)
    const name = stringValue(item.name)
    if (!id || !name) return []
    return [
      {
        id,
        name,
        category: toolCategory(name, mcpServers),
        status: stringValue(state.status, 40) ?? "unknown",
        executed: boolValue(item.executed),
        createdAt: numberValue(time.created),
        startedAt: numberValue(time.ran),
        endedAt: numberValue(time.completed),
      },
    ]
  })
}

function toolPartFromParts(
  value: unknown,
  toolCallId: string | null,
  normalizedTools = false,
): JsonRecord | null {
  if (!toolCallId || !Array.isArray(value)) return null
  for (const part of value) {
    const item = record(part)
    if (
      (!normalizedTools && item.type !== "tool") ||
      stringValue(item.id) !== toolCallId
    ) {
      continue
    }
    if (stringValue(item.name)) return item
  }
  return null
}

function toolNameFromParts(
  value: unknown,
  toolCallId: string | null,
  normalizedTools = false,
): string | null {
  return stringValue(toolPartFromParts(value, toolCallId, normalizedTools)?.name)
}

export function normalizeEvent(
  value: unknown,
  mcpServers: readonly string[] = [],
): NormalizedEvent | null {
  const source = record(value)
  const data = record(source.data)
  const type = stringValue(source.type, 100)
  const id = stringValue(source.id, 200)
  const createdAt = numberValue(source.created)
  if (!type || !id || createdAt === null) return null

  const event: NormalizedEvent = {
    id,
    createdAt,
    type,
    sessionId: stringValue(data.sessionID),
    projectId: stringValue(data.projectID),
    parentId: stringValue(data.parentID),
    messageId: stringValue(data.assistantMessageID ?? data.messageID ?? data.inboxID),
    agentName: stringValue(data.agent),
    model: modelReference(data.model),
    toolCallId: stringValue(data.id),
    toolName: null,
    actionCategory: null,
    status: null,
    errorCategory: null,
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    cost: null,
    durationMs: null,
    details: {},
    diagnostic: false,
    configPath: null,
  }

  switch (type) {
    case "session.created":
      event.agentName = stringValue(data.agent)
      event.details = { created: true }
      break
    case "session.forked":
      event.details = {
        boundary: stringValue(record(data.boundary).type, 60),
      }
      break
    case "session.agent.selected":
      event.agentName = stringValue(data.agent)
      event.details = { agentChanged: true }
      break
    case "session.model.selected":
      event.model = modelReference(data.model)
      event.details = { modelChanged: true }
      break
    case "session.inbox.delivered":
      event.details = { messageDelivered: true }
      break
    case "session.execution.started":
      event.status = "running"
      event.details = { execution: "started" }
      break
    case "session.execution.succeeded":
      event.status = "idle"
      event.details = { execution: "ended" }
      break
    case "session.execution.failed":
      event.status = "failed"
      event.errorCategory = errorCategory(data.error)
      event.details = { execution: "failed" }
      break
    case "session.execution.interrupted":
      event.status = "interrupted"
      event.details = {
        execution: "interrupted",
        reason: stringValue(data.reason, 40),
      }
      break
    case "session.idle":
      event.status = "idle"
      event.details = { idle: true }
      break
    case "session.step.started":
      event.agentName = stringValue(data.agent)
      event.model = modelReference(data.model)
      event.status = "running"
      event.details = {
        startedAt: numberValue(data.started),
      }
      break
    case "session.step.first-token":
      event.details = { firstToken: true }
      break
    case "session.step.ended": {
      const metrics = tokenMetrics(data.tokens)
      event.status = "completed"
      event.cost = numberValue(data.cost)
      event.details = {
        finish: stringValue(data.finish, 40),
        rawFinish: stringValue(data.rawFinish, 80),
      }
      Object.assign(event, metrics)
      break
    }
    case "session.step.failed": {
      const metrics = tokenMetrics(data.tokens)
      event.status = "failed"
      event.errorCategory = errorCategory(data.error)
      event.cost = numberValue(data.cost)
      event.details = { finish: stringValue(data.finish, 40) }
      Object.assign(event, metrics)
      break
    }
    case "session.tool.called": {
      const input = data.input
      const args = argumentFingerprint(input)
      event.status = boolValue(data.executed) ? "running" : "not_executed"
      event.actionCategory = "tool_call"
      event.details = {
        executed: boolValue(data.executed),
        inputBytes: args.bytes,
        inputSizeCapped: args.bytes === MAX_MEASURED_BYTES,
        argsFingerprint: args.fingerprint,
      }
      break
    }
    case "session.tool.success": {
      const outputBytes = jsonByteLength(data.content)
      event.status = "succeeded"
      event.actionCategory = "tool_call"
      event.details = {
        executed: boolValue(data.executed),
        outputBytes,
        outputSizeCapped: outputBytes === MAX_MEASURED_BYTES,
      }
      break
    }
    case "session.tool.failed": {
      const outputBytes = jsonByteLength(data.content)
      event.status = "failed"
      event.errorCategory = errorCategory(data.error)
      event.actionCategory = "tool_call"
      event.details = {
        executed: boolValue(data.executed),
        outputBytes,
        outputSizeCapped: outputBytes === MAX_MEASURED_BYTES,
      }
      break
    }
    case "session.retry.scheduled":
      event.status = "retry_scheduled"
      event.errorCategory = errorCategory(data.error)
      event.details = { attempt: integerValue(data.attempt) }
      break
    case "session.compaction.started":
      event.status = "started"
      event.actionCategory = "compaction"
      event.details = { reason: stringValue(data.reason, 40) }
      break
    case "session.compaction.ended": {
      const metrics = tokenMetrics(data.tokens)
      event.status = "completed"
      event.model = modelReference(data.model)
      event.cost = numberValue(data.cost)
      event.details = {
        reason: stringValue(data.reason, 40),
        tokens: metrics,
        model: event.model,
        cost: event.cost,
      }
      break
    }
    case "session.compaction.failed":
      event.status = "failed"
      event.errorCategory = errorCategory(data.error)
      event.actionCategory = "compaction"
      event.details = { reason: stringValue(data.reason, 40) }
      break
    case "session.skill.activated":
      event.actionCategory = "skill"
      event.details = {
        skillId: stringValue(data.id, 100),
        skillName: stringValue(data.name, 120),
      }
      break
    case "session.shell.started": {
      const shell = record(data.shell)
      event.status = "running"
      event.toolCallId = stringValue(shell.id)
      event.actionCategory = commandCategory(shell)
      event.details = { commandCategory: event.actionCategory }
      break
    }
    case "session.shell.ended": {
      const shell = record(data.shell)
      const output = record(data.output)
      const status = stringValue(shell.status, 40)
      const exitCode = numberValue(shell.exit)
      const outputSize = integerValue(output.size)
      const outputBytes = outputSize ?? jsonByteLength(output.output)
      event.toolCallId = stringValue(shell.id)
      event.status = status ?? "completed"
      event.actionCategory = commandCategory(shell)
      if (status === "timeout") event.errorCategory = "timeout"
      else if (status === "killed") event.errorCategory = "interrupted"
      else if (exitCode !== null && exitCode !== 0) {
        event.errorCategory = "command_failed"
      }
      event.details = {
        commandCategory: event.actionCategory,
        exitCode,
        signal: stringValue(shell.signal, 40),
        outputBytes,
        outputSizeCapped:
          outputSize === null && outputBytes === MAX_MEASURED_BYTES,
        truncated: boolValue(output.truncated),
      }
      break
    }
    case "session.message.content.updated":
      event.details = {
        tools: toolParts(data.content, mcpServers),
      }
      break
    case "session.usage.recorded": {
      const metrics = tokenMetrics(data.tokens)
      event.actionCategory = "auxiliary_usage"
      event.status = "recorded"
      event.cost = numberValue(data.cost)
      event.details = {
        source: stringValue(data.source, 40),
        tokens: metrics,
      }
      Object.assign(event, metrics)
      break
    }
    case "session.usage.updated":
      event.actionCategory = "cumulative_usage"
      event.status = "updated"
      event.details = { cumulative: true }
      break
    case "filesystem.changed": {
      event.configPath = stringValue(data.file, 2000)
      event.actionCategory = "configuration_file"
      event.details = { operation: stringValue(data.event, 20) }
      break
    }
    case "config.updated":
    case "agent.updated":
    case "model.updated":
    case "skill.updated":
      event.actionCategory = "configuration"
      event.details = { configurationChanged: true }
      break
    case "mcp.status.changed":
      event.actionCategory = "mcp_status"
      event.details = { server: stringValue(data.server, 100) }
      break
    default:
      return null
  }

  if (type.startsWith("session.tool.")) {
    const called = type === "session.tool.called"
    const success = type === "session.tool.success"
    const details = record(event.details)
    event.toolName = toolNameFromParts(data.content, event.toolCallId)
    event.actionCategory = toolCategory(event.toolName, mcpServers)
    event.diagnostic =
      event.toolName?.startsWith("analyzer_") === true ||
      (called && boolValue(details.executed) && event.toolName === ANALYZER_ID)
    if (!called && !success && !event.errorCategory) {
      event.errorCategory = "other"
    }
  }

  if (type === "session.message.content.updated") {
    const parts = record(event.details).tools
    if (Array.isArray(parts)) {
      event.diagnostic = parts.some(
        (part) => stringValue(record(part).name)?.startsWith("analyzer_") === true,
      )
    }
  }

  if (event.agentName === ANALYZER_ID) event.diagnostic = true
  return event
}

function migrate(db: SqlDatabase): void {
  db.exec("BEGIN IMMEDIATE")
  try {
    const row = db.prepare("PRAGMA user_version").get()
    const version = integerValue(row?.user_version) ?? 0
    if (version > SCHEMA_VERSION) {
      throw new Error("database_schema_newer")
    }
    if (version < 1) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS config_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          captured_at INTEGER NOT NULL,
          opencode_version TEXT,
          summary_json TEXT NOT NULL,
          files_json TEXT NOT NULL,
          UNIQUE(project_id, fingerprint)
        );
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          parent_id TEXT,
          created_at INTEGER,
          last_activity_at INTEGER NOT NULL,
          active_started_at INTEGER,
          active_ms INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'unknown',
          agent_name TEXT,
          model_provider TEXT,
          model_id TEXT,
          model_variant TEXT,
          message_count INTEGER NOT NULL DEFAULT 0,
          tool_count INTEGER NOT NULL DEFAULT 0,
          error_count INTEGER NOT NULL DEFAULT 0,
          compaction_count INTEGER NOT NULL DEFAULT 0,
          interruption_count INTEGER NOT NULL DEFAULT 0,
          diagnostic INTEGER NOT NULL DEFAULT 0,
          config_id INTEGER,
          FOREIGN KEY(config_id) REFERENCES config_versions(id)
        );
        CREATE TABLE IF NOT EXISTS agent_runs (
          session_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          agent_name TEXT,
          model_provider TEXT,
          model_id TEXT,
          model_variant TEXT,
          started_at INTEGER,
          first_token_at INTEGER,
          ended_at INTEGER,
          duration_ms INTEGER,
          status TEXT NOT NULL DEFAULT 'unknown',
          retry_count INTEGER NOT NULL DEFAULT 0,
          tool_calls INTEGER NOT NULL DEFAULT 0,
          error_count INTEGER NOT NULL DEFAULT 0,
          input_tokens REAL,
          output_tokens REAL,
          reasoning_tokens REAL,
          cache_read_tokens REAL,
          cache_write_tokens REAL,
          cost REAL,
          diagnostic INTEGER NOT NULL DEFAULT 0,
          config_id INTEGER,
          PRIMARY KEY(session_id, message_id),
          FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
          FOREIGN KEY(config_id) REFERENCES config_versions(id)
        );
        CREATE TABLE IF NOT EXISTS model_requests (
          request_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          message_id TEXT,
          source TEXT NOT NULL,
          agent_name TEXT,
          provider TEXT,
          model TEXT,
          variant TEXT,
          started_at INTEGER,
          ended_at INTEGER,
          duration_ms INTEGER,
          status TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          input_tokens REAL,
          output_tokens REAL,
          reasoning_tokens REAL,
          cache_read_tokens REAL,
          cache_write_tokens REAL,
          cost REAL,
          diagnostic INTEGER NOT NULL DEFAULT 0,
          config_id INTEGER,
          FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
          FOREIGN KEY(config_id) REFERENCES config_versions(id)
        );
        CREATE TABLE IF NOT EXISTS tool_calls (
          session_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          tool_call_id TEXT NOT NULL,
          tool_name TEXT,
          category TEXT NOT NULL DEFAULT 'unknown',
          agent_name TEXT,
          started_at INTEGER,
          ended_at INTEGER,
          duration_ms INTEGER,
          status TEXT NOT NULL DEFAULT 'unknown',
          error_category TEXT,
          retry_count INTEGER,
          args_fingerprint TEXT,
          input_bytes INTEGER,
          output_bytes INTEGER,
          input_size_capped INTEGER NOT NULL DEFAULT 0,
          output_size_capped INTEGER NOT NULL DEFAULT 0,
          diagnostic INTEGER NOT NULL DEFAULT 0,
          config_id INTEGER,
          PRIMARY KEY(session_id, message_id, tool_call_id),
          FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
          FOREIGN KEY(config_id) REFERENCES config_versions(id)
        );
        CREATE TABLE IF NOT EXISTS events (
          event_id TEXT PRIMARY KEY,
          event_at INTEGER NOT NULL,
          type TEXT NOT NULL,
          session_id TEXT,
          message_id TEXT,
          agent_name TEXT,
          provider TEXT,
          model TEXT,
          tool_call_id TEXT,
          tool_name TEXT,
          action_category TEXT,
          resource_name TEXT,
          status TEXT,
          error_category TEXT,
          details_json TEXT NOT NULL,
          diagnostic INTEGER NOT NULL DEFAULT 0,
          config_id INTEGER,
          FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
          FOREIGN KEY(config_id) REFERENCES config_versions(id)
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_activity
          ON sessions(last_activity_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_parent
          ON sessions(parent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_time
          ON agent_runs(agent_name, started_at);
        CREATE INDEX IF NOT EXISTS idx_model_requests_model_time
          ON model_requests(provider, model, started_at);
        CREATE INDEX IF NOT EXISTS idx_tool_calls_name_time
          ON tool_calls(tool_name, started_at);
        CREATE INDEX IF NOT EXISTS idx_events_session_time
          ON events(session_id, event_at);
        CREATE INDEX IF NOT EXISTS idx_events_type_time
          ON events(type, event_at);
        CREATE INDEX IF NOT EXISTS idx_events_error
          ON events(error_category, event_at);
      `)
      db.exec("PRAGMA user_version = 1")
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_session_message_type_time
        ON events(session_id, message_id, type, event_at DESC)
    `)
    db.exec("COMMIT")
  } catch (error) {
    try {
      db.exec("ROLLBACK")
    } catch {
      // A failed transaction may already have been rolled back by SQLite.
    }
    throw error
  }
}

function boundedLimit(value: unknown, fallback = 50, maximum = 100): number {
  const number = integerValue(value)
  if (number === null) return fallback
  return Math.max(1, Math.min(maximum, number))
}

function safeFilterString(value: unknown): string | null {
  return stringValue(value, 200)
}

export function normalizeAnalyzerFilters(input: unknown, now = Date.now()): AnalyzerFilters {
  const source = record(input)
  const periodDays = Math.max(1, Math.min(365, integerValue(source.period_days) ?? 7))
  const defaultFrom = now - periodDays * DAY_MS
  const from = integerValue(source.from) ?? defaultFrom
  const to = Math.min(integerValue(source.to) ?? now, now)
  const fromBounded = Math.max(0, Math.min(from, to))
  const configId = integerValue(source.config_id)
  return {
    from: fromBounded,
    to: Math.max(fromBounded, to),
    periodDays,
    sessionId: safeFilterString(source.session_id),
    agent: safeFilterString(source.agent),
    provider: safeFilterString(source.provider),
    model: safeFilterString(source.model),
    tool: safeFilterString(source.tool),
    errorCategory: safeFilterString(source.error_category),
    configId,
    limit: boundedLimit(source.limit),
  }
}

function queryWhere(
  filters: AnalyzerFilters,
  fields: {
    time: string
    session?: string
    agent?: string
    provider?: string
    model?: string
    tool?: string
    error?: string
    config?: string
    diagnostic?: string
  },
): { sql: string; parameters: unknown[] } {
  const clauses = [`${fields.time} >= ?`, `${fields.time} <= ?`]
  const parameters: unknown[] = [filters.from, filters.to]
  if (fields.diagnostic) clauses.push(`${fields.diagnostic} = 0`)
  const optional: Array<[string | null, string | undefined]> = [
    [filters.sessionId, fields.session],
    [filters.agent, fields.agent],
    [filters.provider, fields.provider],
    [filters.model, fields.model],
    [filters.tool, fields.tool],
    [filters.errorCategory, fields.error],
  ]
  for (const [value, field] of optional) {
    if (value !== null && field) {
      clauses.push(`${field} = ?`)
      parameters.push(value)
    }
  }
  if (filters.configId !== null && fields.config) {
    clauses.push(`${fields.config} = ?`)
    parameters.push(filters.configId)
  }
  return { sql: clauses.join(" AND "), parameters }
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function publicTokenTotals(row: SqlRow): JsonRecord {
  const totalRequests = integerValue(row.request_count) ?? 0
  const metric = (name: string): JsonRecord => ({
    observedTotal: nullableNumber(row[`${name}_total`]),
    observedRequests: integerValue(row[`${name}_known`]) ?? 0,
    totalRequests,
  })
  return {
    input: metric("input_tokens"),
    output: metric("output_tokens"),
    reasoning: metric("reasoning_tokens"),
    cacheRead: metric("cache_read_tokens"),
    cacheWrite: metric("cache_write_tokens"),
    cost: {
      observedTotal: nullableNumber(row.cost_total),
      observedRequests: integerValue(row.cost_known) ?? 0,
      totalRequests,
    },
    durationMs: {
      observedAverage: nullableNumber(row.duration_average),
      observedRequests: integerValue(row.duration_known) ?? 0,
      totalRequests,
    },
  }
}

function buildRequestAggregates(
  db: SqlDatabase,
  filters: AnalyzerFilters,
  groupBy: "agent_name" | "provider, model",
): JsonRecord[] {
  const where = queryWhere(filters, {
    time: "COALESCE(started_at, ended_at)",
    agent: "agent_name",
    provider: "provider",
    model: "model",
    session: "session_id",
    config: "config_id",
    diagnostic: "diagnostic",
  })
  const groupColumns = groupBy
  const rows = db
    .prepare(
      `SELECT ${groupColumns},
        COUNT(*) AS request_count,
        SUM(input_tokens) AS input_tokens_total,
        COUNT(input_tokens) AS input_tokens_known,
        SUM(output_tokens) AS output_tokens_total,
        COUNT(output_tokens) AS output_tokens_known,
        SUM(reasoning_tokens) AS reasoning_tokens_total,
        COUNT(reasoning_tokens) AS reasoning_tokens_known,
        SUM(cache_read_tokens) AS cache_read_tokens_total,
        COUNT(cache_read_tokens) AS cache_read_tokens_known,
        SUM(cache_write_tokens) AS cache_write_tokens_total,
        COUNT(cache_write_tokens) AS cache_write_tokens_known,
        SUM(cost) AS cost_total,
        COUNT(cost) AS cost_known,
        AVG(duration_ms) AS duration_average,
        COUNT(duration_ms) AS duration_known,
        SUM(retry_count) AS retries
       FROM model_requests
       WHERE ${where.sql}
       GROUP BY ${groupColumns}
       ORDER BY request_count DESC
       LIMIT ?`,
    )
    .all(...where.parameters, filters.limit)
  return rows.map((row) => ({
    ...(groupBy === "agent_name"
      ? { agent: stringValue(row.agent_name) }
      : {
          provider: stringValue(row.provider),
          model: stringValue(row.model),
        }),
    requests: integerValue(row.request_count) ?? 0,
    retries: integerValue(row.retries) ?? 0,
    metrics: publicTokenTotals(row),
  }))
}

export function createAnalyzerStore(
  db: SqlDatabase,
  projectId: string,
  clock: () => number = Date.now,
  getMcpServers: () => readonly string[] = () => [],
) {
  migrate(db)
  let lastPrunedAt = 0
  let historyTruncated =
    db.prepare("SELECT value FROM metadata WHERE key = ?").get("history_truncated")
      ?.value === "1"

  function recordConfig(snapshot: SafeConfigSnapshot): number {
    db.prepare(
      `INSERT OR IGNORE INTO config_versions
        (project_id, fingerprint, captured_at, opencode_version, summary_json, files_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      projectId,
      snapshot.fingerprint,
      snapshot.capturedAt,
      snapshot.version,
      jsonString(snapshot.summary),
      jsonString(snapshot.files),
    )
    const row = db
      .prepare("SELECT id FROM config_versions WHERE project_id = ? AND fingerprint = ?")
      .get(projectId, snapshot.fingerprint)
    const id = integerValue(row?.id)
    if (id === null) throw new Error("config_version_insert_failed")
    return id
  }

  function currentModel(sessionId: string): ModelReference {
    const row = db
      .prepare(
        `SELECT model_provider, model_id, model_variant
         FROM sessions WHERE session_id = ?`,
      )
      .get(sessionId)
    return {
      provider: stringValue(row?.model_provider),
      model: stringValue(row?.model_id),
      variant: stringValue(row?.model_variant),
    }
  }

  function isDiagnosticSession(sessionId: string): boolean {
    const row = db
      .prepare("SELECT diagnostic FROM sessions WHERE session_id = ?")
      .get(sessionId)
    return integerValue(row?.diagnostic) === 1
  }

  function markDiagnostic(sessionId: string): void {
    const descendants = `WITH RECURSIVE descendants(session_id) AS (
      SELECT ?
      UNION ALL
      SELECT child.session_id
      FROM sessions child
      JOIN descendants parent ON child.parent_id = parent.session_id
    )`
    db.prepare(
      `${descendants}
       UPDATE sessions SET diagnostic = 1
       WHERE session_id IN (SELECT session_id FROM descendants)`,
    ).run(sessionId)
    db.prepare(
      `${descendants}
       UPDATE events SET diagnostic = 1
       WHERE session_id IN (SELECT session_id FROM descendants)`,
    ).run(sessionId)
    db.prepare(
      `${descendants}
       UPDATE agent_runs SET diagnostic = 1
       WHERE session_id IN (SELECT session_id FROM descendants)`,
    ).run(sessionId)
    db.prepare(
      `${descendants}
       UPDATE model_requests SET diagnostic = 1
       WHERE session_id IN (SELECT session_id FROM descendants)`,
    ).run(sessionId)
    db.prepare(
      `${descendants}
       UPDATE tool_calls SET diagnostic = 1
       WHERE session_id IN (SELECT session_id FROM descendants)`,
    ).run(sessionId)
  }

  function ensureSession(event: NormalizedEvent, configId: number | null): boolean {
    if (!event.sessionId) return false
    const parent = event.parentId
    const parentDiagnostic = parent ? isDiagnosticSession(parent) : false
    const diagnostic =
      event.diagnostic ||
      event.agentName === ANALYZER_ID ||
      parentDiagnostic ||
      (event.toolName?.startsWith("analyzer_") ?? false)
    const model = event.model
    const sessionStatus =
      event.type === "session.created"
        ? "idle"
        : event.type === "session.execution.started" ||
            event.type === "session.step.started"
          ? "running"
          : event.type === "session.execution.failed"
            ? "failed"
            : event.type === "session.execution.interrupted"
              ? "interrupted"
              : event.type === "session.execution.succeeded" ||
                  event.type === "session.idle"
                ? "idle"
                : "unknown"
    db.prepare(
      `INSERT INTO sessions (
         session_id, project_id, parent_id, created_at, last_activity_at, status,
         agent_name, model_provider, model_id, model_variant, diagnostic, config_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         project_id = excluded.project_id,
         parent_id = COALESCE(sessions.parent_id, excluded.parent_id),
         created_at = COALESCE(sessions.created_at, excluded.created_at),
         last_activity_at = MAX(sessions.last_activity_at, excluded.last_activity_at),
         agent_name = COALESCE(excluded.agent_name, sessions.agent_name),
         model_provider = COALESCE(excluded.model_provider, sessions.model_provider),
         model_id = COALESCE(excluded.model_id, sessions.model_id),
         model_variant = COALESCE(excluded.model_variant, sessions.model_variant),
          status = CASE WHEN excluded.status = 'unknown'
            THEN sessions.status ELSE excluded.status END,
          diagnostic = MAX(sessions.diagnostic, excluded.diagnostic),
         config_id = COALESCE(excluded.config_id, sessions.config_id)`,
    ).run(
      event.sessionId,
      event.projectId ?? projectId,
      parent,
      event.type === "session.created" ? event.createdAt : null,
      event.createdAt,
      sessionStatus,
      event.agentName,
      model.provider,
      model.model,
      model.variant,
      diagnostic ? 1 : 0,
      configId,
    )
    return diagnostic || isDiagnosticSession(event.sessionId)
  }

  function findToolPart(
    event: Pick<NormalizedEvent, "toolName" | "sessionId" | "messageId" | "toolCallId">,
  ): { name: string; category: string | null } | null {
    if (event.toolName) return { name: event.toolName, category: null }
    if (!event.sessionId || !event.messageId || !event.toolCallId) return null
    const rows = db
      .prepare(
        `SELECT details_json FROM events
         WHERE session_id = ? AND message_id = ?
           AND type = 'session.message.content.updated'
         ORDER BY event_at DESC`,
      )
      .all(event.sessionId, event.messageId)
    for (const row of rows) {
      try {
        const details = record(JSON.parse(String(row.details_json)))
        const part = toolPartFromParts(details.tools, event.toolCallId, true)
        const name = stringValue(part?.name)
        if (name) return { name, category: stringValue(part?.category, 40) }
      } catch {
        continue
      }
    }
    return null
  }

  function findToolName(
    event: Pick<NormalizedEvent, "toolName" | "sessionId" | "messageId" | "toolCallId">,
  ): string | null {
    return findToolPart(event)?.name ?? null
  }

  function updateToolName(
    sessionId: string,
    messageId: string,
    toolCallId: string,
    name: string,
    category?: string | null,
  ): void {
    const resolvedCategory = category ?? toolCategory(name, getMcpServers())
    const diagnostic = name.startsWith("analyzer_")
    db.prepare(
      `UPDATE tool_calls SET tool_name = ?, category = ?,
         diagnostic = MAX(diagnostic, ?)
       WHERE session_id = ? AND message_id = ? AND tool_call_id = ?`,
    ).run(name, resolvedCategory, diagnostic ? 1 : 0, sessionId, messageId, toolCallId)
    db.prepare(
      `UPDATE events SET tool_name = ?, action_category = ?,
         diagnostic = MAX(diagnostic, ?)
       WHERE session_id = ? AND message_id = ? AND tool_call_id = ?
         AND type IN ('session.tool.called', 'session.tool.success', 'session.tool.failed')`,
    ).run(name, resolvedCategory, diagnostic ? 1 : 0, sessionId, messageId, toolCallId)
    if (diagnostic) markDiagnostic(sessionId)
  }

  function updateToolNamesFromEvent(event: NormalizedEvent): void {
    if (!event.sessionId || !event.messageId) return
    const tools = Array.isArray(event.details.tools) ? event.details.tools : []
    for (const part of tools) {
      const item = record(part)
      const id = stringValue(item.id)
      const name = stringValue(item.name)
      if (id && name) {
        updateToolName(
          event.sessionId,
          event.messageId,
          id,
          name,
          stringValue(item.category, 40),
        )
      }
    }
  }

  function backfillToolNames(): void {
    const completed = db
      .prepare("SELECT value FROM metadata WHERE key = ?")
      .get("tool_name_backfill_v1")
    if (completed?.value === "1") return

    const unresolved = db
      .prepare(
        `SELECT session_id, message_id, tool_call_id
         FROM tool_calls WHERE tool_name IS NULL
         ORDER BY COALESCE(ended_at, started_at) DESC LIMIT ?`,
      )
      .all(MAX_DETAIL_ROWS)
    for (const row of unresolved) {
      const sessionId = stringValue(row.session_id)
      const messageId = stringValue(row.message_id)
      const toolCallId = stringValue(row.tool_call_id)
      if (!sessionId || !messageId || !toolCallId) continue
      const part = findToolPart({
        sessionId,
        messageId,
        toolCallId,
        toolName: null,
      })
      if (part) {
        updateToolName(sessionId, messageId, toolCallId, part.name, part.category)
      }
    }
    db.prepare(
      `INSERT INTO metadata(key, value) VALUES ('tool_name_backfill_v1', '1')
       ON CONFLICT(key) DO UPDATE SET value = '1'`,
    ).run()
  }

  function findAgentName(event: NormalizedEvent): string | null {
    if (event.agentName) return event.agentName
    if (!event.sessionId || !event.messageId) return null
    const row = db
      .prepare(
        `SELECT agent_name FROM agent_runs
         WHERE session_id = ? AND message_id = ?`,
      )
      .get(event.sessionId, event.messageId)
    return stringValue(row?.agent_name)
  }

  function upsertToolCall(event: NormalizedEvent, configId: number | null): void {
    if (!event.sessionId || !event.messageId || !event.toolCallId) return
    const name = findToolName(event)
    const argsFingerprint = stringValue(event.details.argsFingerprint, 64)
    const inputBytes = integerValue(event.details.inputBytes)
    const inputSizeCapped = boolValue(event.details.inputSizeCapped) ? 1 : 0
    const category =
      event.actionCategory &&
      event.actionCategory !== "tool_call" &&
      event.actionCategory !== "unknown"
        ? event.actionCategory
        : toolCategory(name, getMcpServers())
    const isToolStart = event.type === "session.tool.called"
    const isFailure = event.type === "session.tool.failed"
    const status = isToolStart
      ? event.status ?? "running"
      : isFailure
        ? "failed"
        : event.type === "session.tool.success"
          ? "succeeded"
          : "unknown"
    const outputBytes = integerValue(event.details.outputBytes)
    const outputSizeCapped = boolValue(event.details.outputSizeCapped) ? 1 : 0
    const sessionDiagnostic =
      isDiagnosticSession(event.sessionId) ||
      name?.startsWith("analyzer_") === true
    const startedAt = isToolStart ? event.createdAt : null
    const endedAt = isToolStart ? null : event.createdAt
    const existing = db
      .prepare(
        `SELECT started_at, status FROM tool_calls
         WHERE session_id = ? AND message_id = ? AND tool_call_id = ?`,
      )
      .get(event.sessionId, event.messageId, event.toolCallId)
    const existingStart = integerValue(existing?.started_at)
    const duration =
      existingStart !== null && endedAt !== null
        ? Math.max(0, endedAt - existingStart)
        : null
    db.prepare(
      `INSERT INTO tool_calls (
         session_id, message_id, tool_call_id, tool_name, category, agent_name,
         started_at, ended_at, duration_ms, status, error_category,
         args_fingerprint, input_bytes, output_bytes, input_size_capped,
         output_size_capped, diagnostic, config_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, message_id, tool_call_id) DO UPDATE SET
         tool_name = COALESCE(excluded.tool_name, tool_calls.tool_name),
         category = CASE WHEN excluded.category = 'unknown'
           THEN tool_calls.category ELSE excluded.category END,
         agent_name = COALESCE(excluded.agent_name, tool_calls.agent_name),
         started_at = COALESCE(tool_calls.started_at, excluded.started_at),
         ended_at = COALESCE(excluded.ended_at, tool_calls.ended_at),
         duration_ms = COALESCE(excluded.duration_ms, tool_calls.duration_ms),
          status = CASE WHEN excluded.status = 'running'
            AND tool_calls.status IN ('unknown', 'running')
            THEN 'running'
            WHEN excluded.status = 'unknown' THEN tool_calls.status
            ELSE excluded.status END,
         error_category = COALESCE(excluded.error_category, tool_calls.error_category),
         args_fingerprint = COALESCE(excluded.args_fingerprint, tool_calls.args_fingerprint),
         input_bytes = COALESCE(excluded.input_bytes, tool_calls.input_bytes),
         output_bytes = COALESCE(excluded.output_bytes, tool_calls.output_bytes),
         input_size_capped = MAX(tool_calls.input_size_capped, excluded.input_size_capped),
         output_size_capped = MAX(tool_calls.output_size_capped, excluded.output_size_capped),
         diagnostic = MAX(tool_calls.diagnostic, excluded.diagnostic),
         config_id = COALESCE(excluded.config_id, tool_calls.config_id)`,
    ).run(
      event.sessionId,
      event.messageId,
      event.toolCallId,
      name,
      category,
      event.agentName,
      startedAt,
      endedAt,
      duration,
      status,
      event.errorCategory,
      argsFingerprint,
      inputBytes,
      outputBytes,
      inputSizeCapped,
      outputSizeCapped,
      sessionDiagnostic ? 1 : 0,
      configId,
    )

    if (isToolStart) {
      db.prepare(
        `UPDATE sessions SET tool_count = tool_count + 1
         WHERE session_id = ?`,
      ).run(event.sessionId)
      db.prepare(
        `UPDATE agent_runs SET tool_calls = tool_calls + 1
         WHERE session_id = ? AND message_id = ?`,
      ).run(event.sessionId, event.messageId)
    }
    if (isFailure) {
      db.prepare(
        `UPDATE sessions SET error_count = error_count + 1
         WHERE session_id = ?`,
      ).run(event.sessionId)
      db.prepare(
        `UPDATE agent_runs SET error_count = error_count + 1
         WHERE session_id = ? AND message_id = ?`,
      ).run(event.sessionId, event.messageId)
    }
  }

  function saveAgentRun(event: NormalizedEvent, configId: number | null): void {
    if (!event.sessionId || !event.messageId) return
    const model = event.model
    const sessionModel = currentModel(event.sessionId)
    const provider = model.provider ?? sessionModel.provider
    const modelId = model.model ?? sessionModel.model
    const variant = model.variant ?? sessionModel.variant
    if (event.type === "session.step.started") {
      const startedAt = integerValue(event.details.startedAt) ?? event.createdAt
      db.prepare(
        `INSERT INTO agent_runs (
           session_id, message_id, agent_name, model_provider, model_id, model_variant,
           started_at, status, diagnostic, config_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)
         ON CONFLICT(session_id, message_id) DO UPDATE SET
           agent_name = COALESCE(excluded.agent_name, agent_runs.agent_name),
           model_provider = COALESCE(excluded.model_provider, agent_runs.model_provider),
           model_id = COALESCE(excluded.model_id, agent_runs.model_id),
           model_variant = COALESCE(excluded.model_variant, agent_runs.model_variant),
           started_at = COALESCE(agent_runs.started_at, excluded.started_at),
           diagnostic = MAX(agent_runs.diagnostic, excluded.diagnostic),
           config_id = COALESCE(excluded.config_id, agent_runs.config_id)`,
      ).run(
        event.sessionId,
        event.messageId,
        event.agentName,
        provider,
        modelId,
        variant,
        startedAt,
        event.diagnostic ? 1 : 0,
        configId,
      )
      const requestId = `step:${event.sessionId}:${event.messageId}`
      db.prepare(
        `INSERT INTO model_requests (
           request_id, session_id, message_id, source, agent_name, provider,
           model, variant, started_at, status, diagnostic, config_id
         )
         VALUES (?, ?, ?, 'agent_step', ?, ?, ?, ?, ?, 'running', ?, ?)
         ON CONFLICT(request_id) DO UPDATE SET
           agent_name = COALESCE(excluded.agent_name, model_requests.agent_name),
           provider = COALESCE(excluded.provider, model_requests.provider),
           model = COALESCE(excluded.model, model_requests.model),
           variant = COALESCE(excluded.variant, model_requests.variant),
           started_at = COALESCE(model_requests.started_at, excluded.started_at),
           diagnostic = MAX(model_requests.diagnostic, excluded.diagnostic),
           config_id = COALESCE(excluded.config_id, model_requests.config_id)`,
      ).run(
        requestId,
        event.sessionId,
        event.messageId,
        event.agentName,
        provider,
        modelId,
        variant,
        startedAt,
        event.diagnostic ? 1 : 0,
        configId,
      )
      db.prepare(
        `UPDATE sessions SET message_count = message_count + 1
         WHERE session_id = ?`,
      ).run(event.sessionId)
      return
    }

    if (event.type === "session.step.first-token") {
      db.prepare(
        `UPDATE agent_runs SET first_token_at = ?
         WHERE session_id = ? AND message_id = ?`,
      ).run(event.createdAt, event.sessionId, event.messageId)
      return
    }

    if (
      event.type === "session.step.ended" ||
      event.type === "session.step.failed"
    ) {
      const status = event.type === "session.step.failed" ? "failed" : "completed"
      const details = record(event.details)
      const finish = stringValue(details.finish, 40)
      const row = db
        .prepare(
          `SELECT started_at FROM agent_runs
           WHERE session_id = ? AND message_id = ?`,
        )
        .get(event.sessionId, event.messageId)
      const startedAt = integerValue(row?.started_at)
      const duration =
        startedAt === null ? null : Math.max(0, event.createdAt - startedAt)
      const fields = [
        event.inputTokens,
        event.outputTokens,
        event.reasoningTokens,
        event.cacheReadTokens,
        event.cacheWriteTokens,
        event.cost,
      ]
      db.prepare(
        `UPDATE agent_runs SET
           ended_at = ?, duration_ms = ?, status = ?,
           input_tokens = COALESCE(?, input_tokens),
           output_tokens = COALESCE(?, output_tokens),
           reasoning_tokens = COALESCE(?, reasoning_tokens),
           cache_read_tokens = COALESCE(?, cache_read_tokens),
           cache_write_tokens = COALESCE(?, cache_write_tokens),
           cost = COALESCE(?, cost)
         WHERE session_id = ? AND message_id = ?`,
      ).run(
        event.createdAt,
        duration,
        finish === "error" || finish === "content-filter" ? "failed" : status,
        ...fields,
        event.sessionId,
        event.messageId,
      )
      const requestId = `step:${event.sessionId}:${event.messageId}`
      db.prepare(
        `UPDATE model_requests SET
           ended_at = ?, duration_ms = ?, status = ?,
           input_tokens = COALESCE(?, input_tokens),
           output_tokens = COALESCE(?, output_tokens),
           reasoning_tokens = COALESCE(?, reasoning_tokens),
           cache_read_tokens = COALESCE(?, cache_read_tokens),
           cache_write_tokens = COALESCE(?, cache_write_tokens),
           cost = COALESCE(?, cost)
         WHERE request_id = ?`,
      ).run(
        event.createdAt,
        duration,
        finish === "error" || finish === "content-filter" ? "failed" : status,
        ...fields,
        requestId,
      )
      if (event.type === "session.step.failed") {
        db.prepare(
          `UPDATE sessions SET error_count = error_count + 1
           WHERE session_id = ?`,
        ).run(event.sessionId)
        db.prepare(
          `UPDATE agent_runs SET error_count = error_count + 1
           WHERE session_id = ? AND message_id = ?`,
        ).run(event.sessionId, event.messageId)
      }
      return
    }

    if (event.type === "session.retry.scheduled") {
      db.prepare(
        `UPDATE agent_runs SET retry_count = retry_count + 1
         WHERE session_id = ? AND message_id = ?`,
      ).run(event.sessionId, event.messageId)
      db.prepare(
        `UPDATE model_requests SET retry_count = retry_count + 1
         WHERE request_id = ?`,
      ).run(`step:${event.sessionId}:${event.messageId}`)
    }
  }

  function recordAuxiliaryUsage(event: NormalizedEvent, configId: number | null): void {
    if (!event.sessionId) return
    const source = stringValue(event.details.source, 40) ?? "unknown"
    db.prepare(
      `INSERT OR IGNORE INTO model_requests (
         request_id, session_id, source, provider, model,
         started_at, ended_at, status, input_tokens, output_tokens,
         reasoning_tokens, cache_read_tokens, cache_write_tokens, cost,
         diagnostic, config_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `usage:${event.id}`,
      event.sessionId,
      source,
      null,
      null,
      event.createdAt,
      event.createdAt,
      event.inputTokens,
      event.outputTokens,
      event.reasoningTokens,
      event.cacheReadTokens,
      event.cacheWriteTokens,
      event.cost,
      event.diagnostic ? 1 : 0,
      configId,
    )
  }

  function finishExecution(
    event: NormalizedEvent,
    status: "idle" | "failed" | "interrupted",
  ): void {
    if (!event.sessionId) return
    db.prepare(
      `UPDATE sessions SET
         active_ms = active_ms +
           CASE WHEN active_started_at IS NULL THEN 0
           ELSE MAX(0, ? - active_started_at) END,
         active_started_at = NULL,
         status = ?
       WHERE session_id = ?`,
    ).run(event.createdAt, status, event.sessionId)
    if (status === "interrupted") {
      db.prepare(
        `UPDATE sessions SET interruption_count = interruption_count + 1
         WHERE session_id = ?`,
      ).run(event.sessionId)
    }
    if (status === "failed") {
      db.prepare(
        `UPDATE sessions SET error_count = error_count + 1
         WHERE session_id = ?`,
      ).run(event.sessionId)
    }
    if (status !== "idle") {
      db.prepare(
        `UPDATE agent_runs SET ended_at = ?, status = ?
         WHERE session_id = ? AND status = 'running'`,
      ).run(event.createdAt, status, event.sessionId)
      db.prepare(
        `UPDATE model_requests SET ended_at = ?, status = ?
         WHERE session_id = ? AND status = 'running'`,
      ).run(event.createdAt, status, event.sessionId)
    }
  }

  function writeEvent(event: NormalizedEvent, configId: number | null): boolean {
    const isDiagnostic = event.sessionId
      ? ensureSession(event, configId)
      : event.diagnostic
    event.agentName = findAgentName(event)
    if (event.agentName === ANALYZER_ID && event.sessionId) {
      markDiagnostic(event.sessionId)
    }
    const toolName = findToolName(event) ?? event.toolName
    if (
      event.type.startsWith("session.tool.") &&
      event.actionCategory === "unknown"
    ) {
      event.actionCategory = toolCategory(toolName, getMcpServers())
    }
    const diagnostic =
      isDiagnostic ||
      event.diagnostic ||
      toolName?.startsWith("analyzer_") === true
    event.diagnostic = diagnostic
    if (diagnostic && event.sessionId) markDiagnostic(event.sessionId)
    const resourceName =
      event.type === "session.skill.activated"
        ? stringValue(event.details.skillId, 100)
        : event.type === "mcp.status.changed"
          ? stringValue(event.details.server, 100)
          : null
    const result = db
      .prepare(
        `INSERT OR IGNORE INTO events (
           event_id, event_at, type, session_id, message_id, agent_name,
           provider, model, tool_call_id, tool_name, action_category,
           resource_name, status, error_category, details_json, diagnostic, config_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.createdAt,
        event.type,
        event.sessionId,
        event.messageId,
        event.agentName,
        event.model.provider,
        event.model.model,
        event.toolCallId,
        toolName,
        event.actionCategory,
        resourceName,
        event.status,
        event.errorCategory,
        jsonString(event.details),
        diagnostic ? 1 : 0,
        configId,
      )
    if (result.changes === 0) {
      if (event.type === "session.message.content.updated") {
        updateToolNamesFromEvent(event)
      }
      return false
    }

    if (!event.sessionId) return true
    db.prepare(
      `UPDATE sessions SET last_activity_at = MAX(last_activity_at, ?),
         config_id = COALESCE(?, config_id)
       WHERE session_id = ?`,
    ).run(event.createdAt, configId, event.sessionId)

    switch (event.type) {
      case "session.forked":
        db.prepare("UPDATE sessions SET parent_id = ? WHERE session_id = ?").run(
          event.parentId,
          event.sessionId,
        )
        if (event.parentId && isDiagnosticSession(event.parentId)) {
          markDiagnostic(event.sessionId)
        }
        break
      case "session.agent.selected":
        db.prepare("UPDATE sessions SET agent_name = ? WHERE session_id = ?").run(
          event.agentName,
          event.sessionId,
        )
        if (event.agentName === ANALYZER_ID) markDiagnostic(event.sessionId)
        break
      case "session.model.selected":
        db.prepare(
          `UPDATE sessions SET model_provider = ?, model_id = ?, model_variant = ?
           WHERE session_id = ?`,
        ).run(
          event.model.provider,
          event.model.model,
          event.model.variant,
          event.sessionId,
        )
        break
      case "session.execution.started":
        db.prepare(
          `UPDATE sessions SET active_started_at = COALESCE(active_started_at, ?),
             status = 'running'
           WHERE session_id = ?`,
        ).run(event.createdAt, event.sessionId)
        break
      case "session.execution.succeeded":
      case "session.idle":
        finishExecution(event, "idle")
        break
      case "session.execution.failed":
        finishExecution(event, "failed")
        break
      case "session.execution.interrupted":
        finishExecution(event, "interrupted")
        break
      case "session.inbox.delivered":
        db.prepare(
          `UPDATE sessions SET message_count = message_count + 1
           WHERE session_id = ?`,
        ).run(event.sessionId)
        break
      case "session.step.started":
      case "session.step.first-token":
      case "session.step.ended":
      case "session.step.failed":
      case "session.retry.scheduled":
        if (event.type === "session.step.started") {
          db.prepare(
            `UPDATE sessions SET active_started_at = COALESCE(active_started_at, ?),
               status = 'running'
             WHERE session_id = ?`,
          ).run(event.createdAt, event.sessionId)
        }
        saveAgentRun(event, configId)
        if (event.type === "session.retry.scheduled" && event.errorCategory) {
          db.prepare(
            `UPDATE sessions SET error_count = error_count + 1
             WHERE session_id = ?`,
          ).run(event.sessionId)
        }
        break
      case "session.tool.called":
      case "session.tool.success":
      case "session.tool.failed":
        upsertToolCall(event, configId)
        break
      case "session.message.content.updated": {
        updateToolNamesFromEvent(event)
        if (diagnostic) markDiagnostic(event.sessionId)
        break
      }
      case "session.compaction.started":
        db.prepare(
          `UPDATE sessions SET compaction_count = compaction_count + 1
           WHERE session_id = ?`,
        ).run(event.sessionId)
        break
      case "session.compaction.failed":
        db.prepare(
          `UPDATE sessions SET error_count = error_count + 1
           WHERE session_id = ?`,
        ).run(event.sessionId)
        break
      case "session.shell.ended":
        if (event.errorCategory) {
          db.prepare(
            `UPDATE sessions SET error_count = error_count + 1
             WHERE session_id = ?`,
          ).run(event.sessionId)
        }
        break
      case "session.usage.recorded":
        recordAuxiliaryUsage(event, configId)
        break
      default:
        break
    }

    return true
  }

  function recordEvent(event: NormalizedEvent, configId: number | null): boolean {
    db.exec("BEGIN IMMEDIATE")
    try {
      const inserted = writeEvent(event, configId)
      db.exec("COMMIT")
      return inserted
    } catch (error) {
      try {
        db.exec("ROLLBACK")
      } catch {
        // Preserve the original write error if SQLite already rolled back.
      }
      throw error
    }
  }

  function prune(now = clock()): void {
    if (now - lastPrunedAt < DAY_MS) return
    const cutoff = now - RETENTION_DAYS * DAY_MS
    db.exec("BEGIN IMMEDIATE")
    try {
      let removedRows = db
        .prepare("DELETE FROM sessions WHERE last_activity_at < ?")
        .run(cutoff).changes
      removedRows += db
        .prepare(
          `DELETE FROM sessions WHERE rowid IN (
             SELECT rowid FROM sessions ORDER BY last_activity_at DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(MAX_SESSIONS).changes
      removedRows += db.prepare("DELETE FROM events WHERE event_at < ?").run(cutoff).changes
      removedRows += db
        .prepare(
          `DELETE FROM events WHERE rowid IN (
             SELECT rowid FROM events ORDER BY event_at DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(MAX_EVENTS).changes
      removedRows += db
        .prepare(
          `DELETE FROM model_requests WHERE rowid IN (
             SELECT rowid FROM model_requests
             ORDER BY COALESCE(ended_at, started_at) DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(MAX_DETAIL_ROWS).changes
      removedRows += db
        .prepare(
          `DELETE FROM agent_runs WHERE rowid IN (
             SELECT rowid FROM agent_runs
             ORDER BY COALESCE(ended_at, started_at) DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(MAX_DETAIL_ROWS).changes
      removedRows += db
        .prepare(
          `DELETE FROM tool_calls WHERE rowid IN (
             SELECT rowid FROM tool_calls
             ORDER BY COALESCE(ended_at, started_at) DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(MAX_DETAIL_ROWS).changes
      const retainedConfigs = `SELECT id FROM config_versions
        ORDER BY captured_at DESC LIMIT 64`
      removedRows += db
        .prepare(
          `UPDATE sessions SET config_id = NULL
           WHERE config_id IS NOT NULL AND config_id NOT IN (${retainedConfigs})`,
        )
        .run().changes
      removedRows += db
        .prepare(
          `UPDATE events SET config_id = NULL
           WHERE config_id IS NOT NULL AND config_id NOT IN (${retainedConfigs})`,
        )
        .run().changes
      removedRows += db
        .prepare(
          `UPDATE model_requests SET config_id = NULL
           WHERE config_id IS NOT NULL AND config_id NOT IN (${retainedConfigs})`,
        )
        .run().changes
      removedRows += db
        .prepare(
          `UPDATE agent_runs SET config_id = NULL
           WHERE config_id IS NOT NULL AND config_id NOT IN (${retainedConfigs})`,
        )
        .run().changes
      removedRows += db
        .prepare(
          `UPDATE tool_calls SET config_id = NULL
           WHERE config_id IS NOT NULL AND config_id NOT IN (${retainedConfigs})`,
        )
        .run().changes
      removedRows += db
        .prepare(
          `DELETE FROM config_versions
           WHERE id NOT IN (${retainedConfigs})`,
        )
        .run().changes
      if (removedRows > 0) {
        db.prepare(
          `INSERT INTO metadata(key, value) VALUES ('history_truncated', '1')
           ON CONFLICT(key) DO UPDATE SET value = '1'`,
        ).run()
      }
      db.exec("COMMIT")
      if (removedRows > 0) historyTruncated = true
    } catch (error) {
      try {
        db.exec("ROLLBACK")
      } catch {
        // Preserve the original pruning error if SQLite already rolled back.
      }
      lastPrunedAt = now
      throw error
    }
    try {
      db.exec("PRAGMA incremental_vacuum(100)")
    } catch {
      // Incremental vacuum is best-effort on SQLite builds without support.
    }
    lastPrunedAt = now
  }

  function summary(input: unknown, diagnostics: AnalyzerDiagnostics): JsonRecord {
    const filters = normalizeAnalyzerFilters(input, clock())
    const sessionWhere = queryWhere(filters, {
      time: "last_activity_at",
      session: "session_id",
      agent: "agent_name",
      provider: "model_provider",
      model: "model_id",
      diagnostic: "diagnostic",
    })
    const requestWhere = queryWhere(filters, {
      time: "COALESCE(started_at, ended_at)",
      session: "session_id",
      agent: "agent_name",
      provider: "provider",
      model: "model",
      config: "config_id",
      diagnostic: "diagnostic",
    })
    const toolWhere = queryWhere(filters, {
      time: "COALESCE(started_at, ended_at)",
      session: "session_id",
      agent: "agent_name",
      tool: "tool_name",
      config: "config_id",
      diagnostic: "diagnostic",
    })
    const eventWhere = queryWhere(filters, {
      time: "event_at",
      session: "session_id",
      agent: "agent_name",
      error: "error_category",
      config: "config_id",
      diagnostic: "diagnostic",
    })
    const activityWhere = queryWhere(filters, {
      time: "event_at",
      session: "session_id",
      agent: "agent_name",
      config: "config_id",
      diagnostic: "diagnostic",
    })
    const sessionStats = db
      .prepare(
        `SELECT COUNT(*) AS sessions,
           SUM(message_count) AS messages,
           SUM(tool_count) AS tool_calls,
           SUM(error_count) AS errors,
           SUM(compaction_count) AS compactions,
           SUM(interruption_count) AS interruptions,
           SUM(active_ms + CASE WHEN active_started_at IS NULL THEN 0
             ELSE MAX(0, ? - active_started_at) END) AS active_ms,
           SUM(CASE WHEN created_at IS NULL THEN NULL
             ELSE MAX(0, last_activity_at - created_at) END) AS observed_span_ms
         FROM sessions WHERE ${sessionWhere.sql}`,
      )
      .get(clock(), ...sessionWhere.parameters)
    const statusRows = db
      .prepare(
        `SELECT status, COUNT(*) AS count FROM sessions
         WHERE ${sessionWhere.sql} GROUP BY status`,
      )
      .all(...sessionWhere.parameters)
    const requestTotal = db
      .prepare(
        `SELECT COUNT(*) AS request_count,
           SUM(input_tokens) AS input_tokens_total,
           COUNT(input_tokens) AS input_tokens_known,
           SUM(output_tokens) AS output_tokens_total,
           COUNT(output_tokens) AS output_tokens_known,
           SUM(reasoning_tokens) AS reasoning_tokens_total,
           COUNT(reasoning_tokens) AS reasoning_tokens_known,
           SUM(cache_read_tokens) AS cache_read_tokens_total,
           COUNT(cache_read_tokens) AS cache_read_tokens_known,
           SUM(cache_write_tokens) AS cache_write_tokens_total,
           COUNT(cache_write_tokens) AS cache_write_tokens_known,
           SUM(cost) AS cost_total,
           COUNT(cost) AS cost_known,
           AVG(duration_ms) AS duration_average,
           COUNT(duration_ms) AS duration_known,
           SUM(retry_count) AS retries
         FROM model_requests WHERE ${requestWhere.sql}`,
      )
      .get(...requestWhere.parameters)
    const toolRows = db
      .prepare(
        `SELECT tool_name, category, COUNT(*) AS calls,
           SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
           SUM(CASE WHEN status IN ('running', 'unknown') THEN 1 ELSE 0 END) AS unfinished,
           AVG(duration_ms) AS duration_average,
           COUNT(duration_ms) AS duration_known,
           AVG(input_bytes) AS input_bytes_average,
           AVG(output_bytes) AS output_bytes_average,
           SUM(input_size_capped) AS input_size_capped_calls,
           SUM(output_size_capped) AS output_size_capped_calls
         FROM tool_calls WHERE ${toolWhere.sql}
         GROUP BY tool_name, category ORDER BY calls DESC LIMIT ?`,
      )
      .all(...toolWhere.parameters, Math.min(filters.limit, 50))
    const toolNameCoverage = db
      .prepare(
        `SELECT COUNT(*) AS total_calls, COUNT(tool_name) AS named_calls
         FROM tool_calls WHERE ${toolWhere.sql}`,
      )
      .get(...toolWhere.parameters)
    const totalToolCalls = integerValue(toolNameCoverage?.total_calls) ?? 0
    const namedToolCalls = integerValue(toolNameCoverage?.named_calls) ?? 0
    const modelRows = buildRequestAggregates(db, filters, "provider, model")
    const agentRows = buildRequestAggregates(db, filters, "agent_name")
    const errorRows = db
      .prepare(
        `SELECT error_category, COUNT(*) AS occurrences,
           COUNT(DISTINCT session_id) AS sessions
         FROM events WHERE ${eventWhere.sql} AND error_category IS NOT NULL
         GROUP BY error_category ORDER BY occurrences DESC LIMIT ?`,
      )
      .all(...eventWhere.parameters, Math.min(filters.limit, 50))
    const skillRows = db
      .prepare(
        `SELECT resource_name, COUNT(*) AS activations,
           COUNT(DISTINCT session_id) AS sessions
         FROM events
         WHERE ${activityWhere.sql}
           AND type = 'session.skill.activated'
           AND resource_name IS NOT NULL
         GROUP BY resource_name ORDER BY activations DESC LIMIT ?`,
      )
      .all(...activityWhere.parameters, Math.min(filters.limit, 50))
    const checkStartRows = db
      .prepare(
        `SELECT action_category, COUNT(*) AS commands,
           COUNT(DISTINCT session_id) AS sessions
         FROM events
         WHERE ${activityWhere.sql}
           AND type = 'session.shell.started'
           AND action_category IN ('test', 'lint_or_typecheck', 'build')
         GROUP BY action_category ORDER BY commands DESC`,
      )
      .all(...activityWhere.parameters)
    const checkEndRows = db
      .prepare(
        `SELECT action_category, COUNT(*) AS completed,
           SUM(CASE WHEN error_category IS NOT NULL THEN 1 ELSE 0 END) AS failed,
           SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) AS timeouts,
           SUM(CASE WHEN status = 'killed' THEN 1 ELSE 0 END) AS killed
         FROM events
         WHERE ${activityWhere.sql}
           AND type = 'session.shell.ended'
           AND action_category IN ('test', 'lint_or_typecheck', 'build')
         GROUP BY action_category`,
      )
      .all(...activityWhere.parameters)
    const delegationRows = db
      .prepare(
        `SELECT parent_id, COUNT(*) AS child_sessions,
           SUM(active_ms) AS child_active_ms
         FROM sessions
         WHERE parent_id IS NOT NULL AND last_activity_at >= ?
           AND last_activity_at <= ? AND diagnostic = 0
         GROUP BY parent_id ORDER BY child_sessions DESC LIMIT ?`,
      )
      .all(filters.from, filters.to, Math.min(filters.limit, 50))
    return {
      period: { from: filters.from, to: filters.to, days: filters.periodDays },
      filters: {
        sessionId: filters.sessionId,
        agent: filters.agent,
        provider: filters.provider,
        model: filters.model,
        tool: filters.tool,
        configId: filters.configId,
      },
      capture: {
        ...diagnostics,
        liveEventsOnly: true,
        historyTruncated,
        observedCoverage: getCoverage(),
      },
      sessions: {
        count: integerValue(sessionStats?.sessions) ?? 0,
        messages: integerValue(sessionStats?.messages) ?? 0,
        toolCalls: integerValue(sessionStats?.tool_calls) ?? 0,
        failureEvents: integerValue(sessionStats?.errors) ?? 0,
        compactions: integerValue(sessionStats?.compactions) ?? 0,
        interruptions: integerValue(sessionStats?.interruptions) ?? 0,
        observedActiveMs: nullableNumber(sessionStats?.active_ms),
        observedSpanMs: nullableNumber(sessionStats?.observed_span_ms),
        byStatus: statusRows.map((row) => ({
          status: stringValue(row.status) ?? "unknown",
          count: integerValue(row.count) ?? 0,
        })),
      },
      requests: {
        count: integerValue(requestTotal?.request_count) ?? 0,
        retries: integerValue(requestTotal?.retries) ?? 0,
        metrics: publicTokenTotals(requestTotal ?? {}),
      },
      agents: agentRows,
      models: modelRows,
      tools: toolRows.map((row) => ({
        name: stringValue(row.tool_name),
        category: stringValue(row.category),
        calls: integerValue(row.calls) ?? 0,
        succeeded: integerValue(row.succeeded) ?? 0,
        failed: integerValue(row.failed) ?? 0,
        unfinished: integerValue(row.unfinished) ?? 0,
        durationMs: {
          observedAverage: nullableNumber(row.duration_average),
          observedCalls: integerValue(row.duration_known) ?? 0,
        },
        inputBytesObservedAverage: nullableNumber(row.input_bytes_average),
        outputBytesObservedAverage: nullableNumber(row.output_bytes_average),
        sizeCappedCalls:
          (integerValue(row.input_size_capped_calls) ?? 0) +
          (integerValue(row.output_size_capped_calls) ?? 0),
      })),
      toolNameCoverage: {
        totalCalls: totalToolCalls,
        namedCalls: namedToolCalls,
        unnamedCalls: Math.max(0, totalToolCalls - namedToolCalls),
      },
      errors: errorRows.map((row) => ({
        category: stringValue(row.error_category),
        occurrences: integerValue(row.occurrences) ?? 0,
        sessions: integerValue(row.sessions) ?? 0,
      })),
      skills: skillRows.map((row) => ({
        id: stringValue(row.resource_name),
        activations: integerValue(row.activations) ?? 0,
        sessions: integerValue(row.sessions) ?? 0,
      })),
      checks: checkStartRows.map((row) => {
        const outcome = checkEndRows.find(
          (item) => item.action_category === row.action_category,
        )
        return {
        category: stringValue(row.action_category),
        observedCommands: integerValue(row.commands) ?? 0,
        sessions: integerValue(row.sessions) ?? 0,
        observedEnds: integerValue(outcome?.completed) ?? 0,
        failures: integerValue(outcome?.failed) ?? 0,
        timeouts: integerValue(outcome?.timeouts) ?? 0,
        killed: integerValue(outcome?.killed) ?? 0,
        }
      }),
      delegation: delegationRows.map((row) => ({
        parentSessionId: stringValue(row.parent_id),
        childSessions: integerValue(row.child_sessions) ?? 0,
        observedChildActiveMs: nullableNumber(row.child_active_ms),
      })),
    }
  }

  function patterns(input: unknown): JsonRecord {
    const filters = normalizeAnalyzerFilters(input, clock())
    const toolWhere = queryWhere(filters, {
      time: "COALESCE(started_at, ended_at)",
      session: "session_id",
      agent: "agent_name",
      tool: "tool_name",
      config: "config_id",
      diagnostic: "diagnostic",
    })
    const eventWhere = queryWhere(filters, {
      time: "event_at",
      session: "session_id",
      agent: "agent_name",
      error: "error_category",
      config: "config_id",
      diagnostic: "diagnostic",
    })
    const repeated = db
      .prepare(
        `SELECT tool_name, agent_name, args_fingerprint,
           COUNT(*) AS calls, COUNT(DISTINCT session_id) AS sessions,
           MIN(started_at) AS first_at, MAX(started_at) AS last_at,
           GROUP_CONCAT(DISTINCT session_id) AS session_ids
         FROM tool_calls
         WHERE ${toolWhere.sql} AND args_fingerprint IS NOT NULL
         GROUP BY tool_name, agent_name, args_fingerprint
         HAVING COUNT(*) >= 3
         ORDER BY calls DESC LIMIT ?`,
      )
      .all(...toolWhere.parameters, Math.min(filters.limit, 50))
    const failures = db
      .prepare(
        `SELECT tool_name, agent_name, error_category,
           COUNT(*) AS failures, COUNT(DISTINCT session_id) AS sessions,
           GROUP_CONCAT(DISTINCT session_id) AS session_ids
         FROM tool_calls
         WHERE ${toolWhere.sql} AND status = 'failed'
         GROUP BY tool_name, agent_name, error_category
         HAVING COUNT(*) >= 2
         ORDER BY failures DESC LIMIT ?`,
      )
      .all(...toolWhere.parameters, Math.min(filters.limit, 50))
    const cycles = db
      .prepare(
        `WITH ordered AS (
           SELECT session_id, tool_name, agent_name, started_at,
             LAG(tool_name, 1) OVER (
               PARTITION BY session_id ORDER BY started_at, message_id, tool_call_id
             ) AS previous_tool,
             LAG(tool_name, 2) OVER (
               PARTITION BY session_id ORDER BY started_at, message_id, tool_call_id
             ) AS before_previous_tool
           FROM tool_calls
           WHERE ${toolWhere.sql} AND tool_name IS NOT NULL
         )
         SELECT session_id, agent_name, before_previous_tool, previous_tool,
           tool_name, COUNT(*) AS occurrences
         FROM ordered
         WHERE before_previous_tool = tool_name
           AND previous_tool IS NOT NULL
           AND previous_tool != tool_name
         GROUP BY session_id, agent_name, before_previous_tool, previous_tool, tool_name
         ORDER BY occurrences DESC LIMIT ?`,
      )
      .all(...toolWhere.parameters, Math.min(filters.limit, 50))
    const compactions = db
      .prepare(
        `SELECT session_id, COUNT(*) AS occurrences,
           MIN(event_at) AS first_at, MAX(event_at) AS last_at
         FROM events WHERE ${eventWhere.sql}
           AND type = 'session.compaction.started'
         GROUP BY session_id HAVING COUNT(*) >= 2
         ORDER BY occurrences DESC LIMIT ?`,
      )
      .all(...eventWhere.parameters, Math.min(filters.limit, 50))
    const errors = db
      .prepare(
        `SELECT error_category, COUNT(*) AS occurrences,
           COUNT(DISTINCT session_id) AS sessions,
           GROUP_CONCAT(DISTINCT session_id) AS session_ids
         FROM events WHERE ${eventWhere.sql} AND error_category IS NOT NULL
         GROUP BY error_category HAVING COUNT(*) >= 2
         ORDER BY occurrences DESC LIMIT ?`,
      )
      .all(...eventWhere.parameters, Math.min(filters.limit, 50))
    const delegations = db
      .prepare(
        `SELECT parent_id, COUNT(*) AS child_sessions,
           GROUP_CONCAT(session_id) AS child_ids
         FROM sessions
         WHERE parent_id IS NOT NULL AND last_activity_at >= ?
           AND last_activity_at <= ? AND diagnostic = 0
         GROUP BY parent_id HAVING COUNT(*) >= 2
         ORDER BY child_sessions DESC LIMIT ?`,
      )
      .all(filters.from, filters.to, Math.min(filters.limit, 50))
    return {
      period: { from: filters.from, to: filters.to, days: filters.periodDays },
      repeatedArgumentShapes: repeated.map((row) => ({
        tool: stringValue(row.tool_name),
        agent: stringValue(row.agent_name),
        occurrences: integerValue(row.calls) ?? 0,
        sessions: integerValue(row.sessions) ?? 0,
        firstAt: integerValue(row.first_at),
        lastAt: integerValue(row.last_at),
        sessionIds: stringValue(row.session_ids, 500)?.split(",").slice(0, 10) ?? [],
        fingerprint: stringValue(row.args_fingerprint, 64),
        note: "The fingerprint covers argument structure, not argument values.",
      })),
      repeatedFailures: failures.map((row) => ({
        tool: stringValue(row.tool_name),
        agent: stringValue(row.agent_name),
        category: stringValue(row.error_category),
        occurrences: integerValue(row.failures) ?? 0,
        sessions: integerValue(row.sessions) ?? 0,
        sessionIds: stringValue(row.session_ids, 500)?.split(",").slice(0, 10) ?? [],
      })),
      possibleCycles: cycles.map((row) => ({
        sessionId: stringValue(row.session_id),
        agent: stringValue(row.agent_name),
        sequence: [
          stringValue(row.before_previous_tool),
          stringValue(row.previous_tool),
          stringValue(row.tool_name),
        ],
        occurrences: integerValue(row.occurrences) ?? 0,
      })),
      frequentCompaction: compactions.map((row) => ({
        sessionId: stringValue(row.session_id),
        occurrences: integerValue(row.occurrences) ?? 0,
        firstAt: integerValue(row.first_at),
        lastAt: integerValue(row.last_at),
      })),
      repeatedErrorCategories: errors.map((row) => ({
        category: stringValue(row.error_category),
        occurrences: integerValue(row.occurrences) ?? 0,
        sessions: integerValue(row.sessions) ?? 0,
        sessionIds: stringValue(row.session_ids, 500)?.split(",").slice(0, 10) ?? [],
      })),
      repeatedDelegation: delegations.map((row) => ({
        parentSessionId: stringValue(row.parent_id),
        childSessions: integerValue(row.child_sessions) ?? 0,
        childSessionIds: stringValue(row.child_ids, 500)?.split(",").slice(0, 10) ?? [],
      })),
      limits: {
        exactToolArgumentsStored: false,
        exactToolOutputStored: false,
        exactPromptOrResponseStored: false,
      },
    }
  }

  function details(input: unknown): JsonRecord {
    const source = record(input)
    const filters = normalizeAnalyzerFilters(input, clock())
    const kind = stringValue(source.kind, 40) ?? "session"
    const id = safeFilterString(source.id)
    const limit = filters.limit

    if (kind === "config") {
      const rows = id
        ? db
            .prepare(
              `SELECT id, fingerprint, captured_at, opencode_version,
                 summary_json, files_json
               FROM config_versions
               WHERE project_id = ? AND captured_at >= ? AND captured_at <= ?
                 AND (fingerprint = ? OR CAST(id AS TEXT) = ?)
               ORDER BY captured_at DESC LIMIT ?`,
            )
            .all(projectId, filters.from, filters.to, id, id, limit)
        : db
            .prepare(
              `SELECT id, fingerprint, captured_at, opencode_version,
                 summary_json, files_json
               FROM config_versions
               WHERE project_id = ? AND captured_at >= ? AND captured_at <= ?
               ORDER BY captured_at DESC LIMIT ?`,
            )
            .all(projectId, filters.from, filters.to, limit)
      return {
        kind,
        versions: rows.map((row) => ({
          id: integerValue(row.id),
          fingerprint: stringValue(row.fingerprint, 64),
          capturedAt: integerValue(row.captured_at),
          openCodeVersion: stringValue(row.opencode_version),
          summary: safeJsonParse(row.summary_json),
          files: safeJsonParse(row.files_json),
        })),
      }
    }

    if (kind === "session") {
      const sessionId = filters.sessionId ?? id
      if (!sessionId) return { kind, session: null, events: [] }
      const session = db
        .prepare(
          `SELECT session_id, project_id, parent_id, created_at, last_activity_at,
             active_ms, status, agent_name, model_provider, model_id, model_variant,
             message_count, tool_count, error_count, compaction_count,
             interruption_count, diagnostic, config_id
           FROM sessions WHERE session_id = ?`,
        )
        .get(sessionId)
      const events = db
        .prepare(
          `SELECT event_id, event_at, type, session_id, message_id, agent_name, provider, model,
             tool_call_id, tool_name, action_category, resource_name, status, error_category,
             details_json, config_id
           FROM events WHERE session_id = ? AND event_at >= ? AND event_at <= ?
             AND diagnostic = 0
           ORDER BY event_at DESC LIMIT ?`,
        )
        .all(sessionId, filters.from, filters.to, limit)
      return {
        kind,
        session: session ? safeSessionRow(session) : null,
        events: events.map(safeEventRow),
      }
    }

    if (kind === "agent") {
      const agent = filters.agent ?? id
      if (!agent) return { kind, agent: null, runs: [] }
      const where = queryWhere({ ...filters, agent }, {
        time: "COALESCE(started_at, ended_at)",
        session: "session_id",
        agent: "agent_name",
        config: "config_id",
        diagnostic: "diagnostic",
      })
      const rows = db
        .prepare(
          `SELECT session_id, message_id, agent_name, model_provider, model_id,
             started_at, first_token_at, ended_at, duration_ms, status, retry_count,
             tool_calls, error_count, input_tokens, output_tokens, reasoning_tokens,
             cache_read_tokens, cache_write_tokens, cost, config_id
           FROM agent_runs WHERE ${where.sql}
           ORDER BY started_at DESC LIMIT ?`,
        )
        .all(...where.parameters, limit)
      return { kind, agent, runs: rows.map(safeAgentRunRow) }
    }

    if (kind === "model") {
      const requestedModel = filters.model ?? id
      const separator = requestedModel?.indexOf("/") ?? -1
      const provider =
        filters.provider ??
        (separator > 0 ? requestedModel?.slice(0, separator) ?? null : null)
      const model =
        separator > 0 && filters.provider === null
          ? requestedModel?.slice(separator + 1) ?? null
          : requestedModel
      const where = queryWhere({ ...filters, model, provider }, {
        time: "COALESCE(started_at, ended_at)",
        session: "session_id",
        agent: "agent_name",
        provider: "provider",
        model: "model",
        config: "config_id",
        diagnostic: "diagnostic",
      })
      const rows = db
        .prepare(
          `SELECT request_id, session_id, message_id, source, agent_name, provider,
             model, variant, started_at, ended_at, duration_ms, status, retry_count,
             input_tokens, output_tokens, reasoning_tokens, cache_read_tokens,
             cache_write_tokens, cost, config_id
           FROM model_requests WHERE ${where.sql}
           ORDER BY COALESCE(started_at, ended_at) DESC LIMIT ?`,
        )
        .all(...where.parameters, limit)
      return { kind, provider, model, requests: rows.map(safeModelRequestRow) }
    }

    if (kind === "tool") {
      const tool = filters.tool ?? id
      const where = queryWhere({ ...filters, tool }, {
        time: "COALESCE(started_at, ended_at)",
        session: "session_id",
        agent: "agent_name",
        tool: "tool_name",
        config: "config_id",
        diagnostic: "diagnostic",
      })
      const rows = db
        .prepare(
          `SELECT session_id, message_id, tool_call_id, tool_name, category,
             agent_name, started_at, ended_at, duration_ms, status, error_category,
              retry_count, args_fingerprint, input_bytes, output_bytes,
              input_size_capped, output_size_capped, config_id
           FROM tool_calls WHERE ${where.sql}
           ORDER BY COALESCE(started_at, ended_at) DESC LIMIT ?`,
        )
        .all(...where.parameters, limit)
      return { kind, tool, calls: rows.map(safeToolCallRow) }
    }

    if (kind === "error") {
      const category = filters.errorCategory ?? id
      const where = queryWhere({ ...filters, errorCategory: category }, {
        time: "event_at",
        session: "session_id",
        agent: "agent_name",
        error: "error_category",
        config: "config_id",
        diagnostic: "diagnostic",
      })
      const rows = db
        .prepare(
          `SELECT event_id, event_at, type, session_id, message_id, agent_name,
             tool_name, action_category, resource_name, status, error_category,
             details_json, config_id
           FROM events WHERE ${where.sql}
           ORDER BY event_at DESC LIMIT ?`,
        )
        .all(...where.parameters, limit)
      return { kind, category, events: rows.map(safeEventRow) }
    }

    if (kind === "pattern") return { kind, patterns: patterns(input) }
    return { kind, error: "unsupported_detail_kind" }
  }

  function getStatus(): { historyTruncated: boolean } {
    return { historyTruncated }
  }

  function getCoverage(): JsonRecord {
    const row = db
      .prepare(
        `SELECT MIN(event_at) AS first_event_at, MAX(event_at) AS last_event_at,
           COUNT(*) AS event_count
         FROM events WHERE diagnostic = 0`,
      )
      .get()
    return {
      firstEventAt: integerValue(row?.first_event_at),
      lastEventAt: integerValue(row?.last_event_at),
      eventCount: integerValue(row?.event_count) ?? 0,
    }
  }

  backfillToolNames()
  return {
    recordConfig,
    recordEvent,
    summary,
    patterns,
    details,
    prune,
    getStatus,
    getCoverage,
  }
}

type AnalyzerStore = ReturnType<typeof createAnalyzerStore>

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== "string") return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function safeSessionRow(row: SqlRow): JsonRecord {
  return {
    sessionId: stringValue(row.session_id),
    projectId: stringValue(row.project_id),
    parentId: stringValue(row.parent_id),
    createdAt: integerValue(row.created_at),
    lastActivityAt: integerValue(row.last_activity_at),
    activeMs: integerValue(row.active_ms),
    status: stringValue(row.status),
    agent: stringValue(row.agent_name),
    model: {
      provider: stringValue(row.model_provider),
      id: stringValue(row.model_id),
      variant: stringValue(row.model_variant),
    },
    messages: integerValue(row.message_count) ?? 0,
    toolCalls: integerValue(row.tool_count) ?? 0,
    failureEvents: integerValue(row.error_count) ?? 0,
    compactions: integerValue(row.compaction_count) ?? 0,
    interruptions: integerValue(row.interruption_count) ?? 0,
    diagnostic: integerValue(row.diagnostic) === 1,
    configId: integerValue(row.config_id),
  }
}

function safeEventRow(row: SqlRow): JsonRecord {
  return {
    eventId: stringValue(row.event_id),
    timestamp: integerValue(row.event_at),
    type: stringValue(row.type),
    sessionId: stringValue(row.session_id),
    messageId: stringValue(row.message_id),
    agent: stringValue(row.agent_name),
    provider: stringValue(row.provider),
    model: stringValue(row.model),
    toolCallId: stringValue(row.tool_call_id),
    tool: stringValue(row.tool_name),
    category: stringValue(row.action_category),
    resource: stringValue(row.resource_name),
    status: stringValue(row.status),
    errorCategory: stringValue(row.error_category),
    details: safeJsonParse(row.details_json),
    configId: integerValue(row.config_id),
  }
}

function safeAgentRunRow(row: SqlRow): JsonRecord {
  return {
    sessionId: stringValue(row.session_id),
    messageId: stringValue(row.message_id),
    agent: stringValue(row.agent_name),
    model: {
      provider: stringValue(row.model_provider),
      id: stringValue(row.model_id),
    },
    startedAt: integerValue(row.started_at),
    firstTokenAt: integerValue(row.first_token_at),
    endedAt: integerValue(row.ended_at),
    durationMs: integerValue(row.duration_ms),
    status: stringValue(row.status),
    retries: integerValue(row.retry_count) ?? 0,
    toolCalls: integerValue(row.tool_calls) ?? 0,
    failureEvents: integerValue(row.error_count) ?? 0,
    metrics: {
      inputTokens: nullableNumber(row.input_tokens),
      outputTokens: nullableNumber(row.output_tokens),
      reasoningTokens: nullableNumber(row.reasoning_tokens),
      cacheReadTokens: nullableNumber(row.cache_read_tokens),
      cacheWriteTokens: nullableNumber(row.cache_write_tokens),
      cost: nullableNumber(row.cost),
    },
    configId: integerValue(row.config_id),
  }
}

function safeModelRequestRow(row: SqlRow): JsonRecord {
  return {
    source: stringValue(row.source),
    sessionId: stringValue(row.session_id),
    messageId: stringValue(row.message_id),
    agent: stringValue(row.agent_name),
    provider: stringValue(row.provider),
    model: stringValue(row.model),
    variant: stringValue(row.variant),
    startedAt: integerValue(row.started_at),
    endedAt: integerValue(row.ended_at),
    durationMs: integerValue(row.duration_ms),
    status: stringValue(row.status),
    retries: integerValue(row.retry_count) ?? 0,
    metrics: {
      inputTokens: nullableNumber(row.input_tokens),
      outputTokens: nullableNumber(row.output_tokens),
      reasoningTokens: nullableNumber(row.reasoning_tokens),
      cacheReadTokens: nullableNumber(row.cache_read_tokens),
      cacheWriteTokens: nullableNumber(row.cache_write_tokens),
      cost: nullableNumber(row.cost),
    },
    configId: integerValue(row.config_id),
  }
}

function safeToolCallRow(row: SqlRow): JsonRecord {
  return {
    sessionId: stringValue(row.session_id),
    messageId: stringValue(row.message_id),
    callId: stringValue(row.tool_call_id),
    tool: stringValue(row.tool_name),
    category: stringValue(row.category),
    agent: stringValue(row.agent_name),
    startedAt: integerValue(row.started_at),
    endedAt: integerValue(row.ended_at),
    durationMs: integerValue(row.duration_ms),
    status: stringValue(row.status),
    errorCategory: stringValue(row.error_category),
    retryCount: integerValue(row.retry_count),
    argumentShapeFingerprint: stringValue(row.args_fingerprint, 64),
    inputBytes: integerValue(row.input_bytes),
    outputBytes: integerValue(row.output_bytes),
    inputSizeCapped: integerValue(row.input_size_capped) === 1,
    outputSizeCapped: integerValue(row.output_size_capped) === 1,
    configId: integerValue(row.config_id),
  }
}

async function openPersistentDatabase(): Promise<{
  db: SqlDatabase
  walEnabled: boolean
}> {
  const path = getAnalyzerDatabasePath()
  await mkdir(dirname(path), { recursive: true })
  const sqlite = (await import("bun:sqlite")) as {
    Database: new (
      path: string,
      options?: { create?: boolean; readwrite?: boolean; strict?: boolean },
    ) => SqlDatabase
  }
  const db = new sqlite.Database(path, {
    create: true,
    readwrite: true,
    strict: true,
  })
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`)
  db.exec("PRAGMA foreign_keys = ON")
  db.exec("PRAGMA auto_vacuum = INCREMENTAL")
  db.exec("PRAGMA journal_size_limit = 16777216")
  let walEnabled = false
  try {
    const result = db.prepare("PRAGMA journal_mode = WAL").get()
    walEnabled = stringValue(result?.journal_mode)?.toLowerCase() === "wal"
  } catch {
    walEnabled = false
  }
  return { db, walEnabled }
}

function responseData(value: unknown): unknown {
  const source = record(value)
  return Object.prototype.hasOwnProperty.call(source, "data") ? source.data : value
}

function responseArray(value: unknown): JsonRecord[] {
  const data = responseData(value)
  return Array.isArray(data) ? data.map(record) : []
}

async function safeCall<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation()
  } catch {
    return null
  }
}

function relativeSafePath(root: string, path: string): string | null {
  const fullPath = resolve(path)
  const rel = relative(root, fullPath)
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || resolve(root, rel) !== fullPath) {
    return null
  }
  return rel.split(sep).join("/")
}

async function collectConfigFiles(root: string): Promise<
  Array<{ path: string; hash: string; bytes: number; settings?: JsonRecord }>
> {
  const paths = new Set<string>([
    "AGENTS.md",
    "opencode.json",
    "opencode.jsonc",
    ".opencode/AGENTS.md",
    ".opencode/opencode.json",
    ".opencode/opencode.jsonc",
    ".opencode/plugins/analyzer/index.ts",
    ".opencode/plugins/hooks/hooks.yml",
  ])
  let visitedDirectories = 0

  async function visit(directory: string, depth: number): Promise<void> {
    if (
      depth > 8 ||
      paths.size >= MAX_CONFIG_FILES ||
      visitedDirectories >= 2000
    ) {
      return
    }
    visitedDirectories += 1
    let entries: Awaited<ReturnType<typeof readdir>>
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (paths.size >= MAX_CONFIG_FILES) return
      const fullPath = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_CONFIG_SCAN_DIRECTORIES.has(entry.name)) continue
        await visit(fullPath, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      if (entry.name === "AGENTS.md") {
        const safe = relativeSafePath(root, fullPath)
        if (safe) paths.add(safe)
      }
      if (entry.name === "opencode.json" || entry.name === "opencode.jsonc") {
        const safe = relativeSafePath(root, fullPath)
        if (safe) paths.add(safe)
      }
      if (
        directory.includes(`${sep}.opencode${sep}agents`) &&
        entry.name.endsWith(".md")
      ) {
        const safe = relativeSafePath(root, fullPath)
        if (safe) paths.add(safe)
      }
      if (
        directory.includes(`${sep}.opencode${sep}skills`) &&
        entry.name.endsWith(".md")
      ) {
        const safe = relativeSafePath(root, fullPath)
        if (safe) paths.add(safe)
      }
      if (
        directory.endsWith(`${sep}.opencode${sep}plugins${sep}analyzer`) &&
        entry.name === "index.ts"
      ) {
        const safe = relativeSafePath(root, fullPath)
        if (safe) paths.add(safe)
      }
      if (
        directory.endsWith(`${sep}.opencode${sep}plugins${sep}hooks`) &&
        entry.name === "hooks.yml"
      ) {
        const safe = relativeSafePath(root, fullPath)
        if (safe) paths.add(safe)
      }
    }
  }

  await visit(resolve(root), 0)

  const result: Array<{
    path: string
    hash: string
    bytes: number
    settings?: JsonRecord
  }> = []
  for (const candidate of [...paths].slice(0, MAX_CONFIG_FILES).sort()) {
    const fullPath = resolve(root, candidate)
    try {
      const content = await readFile(fullPath)
      if (content.byteLength > MAX_CONFIG_FILE_BYTES) continue
      result.push({
        path: candidate,
        hash: createHash("sha256").update(content).digest("hex"),
        bytes: content.byteLength,
        ...(candidate === "opencode.json" ||
        candidate === "opencode.jsonc" ||
        candidate.endsWith("/opencode.json") ||
        candidate.endsWith("/opencode.jsonc")
          ? { settings: safeConfigFileSummary(content.toString("utf8")) }
          : {}),
      })
    } catch {
      continue
    }
  }
  return result
}

function safeModelSummary(model: JsonRecord): JsonRecord {
  const limit = record(model.limit)
  const capabilities = record(model.capabilities)
  return {
    provider: stringValue(model.providerID),
    id: stringValue(model.id),
    contextLimit: integerValue(limit.context),
    outputLimit: integerValue(limit.output),
    supportsTools: typeof capabilities.tools === "boolean" ? capabilities.tools : null,
    generation: safeGenerationSettings(model.settings, model.body),
  }
}

function safeGenerationSettings(...sources: unknown[]): JsonRecord {
  const numbers = [
    "temperature",
    "topP",
    "topK",
    "frequencyPenalty",
    "presencePenalty",
    "maxTokens",
    "seed",
    "reasoningBudget",
    "reasoningBudgetTokens",
  ]
  const enums: Record<string, readonly string[]> = {
    reasoningEffort: ["none", "minimal", "low", "medium", "high", "max"],
    reasoningSummary: ["auto", "concise", "detailed", "none"],
    verbosity: ["low", "medium", "high"],
    serviceTier: ["auto", "default", "flex", "priority", "scale"],
  }
  const result: JsonRecord = {}
  for (const source of sources) {
    const settings = record(source)
    for (const key of numbers) {
      const value = settings[key]
      if (typeof value === "number" && Number.isFinite(value)) {
        result[key] = value
      }
    }
    for (const [key, allowed] of Object.entries(enums)) {
      const value = settings[key]
      if (typeof value === "string" && allowed.includes(value)) result[key] = value
    }
  }
  return result
}

function stripJsonComments(source: string): string {
  let result = ""
  let quoted = false
  let escaped = false
  let lineComment = false
  let blockComment = false
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]
    const next = source[index + 1]
    if (lineComment) {
      if (current === "\n") {
        result += "\n"
        lineComment = false
      } else {
        result += " "
      }
      continue
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        result += "  "
        index += 1
        blockComment = false
      } else {
        result += current === "\n" ? "\n" : " "
      }
      continue
    }
    if (quoted) {
      result += current
      if (escaped) escaped = false
      else if (current === "\\") escaped = true
      else if (current === '"') quoted = false
      continue
    }
    if (current === '"') {
      quoted = true
      result += current
    } else if (current === "/" && next === "/") {
      result += "  "
      index += 1
      lineComment = true
    } else if (current === "/" && next === "*") {
      result += "  "
      index += 1
      blockComment = true
    } else {
      result += current
    }
  }
  return result
}

function parseJsonc(source: string): JsonRecord | null {
  const uncommented = stripJsonComments(source)
  let result = ""
  let quoted = false
  let escaped = false
  for (let index = 0; index < uncommented.length; index += 1) {
    const current = uncommented[index]
    if (quoted) {
      result += current
      if (escaped) escaped = false
      else if (current === "\\") escaped = true
      else if (current === '"') quoted = false
      continue
    }
    if (current === '"') {
      quoted = true
      result += current
      continue
    }
    if (current === ",") {
      let next = index + 1
      while (next < uncommented.length && /\s/.test(uncommented[next])) next += 1
      result += next < uncommented.length && /[}\]]/.test(uncommented[next])
        ? " "
        : current
      continue
    }
    result += current
  }
  try {
    return record(JSON.parse(result))
  } catch {
    return null
  }
}

function configModelSummary(value: unknown): JsonRecord | null {
  if (typeof value === "string") {
    const [selector, variant] = value.split("#", 2)
    const separator = selector.indexOf("/")
    if (separator < 1 || separator >= selector.length - 1) return null
    return {
      provider: selector.slice(0, separator),
      id: selector.slice(separator + 1),
      variant: variant ?? null,
    }
  }
  const model = modelReference(value)
  return model.provider && model.model
    ? { provider: model.provider, id: model.model, variant: model.variant }
    : null
}

function permissionSummary(value: unknown): JsonRecord {
  const permissions = Array.isArray(value) ? value : []
  const actionEffects: Record<string, number> = {}
  for (const permission of permissions) {
    const rule = record(permission)
    const action = stringValue(rule.action, 80)
    const effect = stringValue(rule.effect, 20)
    if (!action || !effect) continue
    const key = `${action}:${effect}`
    actionEffects[key] = (actionEffects[key] ?? 0) + 1
  }
  return { ruleCount: permissions.length, actionEffects }
}

function safeConfigFileSummary(source: string): JsonRecord {
  const config = parseJsonc(source)
  if (!config) return { parseStatus: "unavailable" }
  const compaction = record(config.compaction)
  const keep = record(compaction.keep)
  const buffer = compaction.buffer
  const safeBuffer =
    typeof buffer === "number" && Number.isFinite(buffer)
      ? buffer
      : typeof buffer === "string" &&
          /^(?:\d+(?:\.\d+)?%?|\d+(?:\.\d+)?\s?(?:ms|s|m|h|d))$/i.test(buffer)
        ? buffer
        : null
  const providerModels: JsonRecord[] = []
  const providers = record(config.providers)
  let providerModelsTruncated = Object.keys(providers).length > 100
  for (const [providerId, providerValue] of Object.entries(providers).slice(0, 100)) {
    const provider = record(providerValue)
    const models = record(provider.models)
    const entries = Object.entries(models)
    if (entries.length > 100) providerModelsTruncated = true
    for (const [modelId, modelValue] of entries.slice(0, 100)) {
      const model = record(modelValue)
      const limit = record(model.limit)
      providerModels.push({
        provider: providerId.slice(0, 100),
        id: stringValue(model.id ?? modelId, 120),
        contextLimit: integerValue(limit.context),
        outputLimit: integerValue(limit.output),
        generation: safeGenerationSettings(
          provider.settings,
          model.settings,
          model.body,
        ),
      })
    }
  }
  const agents: JsonRecord[] = []
  const agentEntries = Object.entries(record(config.agents))
  for (const [agentId, agentValue] of agentEntries.slice(0, 100)) {
    const agent = record(agentValue)
    const request = record(agent.request)
    agents.push({
      id: agentId.slice(0, 100),
      mode: stringValue(agent.mode, 20),
      model: configModelSummary(agent.model),
      steps: integerValue(agent.steps),
      generation: safeGenerationSettings(request, request.body),
      permissions: permissionSummary(agent.permissions),
    })
  }
  const mcpServerNames = Object.keys(record(record(config.mcp).servers))
    .slice(0, 100)
    .map((name) => name.slice(0, 100))
    .sort()
  const instructions = config.instructions
  const instructionSourceCount = Array.isArray(instructions)
    ? instructions.length
    : typeof instructions === "string"
      ? 1
      : 0
  return {
    parseStatus: "parsed",
    defaultAgent: stringValue(config.default_agent, 100),
    model: configModelSummary(config.model),
    compaction: {
      auto: typeof compaction.auto === "boolean" ? compaction.auto : null,
      buffer: safeBuffer,
      keepTokens: integerValue(keep.tokens),
    },
    permissions: permissionSummary(config.permissions),
    agents,
    agentsTruncated: agentEntries.length > agents.length,
    providerModels: providerModels.slice(0, 200),
    providerModelsTruncated:
      providerModelsTruncated || providerModels.length > 200,
    mcpServerNames,
    mcpServerNamesTruncated:
      Object.keys(record(record(config.mcp).servers)).length > mcpServerNames.length,
    pluginCount: Array.isArray(config.plugins) ? config.plugins.length : null,
    skillSourceCount: Array.isArray(config.skills) ? config.skills.length : null,
    instructionSourceCount,
  }
}

function safeAgentSummary(agent: JsonRecord): JsonRecord {
  const permissions = Array.isArray(agent.permissions) ? agent.permissions : []
  const request = record(agent.request)
  const counts: Record<string, number> = {}
  for (const permission of permissions) {
    const action = stringValue(record(permission).action, 60)
    if (action) counts[action] = (counts[action] ?? 0) + 1
  }
  return {
    id: stringValue(agent.id),
    mode: stringValue(agent.mode, 20),
    model: safeModelSummary(record(agent.model)),
    steps: integerValue(agent.steps),
    generation: safeGenerationSettings(request, request.body),
    permissionRuleCount: permissions.length,
    permissionActionCounts: counts,
  }
}

export async function captureConfigSnapshot(
  ctx: AnalyzerPluginContext,
  projectId: string,
  projectRoot: string,
): Promise<SafeConfigSnapshot> {
  const [agentsResult, modelsResult, defaultResult, skillsResult, mcpResult, pluginsResult] =
    await Promise.all([
      safeCall(() => ctx.agent.list()),
      safeCall(() => ctx.model.list()),
      safeCall(() => ctx.model.default()),
      safeCall(() => ctx.skill.list()),
      safeCall(() => ctx.mcp.list()),
      safeCall(() => ctx.plugin.list()),
    ])
  const agents = responseArray(agentsResult)
  const models = responseArray(modelsResult)
  const skills = responseArray(skillsResult)
  const mcp = responseArray(mcpResult)
  const plugins = responseArray(pluginsResult)
  const defaultModel = record(responseData(defaultResult))
  const safeAgents = agents
    .map(safeAgentSummary)
    .filter((item) => item.id !== null)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .slice(0, 100)
  const safeModels = models
    .map(safeModelSummary)
    .filter((item) => item.id !== null)
    .sort((left, right) =>
      `${left.provider}/${left.id}`.localeCompare(`${right.provider}/${right.id}`),
    )
    .slice(0, 200)
  const safeSkills = skills
    .map((skill) => stringValue(skill.id, 100))
    .filter((item): item is string => item !== null)
    .sort()
    .slice(0, 200)
  const safeMcp = mcp
    .map((server) => ({
      name: stringValue(server.name, 100),
      status: stringValue(record(server.status).status ?? server.status, 40),
    }))
    .filter((item) => item.name !== null)
    .sort((left, right) => String(left.name).localeCompare(String(right.name)))
    .slice(0, 100)
  const safePlugins = plugins
    .map((plugin) => ({
      id: stringValue(plugin.id, 120),
      status: stringValue(record(plugin.state).status, 40),
    }))
    .filter((item) => item.id !== null)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .slice(0, 100)
  const agentFingerprints = agents
    .map((agent) => ({
      id: stringValue(agent.id, 100),
      instructions: hashText(stringValue(agent.system, 200_000) ?? ""),
      permissions: hashText(jsonString(agent.permissions ?? [])),
    }))
    .filter((item) => item.id !== null)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .slice(0, 100)
  const skillFingerprints = skills
    .map((skill) => ({
      id: stringValue(skill.id, 100),
      content: hashText(stringValue(skill.content, 200_000) ?? ""),
    }))
    .filter((item) => item.id !== null)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .slice(0, 200)
  const files = await collectConfigFiles(projectRoot)
  const summary: JsonRecord = {
    projectId,
    openCodeVersion: stringValue(ctx.app?.version, 80),
    defaultModel: {
      provider: stringValue(defaultModel.providerID),
      id: stringValue(defaultModel.id),
      variant: stringValue(defaultModel.variant),
    },
    models: safeModels,
    agents: safeAgents,
    skills: safeSkills,
    mcp: safeMcp,
    plugins: safePlugins,
    inventoryTruncated: {
      agents: agents.length > safeAgents.length,
      models: models.length > safeModels.length,
      skills: skills.length > safeSkills.length,
      mcp: mcp.length > safeMcp.length,
      plugins: plugins.length > safePlugins.length,
      agentFingerprints: agents.length > agentFingerprints.length,
      skillFingerprints: skills.length > skillFingerprints.length,
      files: files.length >= MAX_CONFIG_FILES,
    },
    instructionFingerprints: agentFingerprints,
    skillFingerprints,
  }
  const fingerprint = hashText(jsonString({ summary, files }))
  return {
    capturedAt: Date.now(),
    fingerprint,
    version: stringValue(ctx.app?.version, 80),
    summary,
    files,
  }
}

function pathIsWithin(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path))
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`))
}

function isRelevantConfigPath(root: string, path: string): boolean {
  const safe = relativeSafePath(root, path)
  if (!safe) return false
  return (
    safe === "AGENTS.md" ||
    safe.endsWith("/AGENTS.md") ||
    safe === "opencode.json" ||
    safe === "opencode.jsonc" ||
    safe.endsWith("/opencode.json") ||
    safe.endsWith("/opencode.jsonc") ||
    safe === ".opencode/AGENTS.md" ||
    safe === ".opencode/opencode.json" ||
    safe === ".opencode/opencode.jsonc" ||
      safe.startsWith(".opencode/agents/") ||
      safe.startsWith(".opencode/skills/") ||
      safe === ".opencode/plugins/analyzer/index.ts" ||
      safe === ".opencode/plugins/hooks/hooks.yml"
  )
}

function eventInProject(
  value: unknown,
  projectId: string,
  projectRoots: readonly string[],
): boolean {
  const source = record(value)
  const data = record(source.data)
  const eventProjectId = stringValue(data.projectID)
  if (eventProjectId) return eventProjectId === projectId
  const location = stringValue(record(source.location).directory, 2000)
  if (!location) return false
  return projectRoots.some((root) => pathIsWithin(root, location))
}

function errorLabel(error: unknown): string {
  const value = record(error)
  return errorCategory({ type: value.name, message: value.message }) ?? "unknown"
}

function toolInputSchema(properties: JsonRecord): JsonRecord {
  return {
    type: "object",
    properties,
    additionalProperties: false,
  }
}

const commonProperties = {
  period_days: { type: "integer", minimum: 1, maximum: 365 },
  from: { type: "integer", minimum: 0 },
  to: { type: "integer", minimum: 0 },
  session_id: { type: "string", maxLength: 200 },
  agent: { type: "string", maxLength: 100 },
  provider: { type: "string", maxLength: 100 },
  model: { type: "string", maxLength: 200 },
  tool: { type: "string", maxLength: 120 },
  error_category: { type: "string", maxLength: 40 },
  config_id: { type: "integer", minimum: 1 },
  limit: { type: "integer", minimum: 1, maximum: 100 },
}

function jsonToolResult(value: unknown): { content: string } {
  return { content: jsonString(value) }
}

export function createAnalyzerToolDefinitions(
  getStore: () => AnalyzerStore | null,
  diagnostics: AnalyzerDiagnostics,
  onFailure: (category: string) => void,
): ToolDefinition[] {
  return [
    {
      name: "summary",
      description:
        "Read aggregated Analyzer metrics for a period. Returns counts, observed token, cost, duration, tool, error, compaction, and delegation data, including tool-name coverage.",
      input: toolInputSchema(commonProperties),
      options: { namespace: "analyzer", codemode: false },
      execute: async (input, context) => {
        if (context.agent !== ANALYZER_ID) {
          return jsonToolResult({ error: "analyzer_agent_only" })
        }
        const store = getStore()
        if (!store) {
          return jsonToolResult({
            error: "analyzer_database_unavailable",
            capture: diagnostics,
          })
        }
        try {
          diagnostics.historyTruncated = store.getStatus().historyTruncated
          return jsonToolResult(store.summary(input, diagnostics))
        } catch (error) {
          onFailure(errorLabel(error))
          return jsonToolResult({
            error: "analyzer_query_failed",
            category: diagnostics.lastErrorCategory,
            capture: diagnostics,
          })
        }
      },
    },
    {
      name: "patterns",
      description:
        "Read bounded, SQL-aggregated behavior patterns such as repeated argument shapes, tool cycles, repeated failures, compactions, and delegation.",
      input: toolInputSchema(commonProperties),
      options: { namespace: "analyzer", codemode: false },
      execute: async (input, context) => {
        if (context.agent !== ANALYZER_ID) {
          return jsonToolResult({ error: "analyzer_agent_only" })
        }
        const store = getStore()
        if (!store) {
          return jsonToolResult({
            error: "analyzer_database_unavailable",
            capture: diagnostics,
          })
        }
        try {
          return jsonToolResult(store.patterns(input))
        } catch (error) {
          onFailure(errorLabel(error))
          return jsonToolResult({
            error: "analyzer_query_failed",
            category: diagnostics.lastErrorCategory,
            capture: diagnostics,
          })
        }
      },
    },
    {
      name: "details",
      description:
        "Read limited, redacted event details for a session, agent, model, tool, error, configuration version, or pattern. Never returns prompts, responses, arguments, source contents, or raw errors.",
      input: toolInputSchema({
        ...commonProperties,
        kind: {
          type: "string",
          enum: ["session", "agent", "model", "tool", "error", "config", "pattern"],
        },
        id: { type: "string", maxLength: 200 },
      }),
      options: { namespace: "analyzer", codemode: false },
      execute: async (input, context) => {
        if (context.agent !== ANALYZER_ID) {
          return jsonToolResult({ error: "analyzer_agent_only" })
        }
        const store = getStore()
        if (!store) {
          return jsonToolResult({
            error: "analyzer_database_unavailable",
            capture: diagnostics,
          })
        }
        try {
          return jsonToolResult(store.details(input))
        } catch (error) {
          onFailure(errorLabel(error))
          return jsonToolResult({
            error: "analyzer_query_failed",
            category: diagnostics.lastErrorCategory,
            capture: diagnostics,
          })
        }
      },
    },
  ]
}

export default {
  id: ANALYZER_ID,
  async setup(ctx: AnalyzerPluginContext) {
    const startedAt = Date.now()
    const projectId = stringValue(ctx.location.project?.id, 200) ?? "unknown-project"
    const pluginDirectory = dirname(fileURLToPath(import.meta.url))
    const projectRoot =
      stringValue(ctx.location.project?.canonical, 2000) ??
      stringValue(ctx.location.project?.directory, 2000) ??
      resolve(pluginDirectory, "..", "..", "..")
    const projectRoots = [
      projectRoot,
      stringValue(ctx.location.directory, 2000),
    ].filter((item): item is string => item !== null)
    const diagnostics: AnalyzerDiagnostics = {
      database: "unavailable",
      capture: "starting",
      lostEvents: 0,
      lastErrorCategory: null,
      walEnabled: false,
      startedAt,
      historyTruncated: false,
    }
    let db: SqlDatabase | null = null
    let store: ReturnType<typeof createAnalyzerStore> | null = null
    let configId: number | null = null
    let mcpServers: string[] = []
    let configRefreshTimer: ReturnType<typeof setTimeout> | undefined
    let configRefreshTask: Promise<void> | null = null
    let lastLoggedFailure: string | null = null
    const controller = new AbortController()

    function reportFailure(category: string): void {
      diagnostics.lastErrorCategory = category
      diagnostics.capture = "degraded"
      if (lastLoggedFailure === category) return
      lastLoggedFailure = category
      console.warn(
        "[Analyzer] Local telemetry is degraded; OpenCode continues normally.",
        category,
      )
    }

    try {
      const opened = await openPersistentDatabase()
      db = opened.db
      diagnostics.walEnabled = opened.walEnabled
      store = createAnalyzerStore(db, projectId, Date.now, () => mcpServers)
      store.prune()
      diagnostics.database = "ready"
      const snapshot = await captureConfigSnapshot(ctx, projectId, projectRoot)
      configId = store.recordConfig(snapshot)
      mcpServers = responseArray(await safeCall(() => ctx.mcp.list()))
        .map((server) => stringValue(server.name, 100))
        .filter((name): name is string => name !== null)
      diagnostics.historyTruncated = store.getStatus().historyTruncated
      db.prepare(
        `INSERT INTO metadata(key, value) VALUES ('collector_status', 'running')
         ON CONFLICT(key) DO UPDATE SET value = 'running'`,
      ).run()
      db.prepare(
        `INSERT INTO metadata(key, value) VALUES ('collector_started_at', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(String(startedAt))
    } catch (error) {
      reportFailure(errorLabel(error))
      try {
        db?.close?.()
      } catch {
        // A partially opened database is not allowed to interrupt OpenCode.
      }
      db = null
      store = null
    }

    const tools = createAnalyzerToolDefinitions(
      () => store,
      diagnostics,
      reportFailure,
    )

    try {
      await ctx.tool.transform((editor) => {
        editor.namespace({
          name: "analyzer",
          description: "Read-only local OpenCode usage analytics",
        })
        for (const tool of tools) {
          editor.add(tool)
        }
      })
    } catch (error) {
      reportFailure(errorLabel(error))
    }

    if (!store) {
      diagnostics.capture = "degraded"
      return () => {
        diagnostics.capture = "stopped"
      }
    }

    let queue: NormalizedEvent[] = []
    let draining = false
    let worker: Promise<void> | null = null
    let acceptingEvents = true

    async function drainQueue(): Promise<void> {
      if (draining) {
        await worker
        return
      }
      draining = true
      worker = (async () => {
        while (queue.length > 0) {
          const event = queue.shift()
          if (!event) continue
          try {
            const configurationChanged =
              event.type === "filesystem.changed" ||
              event.type === "config.updated" ||
              event.type === "agent.updated" ||
              event.type === "model.updated" ||
              event.type === "skill.updated" ||
              event.type === "mcp.status.changed"
            if (configurationChanged) {
              const file = event.configPath
              const relevant =
                !file ||
                isRelevantConfigPath(projectRoot, resolve(projectRoot, file))
              if (relevant) {
                configId = null
                scheduleConfigRefresh()
              }
            }
            store?.recordEvent(event, configId)
            if (Date.now() - startedAt > DAY_MS) store?.prune()
          } catch (error) {
            diagnostics.lostEvents += 1
            reportFailure(errorLabel(error))
          }
        }
      })()
      try {
        await worker
      } finally {
        draining = false
        worker = null
      }
    }

    function enqueue(event: NormalizedEvent): void {
      if (!acceptingEvents) return
      if (queue.length >= MAX_QUEUE_SIZE) {
        diagnostics.lostEvents += 1
        diagnostics.capture = "degraded"
        diagnostics.lastErrorCategory = "event_queue_full"
        return
      }
      queue.push(event)
      if (!draining) void drainQueue()
    }

    async function refreshConfig(): Promise<void> {
      if (!store) return
      try {
        const snapshot = await captureConfigSnapshot(ctx, projectId, projectRoot)
        configId = store.recordConfig(snapshot)
        mcpServers = responseArray(await safeCall(() => ctx.mcp.list()))
          .map((server) => stringValue(server.name, 100))
          .filter((name): name is string => name !== null)
        diagnostics.historyTruncated = store.getStatus().historyTruncated
      } catch (error) {
        reportFailure(errorLabel(error))
      }
    }

    function scheduleConfigRefresh(): void {
      if (configRefreshTimer) clearTimeout(configRefreshTimer)
      configRefreshTimer = setTimeout(() => {
        configRefreshTimer = undefined
        const task = refreshConfig()
        configRefreshTask = task
        void task.finally(() => {
          if (configRefreshTask === task) configRefreshTask = null
        })
      }, 300)
    }

    diagnostics.capture = "healthy"
    const subscription = (async () => {
      try {
        for await (const rawEvent of ctx.event.subscribe({
          types: EVENT_TYPES,
          signal: controller.signal,
        })) {
          if (!eventInProject(rawEvent, projectId, projectRoots)) continue
          const normalized = normalizeEvent(rawEvent, mcpServers)
          if (normalized) enqueue(normalized)
        }
        if (!controller.signal.aborted) {
          diagnostics.capture = "degraded"
          diagnostics.lastErrorCategory = "event_stream_ended"
        }
      } catch (error) {
        if (!controller.signal.aborted) reportFailure(errorLabel(error))
      }
    })()

    return async () => {
      acceptingEvents = false
      diagnostics.capture = "stopped"
      if (configRefreshTimer) clearTimeout(configRefreshTimer)
      controller.abort()
      try {
        await subscription
        await drainQueue()
        if (configRefreshTask) await configRefreshTask
      } catch {
        diagnostics.lostEvents += queue.length
        queue = []
      }
      try {
        db?.prepare(
          `INSERT INTO metadata(key, value) VALUES ('collector_status', 'stopped')
           ON CONFLICT(key) DO UPDATE SET value = 'stopped'`,
        ).run()
        db?.prepare(
          `INSERT INTO metadata(key, value) VALUES ('collector_stopped_at', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ).run(String(Date.now()))
        db?.close?.()
      } catch (error) {
        reportFailure(errorLabel(error))
      }
    }
  },
}
