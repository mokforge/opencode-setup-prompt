import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const CONFIG_URL = new URL("./hooks.yml", import.meta.url)
const HOOK_METADATA_KEY = "opencodeSetupHooks"
const MAX_CONFIG_BYTES = 64 * 1024
const MAX_CONFIG_LINES = 2_000
const MAX_REMEMBERED_IDS = 2_000
const MAX_REPORT_LENGTH = 8_000
const MAX_ACTIVE_HOOKS = 4
const MAX_PENDING_HOOK_EVENTS = 256
const MAX_PENDING_PER_SESSION = 32

export const SUPPORTED_EVENT_TYPES = [
  "session.created",
  "session.agent.selected",
  "session.model.selected",
  "session.moved",
  "session.renamed",
  "session.metadata.updated",
  "session.permissions",
  "session.viewed",
  "session.archived",
  "session.unarchived",
  "session.usage.updated",
  "session.forked",
  "session.inbox.delivered",
  "session.inbox.enqueued",
  "session.inbox.cancelled",
  "session.inbox.delivery.changed",
  "session.execution.started",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.idle",
  "session.instructions.updated",
  "session.synthetic",
  "session.skill.activated",
  "session.shell.started",
  "session.shell.ended",
  "session.step.started",
  "session.step.first-token",
  "session.step.ended",
  "session.step.failed",
  "session.text.started",
  "session.text.ended",
  "session.reasoning.started",
  "session.reasoning.ended",
  "session.tool.input.started",
  "session.tool.input.ended",
  "session.tool.called",
  "session.tool.success",
  "session.tool.failed",
  "session.retry.scheduled",
  "session.compaction.started",
  "session.compaction.ended",
  "session.compaction.failed",
  "session.revert.staged",
  "session.revert.cleared",
  "session.revert.committed",
  "session.status",
] as const

const SUPPORTED_EVENT_SET = new Set<string>(SUPPORTED_EVENT_TYPES)

export interface HookDefinition {
  enabled: boolean
  skills: string[]
  commands: string[]
  agents: string[]
  prompt?: string
}

export interface HooksConfig {
  hooks: Record<string, HookDefinition[]>
}

interface YamlLine {
  indent: number
  content: string
  line: number
  raw: string
}

interface HookEvent {
  id?: unknown
  type?: unknown
  data?: unknown
  location?: unknown
}

interface HookSession {
  id?: unknown
  agent?: unknown
  location?: unknown
}

interface HookPluginContext {
  location: { directory?: string }
  agent: { list(): Promise<unknown> }
  command: { list(): Promise<unknown> }
  skill: { list(): Promise<unknown> }
  event: {
    subscribe(input: {
      types: string[]
      signal: AbortSignal
    }): AsyncIterable<unknown>
  }
  session: {
    get(input: { sessionID: string }): Promise<unknown>
    create(input: {
      agent?: string
      location?: { directory: string }
      title: string
      metadata: Record<string, unknown>
    }): Promise<unknown>
    context(input: { sessionID: string }): Promise<unknown>
    prompt(input: {
      sessionID: string
      text: string
      skills?: Array<{ id: string }>
    }): Promise<unknown>
    command(input: {
      sessionID: string
      name: string
      text: string
    }): Promise<unknown>
    wait(input: { sessionID: string }): Promise<unknown>
    synthetic(input: {
      sessionID: string
      text: string
      metadata: Record<string, unknown>
    }): Promise<unknown>
  }
}

export interface HookCatalog {
  agents: Set<string> | null
  commands: Set<string> | null
  skills: Set<string> | null
}

