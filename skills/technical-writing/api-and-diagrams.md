# API documentation and diagrams

## API reference

- Generate reference from the contract when possible: OpenAPI, AsyncAPI, GraphQL schema, protobuf or source annotations. Do not hand-maintain a generated copy.
- For each operation document: purpose, authentication, authorization, path and method, parameters, request body, response fields, status codes, errors, rate limits, pagination, idempotency and versioning.
- State the base URL, environments and version. Do not mix versions in one reference page.
- Use real field names and types. Do not invent optional fields or error codes.
- Include at least one request and response example per operation, plus error examples that a client must handle.
- Document side effects, retries, timeouts and webhook ordering or delivery guarantees.
- Mark experimental, deprecated and removed fields explicitly, with the migration path.
- Link conceptual guides to the reference and reference to the relevant guide; do not duplicate the whole guide in the schema description.

## OpenAPI and AsyncAPI source

- The contract is the source of truth for paths, schemas, status codes and examples. Keep descriptions and examples in the contract when the reference is generated.
- Validate the contract in CI. A schema change without regenerated docs is incomplete.
- Keep examples consistent with the schema and with the documented version.
- Put long explanations in the docs, not in a single schema description field.
- Do not expose internal-only endpoints, admin fields or test servers in public documentation.

## API guides

Separate reference from task-oriented guides:

- authentication and authorization setup;
- first request or quick start;
- pagination, filtering and sorting;
- error handling and retries;
- rate limits and quotas;
- webhooks and events;
- versioning and migration;
- SDK usage, if the project ships one.

Each guide states prerequisites, a working example, the expected result and the next step.

## Diagrams

- A diagram should answer one question. Do not put the whole system into one image.
- Keep the source in the repository: PlantUML (`*.puml`), Mermaid, Structurizr DSL or the project's chosen text format. Do not ship only a generated image.
- Use the project's diagram skill and naming conventions. For C4, use the correct level and file-name level prefix; for sequence diagrams, use the project's `Sequence_<Process>.puml` convention.
- Label elements with real system, container, component, actor and protocol names. Do not invent elements.
- Keep the diagram and the text consistent; link both ways.
- Add a short caption or surrounding explanation: what the reader should notice.
- Add alt text or a text equivalent for diagrams in HTML docs.
- Do not include secrets, personal data or internal hostnames in rendered diagrams.

## Choosing a diagram

- **C4 context (L1):** who uses the system and which external systems it depends on.
- **C4 container (L2):** deployable applications, data stores, queues and their communication.
- **C4 component (L3):** components inside one selected container.
- **Sequence:** one interaction over time, including branches and errors.
- **Flowchart or state diagram:** a process, decision or lifecycle that is not primarily an interaction.
- **Data model:** entities, relationships and constraints; link to the schema reference.

Do not mix C4 levels, and do not turn class diagrams into architecture diagrams.

## Documentation of generated artifacts

- State how to regenerate API reference, CLI reference, configuration tables and diagrams.
- Record the source file, command and version used.
- Keep generated output out of manual edits; fix the source instead.
- Check generated docs after schema, annotation or template changes.
- If generation is not available, say so and mark the hand-written page as potentially stale.
