# Flutter testing

## Test boundaries

- Follow the repository's test layout, naming, fakes/mocks, and configured commands. Inspect `pubspec.yaml`, lockfile, CI, and test configuration before selecting tools.
- Unit-test pure domain logic, view models, repositories, and data mapping independently. Use deterministic fakes for I/O boundaries; do not call live services or use real credentials.
- Widget-test rendered behavior and user interactions with the project's Flutter test utilities. Cover important loading, success, empty, error, validation, and accessibility states.
- Integration-test critical user journeys across app layers. Keep the suite focused; use the project's existing device/emulator or integration setup.
- Assert public behavior and meaningful output, not private widget fields or implementation details. Do not rely only on golden or snapshot tests when behavior assertions are needed.
- Test boundary conditions and failure paths, including malformed data, timeouts, empty results, and repeated actions where relevant.

## Verification

Use project scripts first. Common Flutter SDK checks, when they match the repository's setup, are:

```sh
flutter analyze
flutter test
```

For formatting checks, use the configured formatter and its check-only mode. Do not assume the working directory, package manager, generated files, or platform build commands.

Do not install test packages, generate platform scaffolding, update lockfiles, or run commands that contact external services unless the task and permission rules allow it. Report exact commands, scope, results, skipped checks, and remaining risks.