export interface HookRuntimeState {
  generatedSessions: Set<string>
  generatedSessionOrder: string[]
  seenEvents: Set<string>
  seenEventOrder: string[]
  queuedEventIDs: Set<string>
  sessionQueues: Map<string, Promise<void>>
  pendingBySession: Map<string, number>
  queueWaiters: Array<() => void>
  activeWaiters: Array<() => void>
  pendingCount: number
  activeSessions: Set<string>
  activeCount: number
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function unwrap(value: unknown): unknown {
  const wrapped = record(value)
  return wrapped.data !== undefined ? wrapped.data : value
}

function responseArray(value: unknown): unknown[] {
  const unwrapped = unwrap(value)
  if (Array.isArray(unwrapped)) return unwrapped
  const nested = record(unwrapped).data
  return Array.isArray(nested) ? nested : []
}

function stripComment(value: string): string {
  let quote: "'" | '"' | null = null
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (quote === '"') {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === '"') quote = null
      continue
    }
    if (quote === "'") {
      if (character === "'" && value[index + 1] === "'") {
        index += 1
      } else if (character === "'") {
        quote = null
      }
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === "#" && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index).trimEnd()
    }
  }
  return value
}

function scalar(value: string, line: number): string | boolean {
  const input = value.trim()
  if (input === "true") return true
  if (input === "false") return false
  if (input === "null" || input === "~" || input.startsWith("{")) {
    throw new Error(`Unsupported YAML value on line ${line}.`)
  }
  if (/^[&*!]/.test(input)) {
    throw new Error(`YAML anchors, aliases, and tags are not supported on line ${line}.`)
  }
  if (input.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(input)
      if (typeof parsed !== "string") throw new Error("not a string")
      return parsed
    } catch {
      throw new Error(`Invalid quoted string on line ${line}.`)
    }
  }
  if (input.startsWith("'")) {
    if (!input.endsWith("'") || input.length < 2) {
      throw new Error(`Invalid quoted string on line ${line}.`)
    }
    return input.slice(1, -1).replaceAll("''", "'")
  }
  if (input.startsWith("[") || input.endsWith("]")) {
    throw new Error(`Invalid inline list on line ${line}.`)
  }
  return input
}

function splitPair(content: string, line: number): [string, string] {
  let quote: "'" | '"' | null = null
  let escaped = false
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    if (quote === '"') {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === '"') quote = null
      continue
    }
    if (quote === "'") {
      if (character === "'" && content[index + 1] === "'") index += 1
      else if (character === "'") quote = null
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === ":") {
      const key = scalar(content.slice(0, index).trim(), line)
      if (typeof key !== "string" || !key) {
        throw new Error(`Invalid mapping key on line ${line}.`)
      }
      return [key, content.slice(index + 1).trim()]
    }
  }
  throw new Error(`Expected a YAML mapping on line ${line}.`)
}

function inlineStringList(value: string, line: number): string[] {
  const input = value.trim()
  if (input === "[]") return []
  if (!input.startsWith("[") || !input.endsWith("]")) {
    throw new Error(`Expected a YAML list on line ${line}.`)
  }
  const contents = input.slice(1, -1).trim()
  if (!contents) return []
  const values: string[] = []
  let start = 0
  let quote: "'" | '"' | null = null
  let escaped = false
  for (let index = 0; index <= contents.length; index += 1) {
    const character = contents[index]
    if (index < contents.length && quote === '"') {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === '"') quote = null
      continue
    }
    if (index < contents.length && quote === "'") {
      if (character === "'" && contents[index + 1] === "'") index += 1
      else if (character === "'") quote = null
      continue
    }
    if (index < contents.length && (character === '"' || character === "'")) {
      quote = character
      continue
    }
    if (index === contents.length || character === ",") {
      const item = scalar(contents.slice(start, index).trim(), line)
      if (typeof item !== "string") {
        throw new Error(`Expected string items in YAML list on line ${line}.`)
      }
      values.push(item)
      start = index + 1
    }
  }
  if (quote) throw new Error(`Unclosed quote on line ${line}.`)
  return values
}

class HooksYamlParser {
  private index = 0
  private readonly lines: YamlLine[]

