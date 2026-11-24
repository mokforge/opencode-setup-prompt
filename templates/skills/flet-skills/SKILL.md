---
name: flet-skills
description: "Flet 1.0 application development: declarative UI, state ownership, navigation, dialogs, responsive layout, assets, and flet.testing. Use when building, reviewing, debugging, or testing a Flet app."
license: MIT
compatibility: opencode
metadata:
  area: flet
---

# Flet app development

This skill covers Flet 1.0 application work: building declarative screens, choosing where state lives, handling navigation and dialogs, keeping the layout mobile-friendly, and verifying the result with `flet.testing`.

Project rules always win: read `.opencode/AGENTS.md`, any nested `AGENTS.md`, and the project's configuration before applying the guidance here. Use the project's commands, directories, and design tokens where they exist. If the Flet version, entry point, test setup, or asset layout cannot be determined from the repository, ask rather than guess.

## Start here

- `declarative-ui.md` — rendering model, state, component boundaries, navigation, dialogs, mobile layout, assets, and common pitfalls. Read it before creating or reviewing UI.
- `testing.md` — test setup, integration tests, manual checks, debugging, and evidence. Read it before running or reporting UI verification.

## Non-negotiables

- One rendering style per screen. Do not mix declarative components with imperative edits of the same controls.
- The root component is rendered with `page.render(...)`. Do not call a component and pass it to `page.add(...)`.
- State holds data, not live controls. Separate application data from short-lived UI state.
- Components receive data and callbacks. File, database, and storage access belongs in services.
- Create child components inside a render, not while configuring the page.
- Keep routing in one place and validate dynamic route values before using them.
- Prefer declarative dialogs through `ft.use_dialog`. Treat `page.show_dialog` as an escape hatch.
- Use `ft.SafeArea`, adaptive sizing, and the project's design tokens instead of hard-coded dimensions.
- Resolve asset and font paths relative to the assets directory; use Flet's storage variables for runtime files.
- Avoid `page.update()` in declarative code. A state change already schedules a re-render.
- Move slow work out of UI handlers and update state when it completes.

## Typical commands

These are defaults; replace them with the project's commands when they exist.

```sh
uv sync
uv run python -m compileall -q src/<package>
uv run flet run
uv run flet run --web
uv run flet test
uv run flet test -k <keyword>
```

Run from the repository root so Flet can read `[tool.flet.app]` from `pyproject.toml`. Use the URL printed by `flet run --web` instead of assuming a port. Build mobile targets only when the task requires them; artifacts go under `build/<target>`.

## Before finishing

- The screen renders declaratively and does not mix styles.
- State has a clear owner; hooks run unconditionally and in a stable order.
- Components do not reach into storage or business logic.
- Navigation and dialogs follow the rules in `declarative-ui.md`.
- The layout survives a narrow screen, long text, and the on-screen keyboard.
- Assets and fonts exist at the referenced paths.
- Compilation and the app run were checked; test evidence follows `testing.md`.
