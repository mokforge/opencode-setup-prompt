# C4 source format

## Diagram block

- One diagram per file: exactly one balanced `@startuml <ASCII_identifier>` ... `@enduml` pair. Do not put several blocks in one `.puml`.
- The identifier is the lowercase kebab-case filename stem from the naming rule in `SKILL.md` with hyphens replaced by underscores; it contains only letters, digits and underscores.
- Save as UTF-8. Put localized human-readable text in `title` and labels; identifiers and aliases stay ASCII.
- Keep the diagram renderable without external image assets. Use `LAYOUT_WITH_LEGEND()` where legibility permits.

## Includes

- Use the bundled offline C4 standard library and exactly the include for the chosen level: `<C4/C4_Context>`, `<C4/C4_Container>` or `<C4/C4_Component>`. The component include already pulls in the parent library, so do not add another.
- Do not use remote `!include` URLs, `<style>` plugins, Mermaid, Structurizr DSL or image-only diagrams. Do not bind appearance to an unversioned external URL.

## Elements and relationships

- Declare each alias once before it is referenced. Prefer ASCII `camelCase` aliases, quoted human-readable labels, short descriptions and confirmed technologies.
- Use the macros of the chosen level only; do not invent C4 macros or mix level semantics.
- Use `Rel(from, to, "verb phrase", "protocol/technology")` and reverse the endpoints only when the real flow is reversed. `Rel_D`, `Rel_U`, `Rel_L` and `Rel_R` change layout only, never semantic direction.
- Show callers, data stores, event producers and consumers where confirmed. Avoid walls of edges; split the view instead.

## Editing existing diagrams

- Preserve aliases and untouched elements; add only the impacted boundaries and relationships.
- Do not mass-rewrite unrelated diagrams or silently drop edges.
