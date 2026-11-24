# Vue 3 testing

## Test strategy

- Follow the project's test runner, environment, file naming, fixtures, and package manager. Inspect scripts, lockfiles, and CI before running checks.
- Unit-test pure TypeScript/JavaScript logic and composables that do not require a component instance.
- Component-test rendered output and behavior through props, user events, emitted events, slots, and accessible DOM. Prefer the project's Vue component testing utilities; do not assert private component state or private methods.
- Test components with the plugins, router, and stores they actually require. Keep test setup explicit and avoid a global test wrapper that hides dependencies.
- Test loading, empty, success, validation, and failure states where applicable. Include boundary cases and regression coverage for bugs.
- Use end-to-end tests for critical user journeys and cross-page integration, with the project's existing browser runner and isolated test services.
- Do not rely exclusively on snapshots. Assertions should explain the behavior that must remain correct.
- Unit and component tests must be deterministic and must not call live services or depend on local secrets.

## Composables

- Invoke a composable directly when it only depends on Vue reactivity APIs.
- Mount a small host component when it uses lifecycle hooks, provide/inject, or other component-instance APIs. Unmount it to verify cleanup and avoid leaking effects.

## Verification

Use the commands configured by the project. Common checks might include a package script for unit/component tests, type checking with the configured Vue-aware checker, linting, and a production build. Do not assume a script name or add a test dependency just to run an example.

Report the exact command, scope, result, skipped checks, and any limitations.
