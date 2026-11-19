---
name: plantuml-sequence
description: Create, update, or review PlantUML UML sequence diagrams for API flows, processes, events and errors, with syntax and JetBrains PlantUML4Idea compatibility checks.
---
# UML sequence diagrams with PlantUML

Use this skill whenever a task calls for a sequence diagram, interaction flow, API scenario or event exchange. Work with editable UTF-8 `.puml` source, never only a screenshot or Mermaid output. Read [references/jetbrains-and-validation.md](references/jetbrains-and-validation.md) for the required verification workflow.

## 1. Model the real interaction

- Trace the user scenario in requirements, code, OpenAPI, events and integrations. Separate implemented behavior from proposed behavior and flag unknown callers; do not invent endpoints, methods, event names or replies.
- One file per coherent process. Prefer `.opencode/docs/diagrams/sequence/Sequence_<ProcessName>.puml`, unless project documentation conventions specify another path. Reuse existing file names and aliases during updates.
- Declare participants explicitly with ASCII aliases: `actor` for human initiator; `participant` for applications/services; `database` or `queue` only where relevant. For a confirmed external system, use a descriptive label and `<<external>>` if helpful. Keep participants in reading order; do not turn class/module internals into independent services.
- Identify the entrypoint and actual caller. If the caller is unknown, use a clearly generic `API client` and call out the unknown in the report.
- Messages `A -> B : operation` represent calls/sends; `B --> A : response` represent return messages. Label HTTP calls with method and path, RPC with actual method, and events with documented topic/event name. Keep return arrows and protocol/error semantics accurate.
- Use `alt`/`else`/`end` for exclusive outcomes, `opt` for optional logic, `loop` for repeated steps and `par` for concurrent branches. Close every block. Cover success, important errors, timeout/retry only if documented, and relevant acceptance criteria.
- Mark important steps with short `note right of Alias: FR-1, AC-2` annotations when the IDs actually exist. Do not cite invented requirements. Use `autonumber` for traceability when helpful.

## 2. Portable source

- Source begins with `@startuml Sequence_<ProcessName>` (the identifier must match the filename stem), then `title` and `autonumber` as appropriate; end with `@enduml`. Use UTF-8 text for localized titles and labels.
- Use native PlantUML sequence syntax only; no `!include` from the internet, proprietary macros, image-based participants or external rendering dependencies. Prefer stable features supported by older PlantUML4Idea engines.
- Start from [examples/Sequence_CreateOrder.puml](examples/Sequence_CreateOrder.puml) as a syntax reference, replacing fictional data with verified project facts. Keep diagrams focused; split long flows rather than shrink labels to unreadable text.
- Update the smallest affected part of an existing diagram. Keep unrelated messages and aliases unchanged.

## 3. Acceptance and reporting

Run the checks in the reference for every new or changed `.puml`: source balance, participant alias use, balanced branching/activation, CLI `-checkonly`/equivalent, an actual test render and JetBrains preview when accessible. Never say "validated" if the tool was unavailable; report CLI and IDE preview status separately. List file path, scenario, validated behavior, source evidence, command/version/result and open assumptions.
