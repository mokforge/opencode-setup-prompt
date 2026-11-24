# Flutter UI and state

## Widget composition

- Use `StatelessWidget` when the widget has no mutable state of its own; use `StatefulWidget` for short-lived state that belongs to that widget.
- Keep widgets cohesive and small enough to understand. Extract a child widget when it clarifies ownership, reuse, or rebuild behavior; do not split code solely to reduce line count.
- Keep `build` free of I/O, expensive computation, and mutations. Compute presentation values in the view model or a small pure helper.
- Prefer `const` constructors and stable child instances where the UI is immutable.
- Use lazy builders such as `ListView.builder` or `GridView.builder` for long or dynamic collections. Preserve item identity with stable keys when elements can reorder or retain local state.

## State and async work

- Classify each state value by lifetime and owner: ephemeral input/selection state, screen state, shared session state, or persisted model data.
- Use the project's state-management solution for shared state. For a small local interaction, widget state or a built-in `ValueNotifier` may be sufficient; do not introduce a package for one boolean or field.
- Model async screens with explicit loading, data, empty, and error states. Avoid storing a second mutable copy of repository data in a widget when the established state owner already exposes it.
- Prevent stale async results from overwriting newer state when requests can overlap. Cancel subscriptions and dispose controllers, focus nodes, animation controllers, and other owned resources.
- Before using `BuildContext` or updating a `State` after an `await`, check that the relevant context/state is still mounted using APIs supported by the project's Flutter version.
- Do not call `setState` after disposal, start asynchronous work from `build`, or silently discard errors.

## Layout, accessibility, and platform behavior

- Build layouts from available constraints. Use `LayoutBuilder`, `MediaQuery`, safe areas, and scrolling where appropriate instead of assuming one screen size.
- Use the project's theme and design tokens. Avoid scattering fixed colors, spacing, typography, and device-specific dimensions through feature code.
- Provide semantic labels and meaningful control names; preserve keyboard focus and navigation; ensure text scaling and contrast do not break the layout.
- Use localization facilities already configured in the project for user-visible text.
- Respect platform differences where they affect navigation, permissions, input, or user expectations. Do not claim support for a platform without checking the project configuration.

## Performance

- Avoid repeated expensive work in `build`; use lazy collections for large lists and grids.
- Optimize only after identifying a real bottleneck with the project's profiling tools. Do not add memoization, custom rendering, isolates, or caching without measured need.
- Treat clipping, opacity layers, intrinsic layout, and large rebuild scopes carefully in hot paths. Prefer simpler layout or localized state updates where they meet the design.
