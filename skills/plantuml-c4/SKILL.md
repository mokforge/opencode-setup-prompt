---
name: plantuml-c4
description: Create, edit, or review C4 architecture diagrams (system context, containers, components) as PlantUML .puml files, including diagrams for JetBrains PlantUML4Idea.
---
# C4 architecture diagrams with PlantUML

Use this skill whenever the task creates, changes, validates, or reviews a C4 diagram. Read [references/jetbrains-and-validation.md](references/jetbrains-and-validation.md) before validating a file. Use the source `.puml` as the deliverable, not only an exported image.

## 1. Establish facts and choose the correct level

- Inspect code, configuration, documented APIs, deployment and the user's requested future design. Never fabricate a system, API consumer, queue, storage, or technology. Distinguish *observed* from *proposed* elements in the report.
- **L1 System Context:** one software system, its users, and neighboring systems; use `!include <C4/C4_Context>` and `Person`, `System`, `System_Ext`.
- **L2 Container:** one software system boundary with independently runnable/deployable applications or data stores. Use `!include <C4/C4_Container>`, `System_Boundary`, `Container`, `ContainerDb`, and `ContainerQueue`. Here "container" is a C4 runtime/deployable unit, not necessarily Docker.
- **L3 Component:** components *inside one selected container* (handlers, domain services, adapters, etc.). Use `!include <C4/C4_Component>`, `Container_Boundary`, and `Component`; include adjacent real containers only for context. Do **not** draw components in an L2 diagram or label internal code modules as separate containers.
- Use the smallest level that answers the architecture question. For a service's internal layers, prefer L3 over incorrectly mixing L2 and L3.
- **Correct legacy mixed levels:** A file labeled "L2 Container" that places `Component(...)` inside `Container_Boundary(...)` is not a valid representation of L2. If the task changes that diagram, separate it into an L2 container view and an L3 component view for the relevant container, based only on verified architecture. Retain confirmed actors, dependencies, protocols, and relationship directions; represent cross-container communication at container granularity on L2, and internal component collaboration on L3. Do not blindly duplicate elements or silently drop edges. If the intended container boundaries cannot be established, report the ambiguity and request a decision instead of inventing a decomposition. Do not mass-rewrite unrelated diagrams.

## 2. Source format

- Prefer existing project documentation paths, conventions, and filenames. For the setup's default, use `.opencode/docs/diagrams/c4/C4_<SystemName>.puml` (L1 or L2) or `C4_<ContainerName>_Component.puml` (L3). Preserve existing filename when editing it.
- One `@startuml <ASCII_identifier>` ... `@enduml` block per `.puml` source; identifier equals the filename stem, with only letters, digits and underscores. Put localized human-readable text in `title` and labels.
- Prefer the **bundled, offline** C4 standard library: exactly the include for the chosen level, such as `!include <C4/C4_Container>`. Do not use remote `!include` URLs, `<style>` plugins, Mermaid, Structurizr DSL, or image-only diagrams. The C4 component include already includes its parent library.
- Introduce every alias once before it is referenced. Prefer ASCII identifiers (`camelCase`), quoted human-readable labels, short descriptions, and real technologies only. Avoid invented C4 macros or mixed level semantics.
- Use `Rel(from, to, "verb phrase", "protocol/technology")`, reversing endpoints only when the real flow is reversed. Optionally `Rel_D` / `Rel_U` / `Rel_L` / `Rel_R` for layout, but never to change semantic direction. Show callers, data stores, event producers and consumers where confirmed. Avoid walls of edges; split the view if needed.
- Use `LAYOUT_WITH_LEGEND()` where legibility permits. Keep the diagram renderable without external image assets. Do not bind appearance to an unversioned external URL.

## 3. Examples and review

Read the runnable examples for the chosen level; replace their fictional elements with project-specific facts:
- [examples/C4_Store_Context.puml](examples/C4_Store_Context.puml)
- [examples/C4_Store_Container.puml](examples/C4_Store_Container.puml)
- [examples/C4_Store_Api_Component.puml](examples/C4_Store_Api_Component.puml)

When updating an existing diagram, preserve aliases and untouched elements; add only impacted relationships and boundaries. Validate a whole `.puml` file, not a Markdown code fence. Follow the validation steps in the reference: use CLI syntax check (and test rendering) with the PlantUML version used by the IDE when possible, then visually preview in PlantUML4Idea. Fix errors before reporting completion. If no local renderer is available, state **not validated**; do not claim IDE compatibility from visual inspection of text alone.

## 4. Report

List output paths, chosen C4 level and scope, source evidence for the depicted elements, syntax-check command/version/result, preview status, and unresolved assumptions. Report deviations from code or architecture rules instead of silently editing the source of truth.