  constructor(source: string) {
    if (Buffer.byteLength(source, "utf8") > MAX_CONFIG_BYTES) {
      throw new Error(`hooks.yml exceeds ${MAX_CONFIG_BYTES} bytes.`)
    }
    const sourceLines = source.split(/\r?\n/)
    if (sourceLines.length > MAX_CONFIG_LINES) {
      throw new Error(`hooks.yml exceeds ${MAX_CONFIG_LINES} lines.`)
    }
    this.lines = sourceLines.map((raw, index) => {
      const indentationText = raw.match(/^[ \t]*/)?.[0] ?? ""
      if (indentationText.includes("\t")) {
        throw new Error(`Tabs are not supported for YAML indentation on line ${index + 1}.`)
      }
      const indentation = indentationText.length
      const content = stripComment(raw.slice(indentation)).trim()
      return { indent: indentation, content, line: index + 1, raw }
    })
  }

  parse(): HooksConfig {
    this.skipIgnorable()
    const root = this.lines[this.index]
    if (!root || root.indent !== 0 || root.content !== "hooks:") {
      throw new Error("hooks.yml must start with a top-level `hooks:` mapping.")
    }
    this.index += 1
    const hooks: Record<string, HookDefinition[]> = {}

    while (this.index < this.lines.length) {
      this.skipIgnorable()
      if (this.index >= this.lines.length) break
      const eventLine = this.lines[this.index]
      this.assertIndentation(eventLine)
      if (eventLine.indent !== 2 || eventLine.content.startsWith("-")) {
        throw new Error(`Expected an event under hooks: on line ${eventLine.line}.`)
      }
      const [configuredEvent, value] = splitPair(eventLine.content, eventLine.line)
      if (value) throw new Error(`Event values must be YAML mappings on line ${eventLine.line}.`)
      if (!SUPPORTED_EVENT_SET.has(configuredEvent)) {
        throw new Error(`Unsupported OpenCode V2 session event "${configuredEvent}" on line ${eventLine.line}.`)
      }
      if (Object.hasOwn(hooks, configuredEvent)) {
        throw new Error(`Duplicate event key "${configuredEvent}" on line ${eventLine.line}.`)
      }
      this.index += 1
      this.skipIgnorable()
      const next = this.lines[this.index]
      if (!next || next.indent !== 4) {
        throw new Error(`Event "${configuredEvent}" must contain at least one hook.`)
      }
      this.assertIndentation(next)
      if (next.content !== "-" && !next.content.startsWith("- ")) {
        throw new Error(
          `Event "${configuredEvent}" must contain a YAML list of hooks on line ${next.line}.`,
        )
      }

      const definitions = this.parseHookList()
      hooks[configuredEvent] = definitions
    }

    return { hooks }
  }

  private parseHookList(): HookDefinition[] {
    const definitions: HookDefinition[] = []
    while (this.index < this.lines.length) {
      this.skipIgnorable()
      if (this.index >= this.lines.length) break
      const line = this.lines[this.index]
      this.assertIndentation(line)
      if (
        line.indent !== 4 ||
        (line.content !== "-" && !line.content.startsWith("- "))
      ) {
        break
      }
      const hook = this.emptyHook()
      const seenFields = new Set<string>()
      const firstField = line.content.slice(1).trim()
      this.index += 1
      if (firstField) {
        const [key, value] = splitPair(firstField, line.line)
        this.assignField(hook, key, value, 8, line.line, seenFields)
      }
      this.parseHookFields(hook, 6, seenFields)
      definitions.push(this.finishHook(hook, line.line))
    }
    if (definitions.length === 0) throw new Error("An event hook list cannot be empty.")
    return definitions
  }

  private parseHookFields(
    hook: HookDefinition,
    indent: number,
    seenFields: Set<string>,
  ): void {
    while (this.index < this.lines.length) {
      this.skipIgnorable()
      if (this.index >= this.lines.length) break
      const line = this.lines[this.index]
      this.assertIndentation(line)
      if (line.indent !== indent) break
      if (line.content === "-" || line.content.startsWith("- ")) {
        throw new Error(`Unexpected list item on line ${line.line}.`)
      }
      const [key, value] = splitPair(line.content, line.line)
      this.index += 1
      this.assignField(hook, key, value, indent + 2, line.line, seenFields)
    }
    this.skipIgnorable()
    const next = this.lines[this.index]
    if (next && next.indent > indent) {
      throw new Error(`Unexpected YAML indentation on line ${next.line}.`)
    }
  }

