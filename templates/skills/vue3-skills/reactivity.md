# Vue 3 reactivity and state

## Reactive primitives

- Use `ref` for values and replaceable state; access `.value` in script. Vue unwraps refs in templates and in supported reactive-object contexts.
- Use `reactive` for cohesive object-shaped state when property-level mutation is appropriate. Avoid destructuring reactive properties directly; use `toRefs` or `toRef` when the values must remain reactive.
- Use `computed` for deterministic derived state. Keep computed getters side-effect free.
- Use `watch` or `watchEffect` for side effects such as I/O, synchronization, or subscriptions—not as a second way to store derived state. Prefer explicit watch sources when the dependency should be clear.
- Clean up watcher-owned timers, listeners, or requests through the watch callback's cleanup mechanism. Guard against stale asynchronous responses replacing newer state.

## Ownership and shared state

- Keep transient UI state (open panels, current input, local selection) in the component that owns it.
- Share state only when independent components or features need the same source of truth. Prefer the project's existing store; if none exists, choose the smallest approach that meets the actual scope.
- In a Pinia project, keep state and domain actions in stores and use `storeToRefs` when destructuring reactive state. Do not add Pinia or replace another store as incidental cleanup.
- Keep server data, client cache policy, and presentation state distinct. Avoid storing the same mutable value in several stores or component trees.
- For server-rendered apps, do not keep request-specific reactive state in a module-level singleton. Create state per app/request using the project's SSR setup.

## Async effects

- Represent pending, success, empty, and error states explicitly.
- Handle request cancellation or stale results when inputs can change before a request completes.
- Do not start requests or mutate state from a computed getter or template expression.
- Clean up subscriptions and effects when their owning component or application scope ends.
