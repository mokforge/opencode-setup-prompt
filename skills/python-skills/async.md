# Python: Asynchronous code (asyncio)

## When to use async and when not to

- Async fits I/O with many concurrent operations: HTTP, databases, queues, sockets.
- It does not fit CPU-bound work or simple sequential code. Move computations to processes (`ProcessPoolExecutor`) or threads (`asyncio.to_thread` if the library is synchronous).
- If the project is synchronous, do not convert it to async just because it is fashionable. Keep one style at a module boundary: do not mix synchronous and asynchronous interfaces in one function.
- Determine the Python version and the project's libraries (`aiohttp`, `httpx`, `anyio`, `trio`) from the code. The defaults below are for standard `asyncio`; Python versions before 3.11 do not have `TaskGroup` or `asyncio.timeout`, so use `gather` and `wait_for`.

## Core rules

- A coroutine runs when it is `await`ed or wrapped in a task. Calling it without `await` does nothing (a common mistake).
- Have one entry point: `asyncio.run(main())`. Do not call `asyncio.run` inside a running loop.
- Blocking calls (`time.sleep`, `requests`, synchronous database drivers, heavy file operations) inside a coroutine are forbidden: they freeze the entire loop. Replace them with `await asyncio.sleep`, an async client, or `await asyncio.to_thread(...)`.
- Keep references to background tasks (a set or `TaskGroup`): a task without a reference can be garbage-collected before it finishes.

## Concurrency

```python
import asyncio

async def fetch_all(urls: list[str]) -> list[str]:
    async with asyncio.TaskGroup() as tg:          # Python 3.11+
        tasks = [tg.create_task(fetch(u)) for u in urls]
    return [t.result() for t in tasks]
```

- `TaskGroup`: on error it cancels the remaining tasks and raises an `ExceptionGroup`. Use it when all tasks are required for the result.
- `asyncio.gather(*coros, return_exceptions=True)`: collects results and errors separately; after the call, check that each item is not an exception. Without `return_exceptions`, the first error is propagated while the remaining tasks keep running.
- Limit concurrency: `asyncio.Semaphore(N)` or a queue with N workers. A thousand simultaneous connections will kill the service or hit an API limit.

## Timeouts and cancellation

```python
async def with_timeout() -> str:
    try:
        async with asyncio.timeout(5):             # Python 3.11+, otherwise asyncio.wait_for
            return await fetch(url)
    except TimeoutError:
        ...                                        # handling and logging
```

- Do not swallow `asyncio.CancelledError`. If you catch it for cleanup, perform the cleanup and re-raise it (`raise`). Do not catch `BaseException` wholesale.
- Clean up on cancellation with `try/finally` or an async context manager.
- `asyncio.shield` needs a reason: it protects from cancellation, but the task will keep running without an owner.

## Resources and iterators

- Connections, sessions, clients: use `async with` (one shared HTTP client session per application, not per request).
- Stream data with an async generator (`async def` with `yield`), consumed via `async for`. Close the generator if you exit the loop early (`contextlib.aclosing`).
- Protect shared state with `asyncio.Lock`. Do not use `threading.Lock` inside coroutines.
- Communicate between tasks with `asyncio.Queue` and a size limit (`maxsize`) so backpressure works.

## Errors and retries

- Handle or explicitly propagate each task's error; an unhandled exception in a background task is only written to the log and lost.
- Retries: exponential backoff with jitter; see `SKILL.md` for general retry and timeout rules outside async.
- For an unavailable service, implement fast failure (circuit breaker or queue limit) instead of waiting forever.

## Common mistakes

- A missing `await` (the result is a coroutine object, with a `never awaited` warning).
- A blocking call inside a coroutine.
- `asyncio.run` inside an already running loop (in Jupyter and framework handlers).
- Tasks without a stored reference and without exception handling.
- `gather` without a limit on the number of tasks.
- A swallowed `CancelledError`.
- Using `asyncio.get_event_loop()` instead of `asyncio.get_running_loop()` inside coroutines.

## Testing

For the plugin, mode, and techniques for testing async code, see `testing.md`.

## Checklist

- No coroutine contains a blocking call.
- Concurrency is limited, and every wait has a timeout.
- Background tasks are managed (`TaskGroup` or stored references), and errors are handled.
- `CancelledError` is not swallowed, and resources are closed with `async with` or `finally`.