  private assignField(
    hook: HookDefinition,
    key: string,
    value: string,
    listIndent: number,
    line: number,
    seenFields: Set<string>,
  ): void {
    if (seenFields.has(key)) {
      throw new Error(`Duplicate hook field "${key}" on line ${line}.`)
    }
    seenFields.add(key)
    if (key === "enabled") {
      const parsed = scalar(value, line)
      if (typeof parsed !== "boolean") {
        throw new Error(`Hook enabled must be true or false on line ${line}.`)
      }
      hook.enabled = parsed
      return
    }
    if (key === "prompt") {
      if (!value) throw new Error(`Hook prompt must be a string on line ${line}.`)
      let parsed: string | boolean
      if (value === "|" || value === ">") {
        parsed = this.parseBlockScalar(value, listIndent - 2, line)
      } else {
        if (/^[|>]/.test(value)) {
          throw new Error(`Unsupported prompt block scalar indicator on line ${line}.`)
        }
        parsed = scalar(value, line)
      }
      if (typeof parsed !== "string") {
        throw new Error(`Hook prompt must be a string on line ${line}.`)
      }
      hook.prompt = parsed
      return
    }
    if (key === "skills" || key === "commands" || key === "agents") {
      const list = value
        ? inlineStringList(value, line)
        : this.parseBlockList(listIndent)
      const normalized = list.map((item) => item.trim())
      if (normalized.some((item) => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(item))) {
        throw new Error(`Invalid ${key} ID on line ${line}.`)
      }
      hook[key] = [...new Set(normalized)]
      return
    }
    throw new Error(`Unknown hook field "${key}" on line ${line}.`)
  }

  private parseBlockScalar(
    style: "|" | ">",
    parentIndent: number,
    line: number,
  ): string {
    const values: string[] = []
    let contentIndent: number | null = null
    while (this.index < this.lines.length) {
      const current = this.lines[this.index]
      if (current.raw.trim() === "") {
        values.push("")
        this.index += 1
        continue
      }
      if (current.indent <= parentIndent) break
      if (contentIndent === null) contentIndent = current.indent
      if (current.indent < contentIndent) {
        throw new Error(`Inconsistent prompt indentation on line ${current.line} (block starts on line ${line}).`)
      }
      values.push(current.raw.slice(contentIndent))
      this.index += 1
    }

    while (values.at(-1) === "") values.pop()
    if (values.length === 0) return ""
    if (style === "|") return `${values.join("\n")}\n`

    let folded = ""
    for (let index = 0; index < values.length; index += 1) {
      folded += values[index]
      if (index < values.length - 1) {
        const moreIndented =
          values[index].startsWith(" ") || values[index + 1].startsWith(" ")
        folded +=
          values[index] === "" ||
          values[index + 1] === "" ||
          moreIndented
            ? "\n"
            : " "
      }
    }
    return `${folded}\n`
  }

  private parseBlockList(indent: number): string[] {
    const values: string[] = []
    while (this.index < this.lines.length) {
      this.skipIgnorable()
      if (this.index >= this.lines.length) break
      const line = this.lines[this.index]
      this.assertIndentation(line)
      if (
        line.indent !== indent ||
        (line.content !== "-" && !line.content.startsWith("- "))
      ) {
        break
      }
      const value = line.content.slice(1).trim()
      if (!value) throw new Error(`Empty list item on line ${line.line}.`)
      const parsed = scalar(value, line.line)
      if (typeof parsed !== "string") {
        throw new Error(`Expected string list items on line ${line.line}.`)
      }
      values.push(parsed)
      this.index += 1
    }
    this.skipIgnorable()
    const next = this.lines[this.index]
    if (next && next.indent > indent) {
      throw new Error(`Nested YAML lists are not supported on line ${next.line}.`)
    }
    return values
  }

  private emptyHook(): HookDefinition {
    return { enabled: false, skills: [], commands: [], agents: [] }
  }

