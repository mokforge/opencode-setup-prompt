import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { fileURLToPath } from "node:url"

const skillsRoot = new URL("../templates/skills/", import.meta.url)

const skills = [
  {
    id: "flutter-skills",
    files: ["architecture.md", "ui-and-state.md", "testing.md"],
  },
  {
    id: "vue3-skills",
    files: ["components.md", "reactivity.md", "testing.md", "security.md"],
  },
]

test("Flutter and Vue 3 skill templates are self-contained and have no external links", async () => {
  for (const skill of skills) {
    const skillDirectory = new URL(`${skill.id}/`, skillsRoot)
    const entrypoint = await readFile(new URL("SKILL.md", skillDirectory), "utf8")
    const license = await readFile(new URL("LICENSE", skillDirectory), "utf8")

    assert.match(entrypoint, new RegExp(`^---\\nname: ${skill.id}\\n`))
    assert.match(entrypoint, /^description: ".+"/m)
    assert.match(entrypoint, /^license: MIT$/m)
    assert.match(license, /^MIT License\n/)
    assert.doesNotMatch(entrypoint, /https?:\/\/|www\./i)

    for (const filename of skill.files) {
      const content = await readFile(new URL(filename, skillDirectory), "utf8")
      assert.doesNotMatch(content, /https?:\/\/|www\./i)
    }
  }
})
