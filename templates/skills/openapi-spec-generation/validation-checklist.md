# OpenAPI validation checklist

Apply the checks that fit the task and the project's configured toolchain. Distinguish checks that ran from checks that were unavailable or not applicable.

## Structure

- The declared OpenAPI version matches the project workflow.
- The document parses as YAML or JSON using the repository's configured parser.
- Every path item contains at least one operation; each operation ID is unique.
- HTTP methods match the implementation or approved design. For an explicitly requested showcase, keep synthetic methods clearly illustrative; do not add `CONNECT` as an OpenAPI 3.1 Path Item operation.
- Every path parameter is declared and required.
- Every supported path/query/header/cookie input is in the correct parameter location; request-body fields and requiredness are modeled in the schema.
- Each request body uses a supported media type, has accurate `requestBody.required` and field-level requiredness, and matches the actual method semantics, especially for `PATCH` and multipart encoding.
- Request and response examples are under the correct media type and validate against their schemas. Response headers are declared under the applicable response.
- Every local `$ref` resolves. No unintended remote reference is introduced.
- Response links resolve to the intended operation and parameter names.
- Reusable components are used consistently and no stale duplicate definitions remain.

## Contract accuracy

- Paths, methods, parameters, request bodies, response codes, headers, and schemas match the source of truth.
- Required fields, nullability, formats, constraints, aliases, and read/write behavior match the implementation.
- Success and error responses cover the documented behavior without inventing status codes or payloads.
- Examples validate against their schemas and contain only synthetic data.
- Server bases are present only when verified; illustrative samples use relative paths.
- `HEAD`, `204`, and `304` responses have no body. `OPTIONS` does not imply CORS support; `TRACE` is present only when justified and does not expose sensitive headers.

## Security and compatibility

- Security schemes and operation requirements match actual authentication and authorization behavior.
- Public operations are explicitly justified; no endpoint is made public by omission or an accidental empty security list.
- No secrets, customer data, private hostnames, external links, or unapproved server addresses appear in the contract or examples.
- Breaking changes to required fields, enums, response codes, or security are identified and reported.

## Interactive execution

- When Swagger UI or another interactive console is required, check that `servers`, parameters, request body, and security describe how the operation is actually called.
- Do not add an `execute` field; `Try it out`/`Execute` is provided by the console, not OpenAPI.
- Report reachability, authentication, CORS, or console configuration that could not be verified. Do not claim a live call was tested unless it was authorized and actually performed.

## Completion report

Report changed contract and source files, the chosen source of truth, the OpenAPI version, local validation commands and results, interactive-execution prerequisites or gaps when relevant, SDK outputs if requested, and any unresolved or unverified areas.
