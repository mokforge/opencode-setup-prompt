---
name: vue3-skills
description: "Vue 3 application development: Single-File Components, Composition API, TypeScript, reactivity, state, routing, security, performance, and tests. Use when building, reviewing, debugging, or testing a Vue 3 app."
license: MIT
compatibility: opencode
metadata:
  area: vue3
---

# Vue 3 application development

Use this skill for Vue 3 application work. Project instructions, nested `AGENTS.md` files, accepted decisions, the pinned Vue/tooling versions, and established code patterns take precedence over these defaults.

Read the relevant file next to this one:

- `components.md` — Single-File Components, component boundaries, props, events, slots, and composables.
- `reactivity.md` — reactive state, computed values, watchers, shared stores, and async effects.
- `testing.md` — unit, component, and end-to-end test strategy and verification.
- `security.md` — untrusted content, URLs, styles, and client/server security boundaries.

## Workflow

1. Inspect project rules, `package.json`, lockfile, Vue version, build tool, TypeScript configuration, router, state management, component conventions, and existing tests.
2. Preserve the project's accepted architecture and API style. For a new SFC in a Composition API project, use `<script setup>`; use TypeScript when the project is typed. Do not migrate existing Options API code or add libraries unless the task requires and approves it.
3. Trace data and events across components. Keep state with its smallest valid owner and make component interfaces explicit.
4. Implement the smallest change that matches the approved requirements and project conventions.
5. Add focused tests for changed behavior and run the project's configured checks. Report exact commands, results, and anything not verified.

## Core rules

- Treat templates as declarative UI. Keep business logic and side effects out of rendering expressions.
- Use props for parent-to-child data, emitted events for child-to-parent intent, and slots for intentional content composition. Do not mutate props.
- Use `computed` for derived values and watchers for side effects. Avoid duplicating derived state or using a watcher where a computed value is sufficient.
- Keep component-local state local. Use the existing shared-state solution only when multiple independent parts of the app need the same source of truth.
- Use stable keys for `v-for`; avoid combining `v-if` and `v-for` on the same element.
- Never compile untrusted content as a Vue template. Avoid `v-html` for user-controlled data and follow `security.md`.
- Keep performance work measurement-driven. Do not add memoization, virtual scrolling, or new dependencies without demonstrated need.
- Follow the project's configured formatter, linter, type checker, test runner, package manager, and build scripts; do not invent commands.
