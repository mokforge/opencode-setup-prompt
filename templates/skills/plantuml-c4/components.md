# L3: Components

## Scope

Show the components inside one selected container — handlers, domain services, adapters, repositories and similar building blocks — with just enough neighboring elements to explain the context. L3 answers: how is this container built internally, and which components collaborate?

## Notation

- Include exactly `!include <C4/C4_Component>`; it already includes the parent container library.
- `Container_Boundary(alias, "Label") { ... }` around the components of the selected container.
- `Component(alias, "Label", "Technology", "Description")` for each component.
- `Container`, `ContainerDb` and `ContainerQueue` for adjacent real containers used as context, outside the container boundary.
- `Person` and `System_Ext` for actors and external systems at the edge of the view.
- `Rel(from, to, "verb phrase", "protocol/technology")` for dependencies.

## Rules

- Show components of one container only; do not draw the internal components of other containers.
- Do not turn every class, module or package into a component. A component is a meaningful building block with a responsibility.
- Do not place `System(...)` for the system in scope at L3; use `Container_Boundary` and adjacent containers.
- Show confirmed internal calls and external dependencies. Label a technology only when it is verified.
- Group components by layer or responsibility only when the code supports that grouping. Split the diagram if it grows too large.
- Use `LAYOUT_WITH_LEGEND()` where it improves legibility.

## Example

`examples/c4-l3-store-api.puml` — a fictional Store API container with three components and its database. Replace its elements with verified project facts.
