---
name: flutter-skills
description: "Flutter and Dart application development: architecture, widgets, state, navigation, async data, accessibility, performance, and testing. Use when building, reviewing, debugging, or testing a Flutter app."
license: MIT
compatibility: opencode
metadata:
  area: flutter
---

# Flutter application development

Use this skill for Flutter and Dart application work. Project instructions, nested `AGENTS.md` files, accepted decisions, the pinned Flutter/Dart versions, and established code patterns take precedence over these defaults.

Read the relevant file next to this one:

- `architecture.md` — UI/data boundaries, repositories, services, dependency injection, and optional domain logic.
- `ui-and-state.md` — widget composition, state ownership, async UI, layout, accessibility, and performance.
- `testing.md` — unit, widget, and integration test strategy and verification.

## Workflow

1. Inspect project rules, `pubspec.yaml`, lockfile, Flutter/Dart versions, entry points, app architecture, routing, state management, dependency injection, and existing tests.
2. Identify accepted project decisions. Reuse the existing state, navigation, networking, and styling solutions; do not add packages or replace architecture unless the task explicitly requires it and approval is recorded.
3. Trace the feature's UI-to-data flow. Keep the change within the existing boundaries and implement only the requested behavior.
4. Add or update focused tests for changed behavior and verify with the project's configured checks.
5. Report files changed, checks run, results, and any behavior or platform limitations that remain unverified.

## Core rules

- Keep widgets declarative: build the UI from current state and send user actions to the appropriate state owner.
- Keep I/O and business rules out of widget `build` methods and event callbacks; place them in the established view-model, repository, service, or domain layer.
- Use local widget state for short-lived UI concerns. Keep shared or persisted application state in the existing state-management and repository layers.
- Follow the app's established architecture. For new architecture, start with clear UI and data layers; add view models, repositories, and services where they simplify responsibility boundaries. Add a domain/use-case layer only for complex or genuinely reused logic.
- Keep `build` methods synchronous and inexpensive. Profile before making performance-driven architectural changes.
- Handle loading, empty, success, and error states explicitly for asynchronous UI.
- Respect platform conventions, accessibility, localization, responsive layout, and the project's design system.
- Do not assume a command, package, route, platform, or SDK feature exists; verify it in the repository and the pinned toolchain.