  private finishHook(hook: HookDefinition, line: number): HookDefinition {
    if (hook.prompt !== undefined && !hook.prompt.trim()) {
      throw new Error(`Hook prompt cannot be empty on line ${line}.`)
    }
    return hook
  }

  private skipIgnorable(): void {
    while (this.index < this.lines.length && !this.lines[this.index].content) {
      this.index += 1
    }
  }

  private assertIndentation(line: YamlLine): void {
    if (line.indent % 2 !== 0) {
      throw new Error(`Use two-space YAML indentation on line ${line.line}.`)
    }
  }
}

export function parseHooksYaml(source: string): HooksConfig {
  return new HooksYamlParser(source).parse()
}

export function createHookRuntimeState(): HookRuntimeState {
  return {
    generatedSessions: new Set(),
    generatedSessionOrder: [],
    seenEvents: new Set(),
    seenEventOrder: [],
    queuedEventIDs: new Set(),
    sessionQueues: new Map(),
    pendingBySession: new Map(),
    queueWaiters: [],
    activeWaiters: [],
    pendingCount: 0,
    activeSessions: new Set(),
    activeCount: 0,
  }
}

function hasActions(hook: HookDefinition): boolean {
  return Boolean(
    hook.skills.length ||
      hook.commands.length ||
      hook.agents.length ||
      hook.prompt?.trim(),
  )
}

export function enabledHookEvents(config: HooksConfig): string[] {
  return Object.entries(config.hooks)
    .filter(([, hooks]) => hooks.some((hook) => hook.enabled && hasActions(hook)))
    .map(([event]) => event)
}

function setFromResponse(value: unknown, key: "id" | "name"): Set<string> {
  return new Set(
    responseArray(value)
      .map((item) => stringValue(record(item)[key]))
      .filter((item): item is string => item !== null),
  )
}

async function readCatalog(
  read: () => Promise<unknown>,
  key: "id" | "name",
  label: string,
): Promise<Set<string> | null> {
  try {
    return setFromResponse(await read(), key)
  } catch (error) {
    console.warn(`[Hooks] Could not read available ${label}; ID validation is skipped.`, error)
    return null
  }
}

export async function loadHookCatalog(ctx: HookPluginContext): Promise<HookCatalog> {
  const [agents, commands, skills] = await Promise.all([
    readCatalog(() => ctx.agent.list(), "id", "agents"),
    readCatalog(() => ctx.command.list(), "name", "commands"),
    readCatalog(() => ctx.skill.list(), "id", "Skills"),
  ])
  return { agents, commands, skills }
}

function queueIsFull(state: HookRuntimeState, sessionID: string): boolean {
  return (
    state.pendingCount >= MAX_PENDING_HOOK_EVENTS ||
    (state.pendingBySession.get(sessionID) ?? 0) >= MAX_PENDING_PER_SESSION
  )
}

async function waitForQueueCapacity(
  state: HookRuntimeState,
  sessionID: string,
  signal?: AbortSignal,
): Promise<boolean> {
  while (queueIsFull(state, sessionID)) {
    if (signal?.aborted) return false
    await new Promise<void>((resolve) => {
      const wake = () => {
        signal?.removeEventListener("abort", wake)
        const index = state.queueWaiters.indexOf(wake)
        if (index >= 0) state.queueWaiters.splice(index, 1)
        resolve()
      }
      state.queueWaiters.push(wake)
      signal?.addEventListener("abort", wake, { once: true })
    })
  }
  return !signal?.aborted
}

function notifyQueueWaiters(state: HookRuntimeState): void {
  for (const resolve of state.queueWaiters.splice(0)) resolve()
}

async function acquireActiveSlot(state: HookRuntimeState): Promise<void> {
  if (state.activeCount < MAX_ACTIVE_HOOKS && state.activeWaiters.length === 0) {
    state.activeCount += 1
    return
  }
  await new Promise<void>((resolve) => state.activeWaiters.push(resolve))
}

function releaseActiveSlot(state: HookRuntimeState): void {
  const next = state.activeWaiters.shift()
  if (next) {
    next()
    return
  }
  state.activeCount = Math.max(0, state.activeCount - 1)
}

