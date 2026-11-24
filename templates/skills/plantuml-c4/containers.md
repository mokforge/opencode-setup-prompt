# L2: Containers

## Scope

Show one software system boundary with its independently runnable/deployable applications, services and data stores. A C4 container is a runtime or deployable unit, not necessarily Docker. L2 answers: which applications, APIs, databases, queues and file stores make up the system, and how do they communicate?

## Notation

- Include exactly `!include <C4/C4_Container>`.
- `System_Boundary(alias, "Label") { ... }` for the system in scope.
- `Container(alias, "Label", "Technology", "Description")` for applications and services.
- `ContainerDb(alias, "Label", "Technology", "Description")` for databases and file stores.
- `ContainerQueue(alias, "Label", "Technology", "Description")` for queues and topics.
- `Person`, `System` and `System_Ext` for actors and neighboring systems outside the boundary.
- `Rel(from, to, "verb phrase", "protocol/technology")` for dependencies.

## Rules

- Draw only the containers of the system in scope inside `System_Boundary`; place neighboring systems outside it.
- Never place `Component(...)` in L2 and never label internal modules, packages or layers as containers. If internal structure is needed, create a separate L3 view.
- Give every container its confirmed technology; when it is unknown, omit it or mark it as unknown instead of inventing one.
- Show cross-container calls, reads and writes, publishes and consumes, and confirmed external calls. Do not draw every possible edge.
- Include data stores and event infrastructure when they are part of the system.
- Keep direction and protocol accurate; layout helpers do not change semantics.
- Use `LAYOUT_WITH_LEGEND()` where it improves legibility.

## Example

`examples/c4-l2-store.puml` — a fictional store: an API, an orders database, an event queue and an external payment provider. Replace its elements with verified project facts.
