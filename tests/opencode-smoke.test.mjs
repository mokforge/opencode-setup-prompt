import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import test from "node:test"
import { fileURLToPath } from "node:url"

const version = spawnSync("opencode", ["--version"], { encoding: "utf8" })
const openCodeV2Available =
  !version.error && version.status === 0 && /^opencode v2\./m.test(version.stdout)

function runInvalidModel(project, home, message, options = {}) {
  const { agent = "analyzer", logLevel = "warn" } = options
  const args = [
    "run",
    "--log-level",
    logLevel,
    "--standalone",
    "--archived",
  ]
  if (agent) args.push("--agent", agent)
  args.push("--model", "invalid/none", message)
  return spawnSync(
    "opencode",
    args,
    {
      cwd: project,
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        PATH: process.env.PATH,
        LANG: process.env.LANG ?? "en_US.UTF-8",
        TMPDIR: join(home, "tmp"),
        HOME: home,
        XDG_CONFIG_HOME: join(home, ".config"),
        XDG_DATA_HOME: join(home, ".local", "share"),
        XDG_STATE_HOME: join(home, ".local", "state"),
      },
    },
  )
}

test(
  "OpenCode V2 loads Analyzer, preserves its database, and degrades safely without SQLite",
  { skip: !openCodeV2Available },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-analyzer-smoke-"))
    t.after(() => rm(directory, { recursive: true, force: true }))
    const home = join(directory, "home")
    const project = join(directory, "project")
    const userConfig = join(home, ".config", "opencode")
    await mkdir(join(home, "tmp"), { recursive: true })
    const pluginDirectory = join(project, ".opencode", "plugins")
    const analyzerPluginDirectory = join(pluginDirectory, "analyzer")
    const agentDirectory = join(project, ".opencode", "agents")
    await mkdir(userConfig, { recursive: true })
    await mkdir(analyzerPluginDirectory, { recursive: true })
    await mkdir(agentDirectory, { recursive: true })
    await writeFile(
      join(userConfig, "opencode.json"),
      JSON.stringify({
        $schema: "https://opencode.ai/config.json",
        update: "disable",
      }),
    )

    const repository = fileURLToPath(new URL("../", import.meta.url))
    await copyFile(
      join(repository, "templates/plugins/analyzer/index.ts"),
      join(analyzerPluginDirectory, "index.ts"),
    )
    await copyFile(
      join(repository, "templates/agents/analyzer.md"),
      join(agentDirectory, "analyzer.md"),
    )

    const result = runInvalidModel(
      project,
      home,
      "Verify plugin startup only; do not perform analysis.",
    )
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    assert.equal(result.error, undefined, output)
    assert.equal(result.status, 1, output)
    assert.match(output, /Model unavailable: invalid\/none/)
    assert.doesNotMatch(output, /Agent not found|Unknown agent/i)
    assert.doesNotMatch(output, /analyzer_agent_only|Analyzer.*degraded/)

    const databasePath = join(pluginDirectory, "analyzer", "data.sqlite")
    const db = new DatabaseSync(databasePath)
    let eventCountBeforeReload = 0
    let sessionCountBeforeReload = 0
    try {
      assert.equal(db.prepare("PRAGMA user_version").get().user_version, 1)
      assert.equal(
        db.prepare("PRAGMA journal_mode").get().journal_mode,
        "wal",
      )
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name)
      assert.ok(tables.includes("sessions"))
      assert.ok(tables.includes("agent_runs"))
      assert.ok(tables.includes("model_requests"))
      assert.ok(tables.includes("tool_calls"))
      assert.ok(tables.includes("events"))
      assert.ok(tables.includes("config_versions"))
      assert.equal(
        db.prepare("SELECT COUNT(*) AS count FROM config_versions").get().count,
        1,
      )
      assert.ok(db.prepare("SELECT COUNT(*) AS count FROM events").get().count > 0)
      assert.ok(db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count > 0)
      const storedEvents = JSON.stringify(db.prepare("SELECT details_json FROM events").all())
      assert.doesNotMatch(storedEvents, /Verify plugin startup only/)
      assert.equal(
        db.prepare("SELECT value FROM metadata WHERE key = 'collector_status'").get()
          .value,
        "stopped",
      )
      eventCountBeforeReload =
        db.prepare("SELECT COUNT(*) AS count FROM events").get().count
      sessionCountBeforeReload =
        db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count
    } finally {
      db.close()
    }

    const repeatedResult = runInvalidModel(
      project,
      home,
      "Check that a later startup preserves the existing Analyzer database.",
    )
    const repeatedOutput = `${repeatedResult.stdout ?? ""}\n${repeatedResult.stderr ?? ""}`
    assert.equal(repeatedResult.error, undefined, repeatedOutput)
    assert.equal(repeatedResult.status, 1, repeatedOutput)
    assert.match(repeatedOutput, /Model unavailable: invalid\/none/)
    assert.doesNotMatch(repeatedOutput, /Analyzer.*degraded/i)
    const repeatedDb = new DatabaseSync(databasePath)
    try {
      assert.equal(
        repeatedDb.prepare("PRAGMA user_version").get().user_version,
        1,
      )
      assert.equal(
        repeatedDb.prepare("SELECT COUNT(*) AS count FROM config_versions").get()
          .count,
        1,
      )
      assert.ok(
        repeatedDb.prepare("SELECT COUNT(*) AS count FROM events").get().count >=
          eventCountBeforeReload,
      )
      assert.ok(
        repeatedDb.prepare("SELECT COUNT(*) AS count FROM sessions").get().count >=
          sessionCountBeforeReload,
      )
    } finally {
      repeatedDb.close()
    }

    const unavailableHome = join(directory, "database-unavailable-home")
    const unavailableProject = join(directory, "database-unavailable-project")
    const unavailablePlugins = join(unavailableProject, ".opencode", "plugins")
    const unavailableAnalyzerPlugin = join(unavailablePlugins, "analyzer")
    await mkdir(join(unavailableHome, ".config", "opencode"), { recursive: true })
    await mkdir(join(unavailableHome, "tmp"), { recursive: true })
    await mkdir(unavailableAnalyzerPlugin, { recursive: true })
    await mkdir(join(unavailableProject, ".opencode", "agents"), { recursive: true })
    await writeFile(
      join(unavailableHome, ".config", "opencode", "opencode.json"),
      JSON.stringify({ update: "disable" }),
    )
    await copyFile(
      join(repository, "templates/plugins/analyzer/index.ts"),
      join(unavailableAnalyzerPlugin, "index.ts"),
    )
    await copyFile(
      join(repository, "templates/agents/analyzer.md"),
      join(unavailableProject, ".opencode", "agents", "analyzer.md"),
    )
    await mkdir(join(unavailablePlugins, "analyzer", "data.sqlite"), {
      recursive: true,
    })

    const unavailableResult = runInvalidModel(
      unavailableProject,
      unavailableHome,
      "Verify Analyzer degrades safely without a database.",
    )
    const unavailableOutput = `${unavailableResult.stdout ?? ""}\n${unavailableResult.stderr ?? ""}`
    assert.equal(unavailableResult.error, undefined, unavailableOutput)
    assert.equal(unavailableResult.status, 1, unavailableOutput)
    assert.match(unavailableOutput, /Model unavailable: invalid\/none/)
  },
)