function available(id: string, values: Set<string> | null): boolean {
  return values === null || values.has(id)
}

function eventHasHookMetadata(event: HookEvent): boolean {
  const data = record(event.data)
  const metadata = record(data.metadata)
  const sessionMetadata = record(metadata[HOOK_METADATA_KEY])
  return metadata[HOOK_METADATA_KEY] === true || sessionMetadata.generated === true
}

function rememberBounded(set: Set<string>, order: string[], id: string): void {
  if (set.has(id)) return
  set.add(id)
  order.push(id)
  while (order.length > MAX_REMEMBERED_IDS) {
    const oldest = order.shift()
    if (oldest) set.delete(oldest)
  }
}

function rememberGeneratedSession(state: HookRuntimeState, sessionID: string): void {
  if (state.generatedSessions.has(sessionID)) return
  state.generatedSessions.add(sessionID)
  state.generatedSessionOrder.push(sessionID)
  while (state.generatedSessionOrder.length > MAX_REMEMBERED_IDS) {
    const oldest = state.generatedSessionOrder.shift()
    if (oldest) state.generatedSessions.delete(oldest)
  }
}

function defaultPrompt(eventType: string, skills: string[]): string {
  const attached =
    skills.length > 0 ? ` Use the attached Skills: ${skills.join(", ")}.` : ""
  return `Run the configured OpenCode hook for event "${eventType}". Inspect the relevant project state as needed.${attached} Return a concise report to the triggering session. Do not modify project files unless the selected agent or command's normal instructions and permissions allow it.`
}

function sessionLocation(
  session: HookSession,
  pluginLocation: { directory?: string },
): { directory: string } | undefined {
  const sessionDirectory = stringValue(record(session.location).directory)
  const directory = sessionDirectory ?? stringValue(pluginLocation.directory)
  return directory ? { directory } : undefined
}

function assistantReply(value: unknown): string {
  const messages = responseArray(value)
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = record(messages[messageIndex])
    const info = record(message.info)
    if (info.role !== "assistant" && message.role !== "assistant") continue
    const parts = Array.isArray(message.parts)
      ? message.parts
      : Array.isArray(info.parts)
        ? info.parts
        : []
    const text = parts
      .filter((part) => record(part).type === "text")
      .map((part) => stringValue(record(part).text))
      .filter((part): part is string => part !== null)
      .join("\n")
    if (text) return text.slice(0, MAX_REPORT_LENGTH)
  }
  return ""
}

async function runHookTarget(
  ctx: HookPluginContext,
  parentSessionID: string,
  parent: HookSession,
  sourceEvent: string,
  hook: HookDefinition,
  agentID: string | undefined,
  skills: string[],
  commands: string[],
  state: HookRuntimeState,
): Promise<void> {
  const location = sessionLocation(parent, ctx.location)
  const titleAgent = agentID ? ` · ${agentID}` : ""
  const childValue = await ctx.session.create({
    ...(agentID ? { agent: agentID } : {}),
    ...(location ? { location } : {}),
    title: `[Hooks] ${sourceEvent}${titleAgent}`,
    metadata: {
      [HOOK_METADATA_KEY]: {
        generated: true,
        parentSessionID,
        event: sourceEvent,
      },
    },
  })
  const child = record(unwrap(childValue))
  const childSessionID = stringValue(child.id)
  if (!childSessionID) throw new Error("OpenCode did not return an ID for the hook session.")
  rememberGeneratedSession(state, childSessionID)

  const prompt = hook.prompt?.trim() || defaultPrompt(sourceEvent, skills)
  for (const command of commands) {
    await ctx.session.command({
      sessionID: childSessionID,
      name: command,
      text: hook.prompt?.trim() ?? "",
    })
    await ctx.session.wait({ sessionID: childSessionID })
  }

  if (skills.length > 0 || commands.length === 0 || hook.agents.length > 0) {
    await ctx.session.prompt({
      sessionID: childSessionID,
      text: prompt,
      ...(skills.length > 0 ? { skills: skills.map((id) => ({ id })) } : {}),
    })
    await ctx.session.wait({ sessionID: childSessionID })
  }

  const reply = assistantReply(await ctx.session.context({ sessionID: childSessionID }))
  const report = [
    `OpenCode hook \`${sourceEvent}\` completed in session \`${childSessionID}\`${titleAgent}.`,
    reply || "No assistant text was returned; inspect the hook session for details.",
  ].join("\n\n")
  await ctx.session.synthetic({
    sessionID: parentSessionID,
    text: report,
    metadata: {
      [HOOK_METADATA_KEY]: true,
      event: sourceEvent,
      childSessionID,
    },
  })
}

