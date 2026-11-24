import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const prompt = await readFile(
  new URL("../opencode-setup-prompt.md", import.meta.url),
  "utf8",
)

test("optional catalog skill selection supports multiple choices", () => {
  assert.match(prompt, /required.*must not be presented as selectable options/i)
  assert.match(prompt, /enable multi-select \(`multiple: true` or its equivalent\)/i)
  assert.match(prompt, /never use a single-choice menu of skill IDs/i)
  assert.match(prompt, /free-text or comma-separated list/i)
})
