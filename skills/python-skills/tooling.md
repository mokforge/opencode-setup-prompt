# Python: Project tooling: package manager, pyproject.toml, ruff, types, hooks, CI, builds

## Choosing tools

1. If the project already uses a tool (`uv.lock`, `poetry.lock`, `Pipfile`, `requirements*.txt`, `tox.ini`, `.pre-commit-config.yaml`, a CI section), use it. Do not migrate the project to other tools or change configs without an explicit request.
2. Propose migrations as a separate task and get user approval; never mix a migration with functional changes.
3. The defaults below apply only to a new project or to a request to "set it up from scratch". If something is unclear (minimum Python version, build system, whether the package is published), ask instead of guessing.

## Defaults for a new project

| Task                               | Tool                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Environment, dependencies, running | `uv`                                                                                                                         |
| Linter and formatter               | `ruff`                                                                                                                       |
| Type checking                      | `mypy` (strict mode). `ty` and `pyrefly` are acceptable if the project chooses them, but were in beta at the time of writing |
| Tests                              | `pytest` (+ `pytest-cov`)                                                                                                    |
| Commit hooks                       | `pre-commit` (`prek` is config-compatible if the project already uses it)                                                    |
| Build system                       | `hatchling` for packages; `uv_build` is acceptable for pure Python packages on `uv`                                          |

Take the minimum Python version from the project (`requires-python`, CI, `.python-version`).

## `uv` commands

```bash
uv init --package name     # new package with src layout
uv add package             # runtime dependency
uv add --dev package       # development dependency (dev group)
uv add --group docs package # dependency from another group
uv remove package
uv sync                    # environment from the lock file
uv lock --upgrade-package package
uv run pytest              # run without manually activating the environment
uv run --with package python script.py   # one-off dependency
uv build                   # build sdist and wheel
```

- Commit the lock file (`uv.lock`). In CI install dependencies from it (`uv sync --locked`).
- Do not use `uv pip install` in a project with a lock file: the environment will drift from the lock.
- Development dependencies belong in `[dependency-groups]` (PEP 735), not in `[project.optional-dependencies]`: extras are published with the package, while groups are not.
- One-off scripts declare dependencies with a PEP 723 block (`# /// script`) at the top of the file.

## `pyproject.toml`: basics

```toml
[project]
name = "name"
version = "0.1.0"
requires-python = ">=3.11"          # value from the project
dependencies = []

[dependency-groups]
dev = ["pytest", "pytest-cov", "ruff", "mypy"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 99                    # PEP 8 defaults to 79; a team may use up to 99; the project's value wins
target-version = "py311"

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "SIM", "S", "C4", "RUF"]

[tool.ruff.lint.pycodestyle]
max-doc-length = 72                 # comments and docstrings per PEP 8 (rule W505)

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101"]               # assert is allowed in tests

[tool.mypy]
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = ["--strict-markers", "--strict-config"]
```

- Expand the `ruff` rule set gradually. `select = ["ALL"]` in an existing project causes an avalanche of findings: enable a rule when you are ready to fix what it finds.
- Suppress findings narrowly (`# noqa: CODE` with a reason), not for an entire file.

## Hooks and CI

- Hooks: `ruff` (check with fixes and formatting), type checking, merge-conflict and large-file checks. Pin hook versions (`rev`) and update them deliberately.
- CI runs the same checks as the developer locally, with the same commands. If CI and local commands diverge, fix the mismatch.
- The Python version matrix in CI matches `requires-python`.

## Migration (only on request)

- `requirements.txt` + `pip`: run `uv init`, move dependencies with `uv add -r requirements.txt`, and remove the old files after verification.
- `flake8`/`black`/`isort`: replace with `ruff`; migrate settings (line length, exclusions) and remove the old configs.
- `setup.py`/`setup.cfg`: move metadata to `[project]`, then remove the old files.
- `poetry`: first check whether migration is needed at all; poetry is a fully working tool.

## Builds and publishing

- The version is defined in one place. Release: create a git tag, run `uv build`, inspect the wheel contents, and publish via trusted publishing in CI, not with a token on a developer machine.
- Do not publish or create tags without a user request.
