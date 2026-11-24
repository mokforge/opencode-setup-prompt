---
name: python-skills
description: "Working with Python code: conventions (structure, types, errors, style) and references for project tooling, pytest, asyncio, frameworks, and databases. Use when writing, reviewing, or testing Python."
license: MIT
compatibility: opencode
metadata:
  area: python-skills
---

# Python

The core conventions are below. Detailed references live next to this file; read only the one you need (with the file-reading tool), not all of them at once:

- `tooling.md`: package manager, `pyproject.toml`, ruff, type checking, hooks, CI, builds, legacy migration. Read when changing the environment, dependencies, configs, or builds.
- `testing.md`: pytest, fixtures, mocks, async tests, databases, coverage, debugging failing tests. Read when writing or reviewing tests.
- `async.md`: asyncio, `TaskGroup`, timeouts, cancellation, common mistakes. Read when working with async code.
- `frameworks.md`: FastAPI, Django, Flask, SQLAlchemy and Alembic, pydantic-settings, logging, Typer. Read when working with the web layer, databases, settings, or CLI.

## Priorities

1. Project rules: `.opencode/AGENTS.md`, nested `AGENTS.md` files, the agent's "Project rules" section, and configs (`pyproject.toml`, `ruff.toml`, `mypy.ini`, `setup.cfg`, CI).
2. The style of the surrounding code.
3. This skill's defaults apply only where the project does not define its own. Do not change project configs unless explicitly asked.

Code style follows PEP 8 (details below) unless the project says otherwise. Before applying it, determine from the repository: Python version, formatter and linter, type checker, line length. If something is undefined and affects the result, ask instead of guessing.

## Code structure

- Use a `src/<package>/` layout with tests in `tests/` unless the project already uses another layout.
- External dependencies (databases, HTTP, files) are passed through constructor parameters or function arguments, not global singletons.
- A module solves one problem. Do not create `utils`/`helpers`/`common` packages as dumping grounds: name the module after its purpose.

## Typing

- Annotate parameters, return values, and public attributes. New projects use strict type checking; do not tighten settings in an existing codebase without being asked.
- Use modern syntax supported by the project's Python version: `list[str]`, `X | None` (Python 3.10+; for older versions use `from __future__ import annotations` or `Optional`).
- Structured data: `dataclass(frozen=True, slots=True)` or a pydantic model at system boundaries (input and output), `TypedDict` for dictionaries with a known shape, `Protocol` for interfaces, `Enum`/`Literal` instead of magic strings.
- Use `Any` only at the boundary with untyped code, with a comment explaining why. Use `# type: ignore` only with an error code and a reason.
- For a result that can fail for a business reason, an explicit result type (`Result`, a union type) is acceptable if the project does it that way. Otherwise use exceptions.

## Errors and logging

- Custom exceptions inherit from one base exception of the package; names end with `Error`.
- Bare `except:` and `except Exception: pass` are forbidden. When re-raising another exception, write `raise NewError(...) from exc`.
- At boundaries (HTTP, queues, CLI), errors are translated into a response or exit code; inside the domain they remain exceptions.
- Log through `logging` (or `structlog` if the project uses it), not `print`. Messages include context: what was done and for which identifier.
- External calls (network, database, filesystem) have a timeout. Retry only idempotent operations, with a limited number of attempts.

## Style

- Formatting and imports are handled by the project's tooling (most often `ruff format` and `ruff check --fix`). Do not fight the formatter by hand.
- Use 4-space indentation, no tabs. PEP 8 line length is 79 characters, 72 for comments and docstrings. A team may raise the code line limit to 99 (comments and docstrings stay at 72); the project's value wins.
- Imports go at the top of the file after the module docstring, one per line, in three groups separated by blank lines: standard library, third-party packages, own code. Absolute imports are preferred over relative ones.
- Names: `snake_case` for functions, methods, variables, and modules (modules are short and lowercase); `PascalCase` for classes and exceptions; `UPPER_CASE` for constants; `_name` for internal use. Do not name variables `l`, `O`, or `I`. A name describes meaning, not type.
- Compare with `None` only using `is`/`is not`; do not compare booleans with `True`/`False` (`if flag:`); check an empty sequence as `if not items:`.
- When a function needs a name, declare it with `def`, not by assigning a `lambda`.
- All branches of a function either return a value or none do: if one branch has `return value`, write an explicit `return None` in the others.
- Keep a function shorter than a screen. More than four positional parameters: use keyword parameters or an object.
- Do not use mutable default values (`def f(x=[])`). Use `None` and create the value inside.
- Use `pathlib` for paths, `with` for files, f-strings for strings, and context managers for resources.
- Add docstrings to public modules, functions, classes, and methods (PEP 257), in the project's format (Google or NumPy; determine it from the code).
- Do not use `assert` to validate user input (it is removed by `-O`).

## Anti-patterns

- Global mutable state, singletons, imports with side effects.
- Circular imports (fix them by moving shared code, not by adding a deferred import inside a function).
- `from module import *`, copying code instead of reusing it, long `if/elif` chains instead of a dictionary or `match`.
- Type checks with `type(x) == T` instead of `isinstance`.
- `eval`/`exec`, `pickle` for untrusted data, `shell=True` with user input.
