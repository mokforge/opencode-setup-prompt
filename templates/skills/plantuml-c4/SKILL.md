---
name: plantuml-c4
description: Create, edit, or review C4 architecture diagrams (system context, containers, components) as PlantUML .puml files, including diagrams for JetBrains PlantUML4Idea.
---

# C4 architecture diagrams with PlantUML

Use this skill whenever a task creates, changes, validates, or reviews a C4 diagram. The deliverable is an editable UTF-8 `.puml` source file, not only an exported image.

Detailed rules live next to this file; read only the ones you need:

- `system-context.md` — L1: one software system, its users and neighboring systems. Read before creating or reviewing an L1 view.
- `containers.md` — L2: runnable/deployable containers of one system. Read before creating or reviewing an L2 view.
- `components.md` — L3: components inside one selected container. Read before creating or reviewing an L3 view.
- `source-format.md` — identifiers, includes, aliases, relationships, layout and edits. Read before writing any `.puml`.
- `validation.md` — structural checks, CLI syntax check, test render and PlantUML4Idea preview. Read before validating a file.

## File naming and location

The default location is `.opencode/docs/diagrams/c4/`. Use lowercase kebab-case filenames that start with the diagram level:

- `c4-l1-<system-name>.puml` — system context of one system.
- `c4-l2-<system-name>.puml` — containers of that system.
- `c4-l3-<container-name>.puml` — components of one container.

The `c4-l<n>-` prefix is mandatory and its level must match the file content. Never create a C4 diagram without the level in its name, and never put one level in the name and another in the diagram. Since PlantUML identifiers cannot contain hyphens, the `@startuml` identifier is the filename stem with hyphens replaced by underscores.

Prefer the project's documentation paths. If the project has an established naming convention, preserve it when editing existing files; for new C4 files use the lowercase kebab-case patterns above unless the project documents another required form. Keep an existing compliant name when editing the file; if a task requires renaming, report the old and new paths.

## Non-negotiables

- Inspect code, configuration, documented APIs, deployment and the requested future design. Never fabricate a system, API consumer, queue, storage, technology or relationship. Distinguish _observed_ from _proposed_ elements in the report.
- One level per file. Choose the smallest level that answers the architecture question; for the internal layers of a service, prefer a separate L3 view over adding `Component` elements to L2. Do not mix L1, L2 and L3 semantics in one view.
- Use the bundled offline C4 standard library with exactly the include for the chosen level (`<C4/C4_Context>`, `<C4/C4_Container>` or `<C4/C4_Component>`). Never use remote `!include` URLs, `<style>` plugins, Mermaid, Structurizr DSL or image-only diagrams.
- Declare every alias once before use. Use ASCII aliases, quoted human-readable labels, short descriptions and real technologies only. Do not invent C4 macros.
- Show confirmed callers, data stores, producers and consumers. Keep relationship directions and protocols accurate, and split the view instead of drawing walls of edges.
- Validate the whole `.puml` file with a local CLI and inspect the IDE preview when accessible. Never claim validation or rendering you did not execute.

## Legacy diagrams with mixed levels

A file labeled "L2 Container" that places `Component(...)` inside `Container_Boundary(...)` is not an L2 view. If the task changes that diagram, separate it into an L2 container view and an L3 component view for the relevant container, based only on verified architecture. Retain confirmed actors, dependencies, protocols and relationship directions; show cross-container communication at container granularity on L2 and internal component collaboration on L3. Do not duplicate elements blindly or drop edges. If the intended container boundaries cannot be established, report the ambiguity and ask for a decision instead of inventing a decomposition. Do not mass-rewrite unrelated diagrams.

## Before finishing

- The lowercase kebab-case filename starts with `c4-l1-`, `c4-l2-` or `c4-l3-`, and the level matches the content.
- The file has one balanced `@startuml`/`@enduml` pair whose identifier matches the stem after replacing hyphens with underscores.
- Every alias is declared before use, and every relationship endpoint exists.
- The include for the chosen level is offline and no foreign notation is mixed in.
- The example for the level was used as a syntax reference, not as copied architecture.
- Syntax check, test render and IDE preview status are known and reported separately.

## Report

List output paths, chosen C4 level and scope, source evidence for the depicted elements, syntax-check command/version/result, preview status and unresolved assumptions. Report deviations from code or architecture rules instead of silently editing the source of truth.