async function executeHooksForEvent(
  ctx: HookPluginContext,
  config: HooksConfig,
  rawEvent: unknown,
  state: HookRuntimeState,
  catalog?: HookCatalog,
): Promise<void> {
  const event = record(rawEvent) as HookEvent
  const eventType = stringValue(event.type)
  if (!eventType) return
  const data = record(event.data)
  const sessionID = stringValue(data.sessionID)

  if (eventType === "session.deleted") {
    if (sessionID) state.generatedSessions.delete(sessionID)
    return
  }
  if (!sessionID || eventHasHookMetadata(event) || state.generatedSessions.has(sessionID)) return

  const hooks = config.hooks[eventType]?.filter((hook) => hook.enabled && hasActions(hook))
  if (!hooks?.length) return

  const eventID = stringValue(event.id)
  if (eventID) {
    if (state.seenEvents.has(eventID)) return
    rememberBounded(state.seenEvents, state.seenEventOrder, eventID)
  }

  const currentCatalog = catalog ?? await loadHookCatalog(ctx)
  let parent: HookSession
  try {
    parent = record(unwrap(await ctx.session.get({ sessionID }))) as HookSession
  } catch {
    console.warn(`[Hooks] Skipped ${eventType}; session ${sessionID} is no longer available.`)
    return
  }

  const parentAgent = stringValue(parent.agent) ?? undefined
  for (const hook of hooks) {
    const skills = hook.skills.filter((id) => {
      const exists = available(id, currentCatalog.skills)
      if (!exists) console.warn(`[Hooks] Skill "${id}" is not available; skipping it.`)
      return exists
    })
    const commands = hook.commands.filter((name) => {
      const exists = available(name, currentCatalog.commands)
      if (!exists) console.warn(`[Hooks] OpenCode command "${name}" is not available; skipping it.`)
      return exists
    })
    const agents = hook.agents.filter((id) => {
      const exists = available(id, currentCatalog.agents)
      if (!exists) console.warn(`[Hooks] OpenCode agent "${id}" is not available; skipping it.`)
      return exists
    })

    if (hook.agents.length > 0 && agents.length === 0) continue
    if (
      skills.length === 0 &&
      commands.length === 0 &&
      agents.length === 0 &&
      !hook.prompt?.trim()
    ) {
      continue
    }

    const targets: Array<string | undefined> =
      hook.agents.length > 0 ? agents : [parentAgent]
    for (const agentID of targets) {
      try {
        await runHookTarget(
          ctx,
          sessionID,
          parent,
          eventType,
          { ...hook, agents },
          agentID,
          skills,
          commands,
          state,
        )
      } catch (error) {
        console.warn(`[Hooks] Hook for ${eventType} failed.`, error)
      }
    }
  }
}

interface QueuedHookEvent {
  done: Promise<void>
}

