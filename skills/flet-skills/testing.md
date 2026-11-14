# Flet testing and troubleshooting

Practical checks for Flet 1.0 apps: integration tests with `flet.testing`, manual UI verification, troubleshooting, and evidence for the report. Read `SKILL.md` for commands and `declarative-ui.md` for rendering rules.

Project conventions take precedence. Use the test command, test layout, and fixture names that the repository already defines.

## Pick the right check

- **Integration test** when behavior is observable in the UI and the project has a working test stack.
- **Manual run** when the change is visual, platform-specific, or the test stack is unavailable.
- **Both** when acceptance criteria cover interaction and appearance.

## Test setup

- The expected stack is pytest plus the `flet.testing` plugin, which supplies the `flet_app` fixture.
- Test files usually live under `tests/` and are named `test_<topic>.py`; test functions start with `test_`.
- Confirm that the project has the test dependency and pytest configuration before claiming tests pass. If they are missing, report it as a separate task. A common setup command is `uv add --dev 'flet[test]>=1.0.5'`, followed by pytest configuration. Do not claim a green result without an actual run.
- Prefer project commands. Typical commands are `uv run flet test` for the suite and `uv run flet test -k <keyword>` for a focused run.

## Integration test pattern

```python
import flet as ft
import flet.testing as ftt


async def test_empty_dashboard(flet_app: ftt.FletTestApp) -> None:
    await flet_app.tester.pump_and_settle()
    empty = await flet_app.tester.find_by_text("Nothing here yet")
    assert empty.count == 1
```

Useful practices:

- Call `await flet_app.tester.pump_and_settle()` after an interaction so the test waits for rendering.
- Locate elements with a stable `key` through `find_by_key`, or by visible text when the text is part of the contract.
- If a selector is brittle, add a `key=` to the control instead of relying on layout order.
- Match the project's language in assertions when the copy is part of the acceptance criteria.
- Keep test data isolated. Do not touch the real data directory used by a running app, for example `.flet/storage/data`.
- One test should verify one behavior. Cover the happy path, empty and invalid input, error handling, and repeated actions.

## What to cover

- The primary scenario from the acceptance criteria.
- Empty, loading, and error states that the user can encounter.
- Boundary values and invalid input where the screen accepts data.
- Repeating an action, reopening a dialog, or navigating back.
- Database constraints and migration rollback when the change touches persistence.

Do not relax or delete an existing test just to make the suite pass.

## Manual verification

- Start the app and watch stdout. Many handler exceptions appear there while the UI shows only a generic error banner.
- Exercise the target scenario, then the empty state, the error state, and a repeated action.
- Use `flet run --web` for browser behavior and a narrow viewport or device/emulator build for mobile layout when the task requires it.
- Compare the result with the project's design documentation and tokens; describe a mismatch instead of silently changing the design.
- Attach a screenshot or browser artifact when a tool is available; otherwise report exactly what was observed.
- Note which surfaces were covered: desktop, web, device, or emulator.

## Troubleshooting

- **Generic Flet error banner:** inspect Python stdout and the first traceback before changing the UI.
- **`IndexError` in a handler:** check the collection length and whether the selected item still exists.
- **Port already in use:** use the URL and port printed by Flet, or pass a free port.
- **Missing file:** verify `FLET_ASSETS_DIR` and asset-relative paths. For writable files, verify the `FLET_APP_STORAGE_*` variables rather than the current directory.
- **Operation appears frozen:** look for synchronous I/O inside a UI handler.
- **Renderer error:** a component was probably created outside a render; see `declarative-ui.md`.
- **Unexpected route value:** validate the `TemplateRoute` parameter before conversion.
- **Event type mismatch:** annotate the concrete control in `ft.Event[...]` or omit the argument.

## Reporting

Include:

- The command used and its result.
- The scenarios and states that were exercised.
- For failures: the command, a short output excerpt, and reproduction steps.
- The surfaces checked and anything left unverified, with the reason.

## Checklist

- The test stack exists and the tests were actually run.
- Integration tests wait for rendering and use stable selectors.
- Acceptance-criteria text and boundary cases are covered.
- Test data is isolated from real application storage.
- The app was run manually when visual or platform behavior mattered.
- Existing tests were not weakened to obtain a green result.
- Evidence and remaining risks are in the report.
