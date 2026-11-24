# Python: Testing with pytest

## Priorities

Test locations, naming, fixtures, markers, the test command, and the coverage threshold come from the project (the tester's "Project rules" section, `conftest.py`, `pyproject.toml`). The defaults below apply where the project defines nothing. If the project uses `unittest` or another framework, follow it.

## Structure and naming

- Follow the AAA structure: Arrange, Act, Assert, separated by blank lines.
- Name: `test_<what>_<condition>_<expectation>`, for example `test_withdraw_insufficient_funds_raises`.
- Place `test_<module>.py` files in `tests/`, mirroring the package structure. Shared fixtures go in the nearest `conftest.py`.

## Fixtures and parametrization

```python
import pytest

@pytest.fixture
def account() -> Account:
    return Account(balance=100)

@pytest.mark.parametrize(
    ("amount", "expected"),
    [(0, 100), (30, 70), (100, 0)],
    ids=["zero", "partial", "all"],
)
def test_withdraw_valid_amount_reduces_balance(account, amount, expected):
    account.withdraw(amount)
    assert account.balance == expected

def test_withdraw_insufficient_funds_raises(account):
    with pytest.raises(InsufficientFundsError, match="insufficient"):
        account.withdraw(1000)
```

- Use the narrowest fixture scope (the default is `function`). Use `session`/`module` only for expensive immutable resources.
- For setup with cleanup, use `yield` inside the fixture. Use `tmp_path` for temporary files. Use `monkeypatch` for environment variables and attributes.
- Prefer fixture factories over many nearly identical fixtures.

## Mocks

- Mock system boundaries (network, time, filesystem, external services), not your own code.
- Patch where the name is used, not where it is defined: `mocker.patch("package.module.name")`.
- For a mock with an interface type, use `autospec=True` or `create_autospec` so the mock does not accept calls that do not exist.
- Assert on results and observable effects; use `assert_called_with` only where the call itself is the behavior (sending an email, writing to a queue).
- Time: use `freezegun` or `time-machine`, not `sleep`.
- To test retries, mock the call that fails N times and verify the number of attempts and the final result.

## Async tests

- Use the project's plugin (`pytest-asyncio` or `anyio`); take the mode (`asyncio_mode = "auto"` or the `@pytest.mark.asyncio` marker) from the project configuration.
- Declare async fixtures the same way as tests.
- Bound the wait time (`asyncio.timeout`) so a hanging test does not block the suite.
- For HTTP clients and servers, use the framework's test clients (for example, `httpx.AsyncClient` with an ASGI transport), not the real network.

## Integration tests and databases

- Use separate markers (`integration`, `slow`) and keep unit tests runnable without external services.
- Databases: use a transaction per test with rollback or a clean schema per run. Do not share data between tests.
- Test migrations: apply from scratch and roll back if the tool supports it.
- Replace external HTTP services with recorded responses or stubs (`respx`, `responses`), not real calls.

## Coverage

- Coverage shows where there are no checks, not test quality. The threshold comes from the project; new code must not lower it.
- Measure branches (`--cov-branch`) if the project does.
- Mark lines excluded from coverage with a reason.

## Debugging a failing test

1. Run one test: `pytest path::name -x -vv` (use the project's command from "Project rules").
2. Read the actual and expected values instead of guessing.
3. Determine the cause: a code defect, an outdated expectation, or an unstable environment (time, order, shared state, network).
