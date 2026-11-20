# Sequence source format

## Files and names

- The default location is `.opencode/docs/diagrams/sequence/`. Prefer the project's documented paths and naming when they exist.
- Name the file `Sequence_<ProcessName>.puml`; one coherent process per file. Reuse the existing file name and aliases when updating a diagram.
- Save as UTF-8 with one `@startuml Sequence_<ProcessName>` block whose identifier equals the filename stem and contains only letters, digits and underscores. End with `@enduml`.
- Put localized human-readable text in `title`, labels and messages; identifiers and aliases stay ASCII.
- Add `title` and `autonumber` as appropriate.

## Portability

- Use native PlantUML sequence syntax only; no remote `!include`, proprietary macros, image-based participants or external rendering dependencies.
- Prefer stable features supported by older PlantUML4Idea engines.
- Keep diagrams focused; split long flows rather than shrinking labels to unreadable text. Do not bind the source to an external image or generated output.

## Editing existing diagrams

- Start from `examples/Sequence_CreateOrder.puml` as a syntax reference for a new diagram, replacing fictional data with verified project facts.
- Update the smallest affected part of an existing diagram; keep unrelated messages and aliases unchanged.