export async function enqueueHooksForEvent(
  ctx: HookPluginContext,
  config: HooksConfig,
  rawEvent: unknown,
  state: HookRuntimeState,
  catalog?: HookCatalog,
  signal?: AbortSignal,
): Promise<QueuedHookEvent | undefined> {
  const event = record(rawEvent) as HookEvent
  const eventType = stringValue(event.type)
  if (!eventType) return undefined
  const data = record(event.data)
  const sessionID = stringValue(data.sessionID)

  if (eventType === "session.deleted") {
    if (sessionID) state.generatedSessions.delete(sessionID)
    return undefined
  }
  if (!sessionID || eventHasHookMetadata(event) || state.generatedSessions.has(sessionID)) {
    return undefined
  }
  const hooks = config.hooks[eventType]?.filter((hook) => hook.enabled && hasActions(hook))
  if (!hooks?.length) return undefined

  const eventID = stringValue(event.id)
  if (
    eventID &&
    (state.seenEvents.has(eventID) || state.queuedEventIDs.has(eventID))
  ) {
    return undefined
  }

  if (!(await waitForQueueCapacity(state, sessionID, signal))) return undefined
  if (signal?.aborted) return undefined
  if (
    eventID &&
    (state.seenEvents.has(eventID) || state.queuedEventIDs.has(eventID))
  ) {
    return undefined
  }
  if (eventID) state.queuedEventIDs.add(eventID)
  state.pendingCount += 1
  state.pendingBySession.set(
    sessionID,
    (state.pendingBySession.get(sessionID) ?? 0) + 1,
  )

  let resolveDone!: () => void
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })
  const previous = state.sessionQueues.get(sessionID) ?? Promise.resolve()
  let task!: Promise<void>
  task = previous
    .catch((error) => {
      console.warn(`[Hooks] Previous queued event for session ${sessionID} failed.`, error)
    })
    .then(async () => {
      await acquireActiveSlot(state)
      state.pendingCount = Math.max(0, state.pendingCount - 1)
      const remaining = (state.pendingBySession.get(sessionID) ?? 1) - 1
      if (remaining <= 0) state.pendingBySession.delete(sessionID)
      else state.pendingBySession.set(sessionID, remaining)
      notifyQueueWaiters(state)
      state.activeSessions.add(sessionID)
      try {
        await executeHooksForEvent(ctx, config, rawEvent, state, catalog)
      } catch (error) {
        console.warn(`[Hooks] Event handling failed for ${eventType}.`, error)
      } finally {
        state.activeSessions.delete(sessionID)
        releaseActiveSlot(state)
      }
    })
    .finally(() => {
      if (eventID) state.queuedEventIDs.delete(eventID)
      if (state.sessionQueues.get(sessionID) === task) {
        state.sessionQueues.delete(sessionID)
      }
      resolveDone()
    })
  state.sessionQueues.set(sessionID, task)
  return { done }
}

export async function runHooksForEvent(
  ctx: HookPluginContext,
  config: HooksConfig,
  rawEvent: unknown,
  state: HookRuntimeState = createHookRuntimeState(),
  catalog?: HookCatalog,
): Promise<void> {
  const queued = await enqueueHooksForEvent(ctx, config, rawEvent, state, catalog)
  if (queued) await queued.done
}

async function loadConfig(): Promise<HooksConfig> {
  const source = await readFile(CONFIG_URL, "utf8")
  return parseHooksYaml(source)
}

export default {
  id: "hooks",
  async setup(ctx: HookPluginContext) {
    let config: HooksConfig
    try {
      config = await loadConfig()
    } catch (error) {
      console.warn(
        `[Hooks] Could not load ${fileURLToPath(CONFIG_URL)}; hooks are disabled.`,
        error,
      )
      return
    }

    const activeEvents = enabledHookEvents(config)
    const activeHookCount = Object.values(config.hooks)
      .flat()
      .filter((hook) => hook.enabled && hasActions(hook)).length
    console.info(
      `[Hooks] Loaded ${activeHookCount} enabled hook(s) from hooks.yml.`,
    )
    if (activeEvents.length === 0) return

    const state = createHookRuntimeState()
    const controller = new AbortController()
    const types = [...new Set([...activeEvents, "session.created", "session.deleted"])]
    const subscription = (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          types,
          signal: controller.signal,
        })) {
          await enqueueHooksForEvent(ctx, config, event, state, undefined, controller.signal).catch((error) => {
            console.warn("[Hooks] Event handling failed.", error)
          })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("[Hooks] Event subscription stopped unexpectedly.", error)
        }
      }
    })()

    return async () => {
      controller.abort()
      await subscription
    }
  },
}
