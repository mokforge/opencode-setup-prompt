# Vue 3 components

## Single-File Components

- Use the project's existing component format. In build-tool-based Vue 3 apps, `.vue` Single-File Components are the default; keep template, component logic, and styles cohesive.
- In a Composition API project, prefer `<script setup>` for new SFCs. Use `lang="ts"` when TypeScript is configured. Existing Options API components remain valid; do not rewrite them as incidental cleanup.
- Keep one component focused on one UI responsibility. Extract a child when it clarifies reuse, independent state, or a public component boundary, not just to move lines elsewhere.
- Keep templates readable and declarative. Move non-trivial calculations and branching into typed functions or computed values.
- Use template refs only for cases that need direct DOM or child-instance access; prefer props/events for normal component communication.

## Component contracts

- Define required and optional props precisely, including types and defaults. Do not mutate a prop; emit an event or call a parent-owned action when a child needs to request a change.
- Declare emitted events and their payloads. Use the project's established runtime or type-based declarations consistently; do not mix both declaration styles for the same macro.
- Use slots when a parent needs to provide structured content. Document named slots and slot props through the component's interface.
- Avoid exposing internals with `defineExpose` unless a real imperative use case requires it.
- Keep models and API response shapes out of component props when a view model or domain type already defines a stable app-level contract.

## Composables

- Extract reusable stateful logic into composables named `useSomething` when it represents a coherent behavior shared across components.
- Return an explicit object with documented refs, computed values, and actions. Keep ownership and lifetime clear: composable-local state is per call unless deliberately created at module scope.
- Clean up event listeners, timers, subscriptions, and pending work when the owning component or effect is disposed.
- Test composables with direct calls when they only use reactivity. Use a host component when the composable requires lifecycle hooks, provide/inject, or a mounted instance.

## Template behavior

- Render conditional branches clearly; avoid using `v-if` and `v-for` on the same node. Filter data with a computed value, then render the result.
- Use a stable primitive key derived from item identity. Do not use array indexes for lists that can reorder, insert, remove, or preserve per-item state.
- Bind DOM events through Vue's event syntax and keep handlers focused on user intent.
- Preserve semantic HTML, labels, keyboard behavior, and accessible names when building controls.
