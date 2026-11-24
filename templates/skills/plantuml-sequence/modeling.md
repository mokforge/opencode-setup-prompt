# Modeling a sequence interaction

## Participants

- Declare participants explicitly with ASCII aliases: `actor` for a human initiator; `participant` for applications and services; `database` or `queue` only where relevant.
- For a confirmed external system, use a descriptive label and `<<external>>` if helpful.
- Keep participants in reading order. Do not turn class or module internals into independent services.
- Identify the entrypoint and the actual caller. If the caller is unknown, use a clearly generic `API client` and call out the unknown in the report.

## Messages and returns

- `A -> B : operation` represents a call or send; `B --> A : response` represents a return.
- Label HTTP calls with the method and path, RPC with the actual method, and events with the documented topic or event name.
- Keep return arrows and protocol/error semantics accurate. Do not draw a return arrow for a fire-and-forget send.
- Use `autonumber` when traceability helps.

## Branches and optional behavior

- Use `alt`/`else`/`end` for exclusive outcomes, `opt` for optional logic, `loop` for repeated steps and `par` for concurrent branches. Close every block.
- Cover the success path and important documented errors. Include timeout or retry behavior only when it is documented.
- Align branches with real acceptance criteria and requirements.

## Notes

- Mark important steps with short `note right of Alias: FR-1, AC-2` annotations only when those IDs actually exist. Do not cite invented requirements.

## Scope control

- Show one coherent process per file; do not mix unrelated scenarios or the full system topology.
- Show the messages needed to explain the scenario; omit internal calls that do not change the observable interaction.
