---
name: plantuml-sequence
description: Create, update, or review PlantUML UML sequence diagrams for API flows, processes, events and errors, with syntax and JetBrains PlantUML4Idea compatibility checks.
---

# UML sequence diagrams with PlantUML

Use this skill whenever a task calls for a sequence diagram, interaction flow, API scenario or event exchange. Work with editable UTF-8 `.puml` source, never only a screenshot or Mermaid output.

Detailed rules live next to this file; read only the ones you need:

- `modeling.md` — participants, callers, messages, returns, branches, loops, notes and accuracy. Read before designing or reviewing an interaction.
- `source-format.md` — file location and names, `@startuml` identifiers, portability and minimal updates. Read before writing or changing a `.puml`.
- `validation.md` — structural checks, CLI syntax check, test render and PlantUML4Idea preview. Read before validating a diagram.

## Non-negotiables

- Trace the scenario in requirements, code, API contracts, events and integrations. Separate implemented behavior from proposed behavior and flag unknown callers. Do not invent endpoints, methods, event names or replies.
- One file per coherent process. Unless the project has an established convention, name it `seq-<short-kebab-description>.puml`. Use a valid PlantUML identifier with hyphens replaced by underscores, for example `seq_create_order`.
- Use native PlantUML sequence syntax only: no remote `!include`, proprietary macros, image-based participants or external rendering dependencies.
- Keep the diagram focused and split long flows rather than shrinking labels to unreadable text.
- Validate the source, syntax and rendering honestly, and report what was and was not executed.

## Before finishing

- The file is a UTF-8 `.puml` with one balanced `@startuml`/`@enduml` pair and an identifier matching the filename stem after replacing hyphens with underscores.
- Every participant alias is declared, and every message endpoint exists.
- All `alt`/`else`/`opt`/`loop`/`par` blocks are closed, and `activate`/`deactivate` are balanced.
- Branches, errors and optional steps reflect documented behavior, not guesses.
- Syntax check, test render and IDE preview status are known and reported separately.

## Report

List the file path, scenario, validated behavior, source evidence, check command/version/result, preview status and open assumptions.
