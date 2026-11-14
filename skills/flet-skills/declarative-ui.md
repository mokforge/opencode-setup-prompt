# Flet UI patterns

Reference for building Flet 1.0 interfaces. Project rules, configuration, and design documentation override these defaults. For the entry point and commands, see `SKILL.md`; for verification, see `testing.md`.

## Rendering model

In Flet 1.0 a screen can be expressed as a component: a function decorated with `@ft.component` that returns a control. The component reads state and describes the UI; Flet decides which parts need repainting after state changes.

```python
import flet as ft


@ft.component
def Dashboard() -> ft.Control:
    visits, set_visits = ft.use_state(0)
    return ft.SafeArea(
        content=ft.Column(
            controls=[
                ft.Text(f"Visits: {visits}"),
                ft.Button("Log visit", on_click=lambda: set_visits(visits + 1)),
            ]
        )
    )


def main(page: ft.Page) -> None:
    page.title = "Dashboard"
    page.render(Dashboard)


ft.run(main)
```

Keep the project's existing startup shape. A common one is `ft.run(main)`, where `main(page)` configures the page and mounts the root component with `page.render(Dashboard)`.

Rules that prevent renderer errors:

- Mount a component with `page.render(...)`, never with `page.add(Component())`.
- A component may be instantiated as a child only while another component is rendering.
- Do not combine a declarative component with `page.add`, `page.insert`, or direct control mutations on the same screen.
- For reusable widgets that wrap a Flet control, prefer `@ft.control` with typed fields and `init()` over a custom constructor.

## State ownership

Choose the narrowest state owner that works:

- `@ft.observable` for application data that changes in place: records, settings, the current selection. It can decorate a dataclass.
- `ft.use_state` for screen-local details: input text, a validation message, whether a panel or dialog is open.

Additional rules:

- Keep data and identifiers in state; construct controls during rendering.
- Call hooks at the top level of a component, in the same order on every render. Do not put them inside branches or loops.
- Do not keep the same fact in both an observable model and `use_state`.
- Do not store a control in state and expect it to update like data; store the value the control should render.
- Move long-running work to the background; update state when the operation completes.

## Component boundaries

- Screens coordinate layout and events; smaller components render focused pieces of the interface.
- Pass only the data and callbacks a component needs. Avoid passing a whole application object as a shortcut.
- A component should not read files, query a database, or touch `FLET_APP_STORAGE_*`. Put that behind a service.
- Keep business rules and validation outside the widget layer. The UI decides how to show an error, not whether the operation is valid.
- Build nested components during the parent's render. Constructing one in `main(page)` before `page.render` raises `RuntimeError: No current renderer is set`.

## Navigation

- Keep one authority for the current route. It can live in observable application state, but it must not be duplicated between `page.route` and a component field.
- Normalize the route, handle redirects, and validate parameters in one route-change handler.
- Select the screen during rendering based on the normalized route.
- `TemplateRoute` parameters are dynamic values. Check their type and allowed range before converting them, for example before calling `int(...)`.

## Dialogs and overlays

- Describe dialog content as a component and keep visibility in local state.
- Use `ft.use_dialog` during rendering: pass a `DialogControl` to show it or `None` to hide it. The hook manages `open` and removes the dialog on unmount.
- Example: `ft.use_dialog(ft.AlertDialog(content=ConfirmDialog()) if is_open else None)`.
- `page.show_dialog(<existing DialogControl>)` is acceptable at an imperative edge. Do not construct a component inside that call from a declarative handler; it happens outside a render and fails.
- Do not manipulate `page.overlay` or call `page.update()` to display a declarative dialog.
- Drop references to dialog controls after the dialog closes.

## Mobile layout

- Start from the target phone size and test both iOS and Android, not only desktop.
- Wrap the top-level screen content in `ft.SafeArea` to respect notches and system bars.
- Avoid arbitrary fixed widths and heights. Prefer `expand`, `alignment`, scrolling, and responsive containers.
- Use the project's design tokens for colors, spacing, radii, and typography.
- Test empty states, long labels, the on-screen keyboard, and overflow on a narrow viewport.
- UI copy follows the language required by the product and its acceptance criteria.

## Assets and fonts

- Store images, icons, and fonts in the project's assets directory; Flet exposes that directory to the app.
- Reference assets relative to that directory: `ft.Image(src="icons/avatar.svg")`.
- For `page.fonts`, the key is the family name and the value is a TTC, TTF, or OTF path relative to `assets/`. WOFF2 is not supported there.
- To read an asset from Python, start with `FLET_ASSETS_DIR` and fall back to a path such as `Path(__file__).parent / "assets"`. Use `importlib.resources` only for files packaged with the module.
- Do not resolve assets from `Path.cwd()` or the repository root.
- For writable runtime files, use `FLET_APP_STORAGE_DATA`, `FLET_APP_STORAGE_CACHE`, or `FLET_APP_STORAGE_TEMP`. The working directory during `flet run` is not a stable storage location.

## Repainting

- Treat the UI as a function of state. Change state and let Flet repaint the affected components.
- A `page.update()` in declarative code usually means two rendering styles were mixed. Remove it or isolate the imperative control that needs it.
- If an imperative edge truly requires `page.update()`, add a comment explaining which control is outside the declarative tree.
- Do not perform blocking I/O in an event handler. Run it asynchronously and update state on completion.

## Pitfalls

- **Component outside a render:** creating `Dashboard()` before `page.render(Dashboard)` raises `RuntimeError: No current renderer is set`.
- **Event types are specific:** `ft.Event[ft.Button]` is not compatible with `ft.Event[ft.Control]`. Annotate the actual control or omit the parameter.
- **Route values are strings first:** validate and bound-check a `TemplateRoute` parameter before converting it.
- **Control lists and type checkers:** spreading a list inside a control list can confuse inference. Build the list in two steps or return ordinary controls from a helper.
- **Controls in state:** a saved `ft.Text` is not a reliable source of truth; store the string.
- **Mixed styles:** unnecessary `page.update()` calls, manual overlay edits, and imperative control mutations indicate a screen that should be fully declarative.

## Review checklist

- The root is mounted with `page.render`; no declarative component is passed to `page.add`.
- Application data and local UI state have separate, clear owners.
- Hooks are called unconditionally and in a stable order.
- Components receive data and callbacks and do not access storage directly.
- Navigation has one source of truth and validates dynamic parameters.
- Dialogs use `ft.use_dialog` or a justified imperative edge.
- The screen uses `SafeArea`, adaptive sizing, and project design tokens.
- Asset and font paths are relative and the files exist.
- No unnecessary `page.update()` calls or blocking handlers remain.
