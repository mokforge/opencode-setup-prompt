# Flutter architecture

## Boundaries

- Follow the architecture and accepted decisions already present in the project. Do not migrate between state-management or navigation approaches as incidental cleanup.
- Keep UI and data responsibilities separate. A view is a composition of widgets; it presents state and forwards user events.
- Put presentation logic and screen-specific UI state in the project's view model or equivalent state owner. Do not put business rules, API calls, or persistence in widgets.
- Treat repositories as the source of truth for application data. Repositories translate data-source responses into app models and own caching, refresh, retry, and data-level error policy where applicable.
- Keep services at data boundaries. A service wraps one external source, such as an HTTP API, local database, file system, or platform API; it performs I/O and does not own shared application state.
- Use constructor injection or the project's established dependency-injection mechanism. Avoid new global mutable singletons.
- Keep dependency direction clear: views depend on presentation state; presentation and domain logic depend on repository interfaces; repositories use services. A repository should not depend on another repository unless the project has an explicit accepted design for it.
- Use unidirectional data flow: user intent moves toward the data layer, and updated data flows back toward the UI.

## Feature structure

- Organize files by the existing project convention. For new features, group related screens, view models, models, repositories, and services so ownership is clear.
- Prefer immutable data models. Keep API transport models separate from domain models when mapping or versioning makes that boundary useful; do not duplicate simple data types without a real reason.
- Keep a shared repository as the source of truth when multiple features need the same data. Combine multiple repository results in a view model or domain layer rather than coupling repositories to each other.
- A domain/use-case layer is optional. Add it when logic is complex, spans repositories, or is reused by multiple view models; avoid a use-case class that only forwards one call.
- Keep navigation in the established router or navigation layer. Do not add a routing package when the existing navigation setup meets the task.

## New architecture

For a new app or feature without an established structure, prefer the smallest architecture that gives each responsibility a clear owner:

1. View widgets render state and emit user intent.
2. View models prepare view state and coordinate commands.
3. Repositories expose app-level data and define data policies.
4. Services wrap individual I/O boundaries.
5. Optional use cases hold complex or shared business workflows.

Do not create all layers mechanically. A small feature may need only a view, local state, and one repository call. Record significant or user-selected technical decisions in the canonical project documentation before implementation.