test(
  "OpenCode V2 discovers the Hooks plugin directory with its disabled YAML config",
  { skip: !openCodeV2Available },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-hooks-smoke-"))
    t.after(() => rm(directory, { recursive: true, force: true }))
    const home = join(directory, "home")
    const project = join(directory, "project")
    const userConfig = join(home, ".config", "opencode")
    const hooksDirectory = join(project, ".opencode", "plugins", "hooks")
    const pluginSource = join(
      fileURLToPath(new URL("../templates/plugins/hooks/", import.meta.url)),
    )
    await mkdir(join(home, "tmp"), { recursive: true })
    await mkdir(userConfig, { recursive: true })
    await mkdir(hooksDirectory, { recursive: true })
    await writeFile(
      join(userConfig, "opencode.json"),
      JSON.stringify({
        $schema: "https://opencode.ai/config.json",
        update: "disable",
      }),
    )
    await copyFile(join(pluginSource, "index.ts"), join(hooksDirectory, "index.ts"))
    await copyFile(join(pluginSource, "hooks.yml"), join(hooksDirectory, "hooks.yml"))

    const result = runInvalidModel(
      project,
      home,
      "Verify Hooks plugin startup only; do not run any hook actions.",
      { agent: null, logLevel: "info" },
    )
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    const log = await readFile(
      join(home, ".local", "share", "opencode", "log", "opencode.log"),
      "utf8",
    ).catch(() => "")
    assert.equal(result.error, undefined, output)
    assert.equal(result.status, 1, output)
    assert.match(output, /Model unavailable: invalid\/none/)
    assert.match(log, /loading plugin.*entrypoint=.*hooks\/index\.ts/)
    assert.doesNotMatch(output, /Failed to load plugin|Plugin .* failed to load/i)
  },
)
