# OpenAPI validation checklist

Apply the checks that fit the task and the project's configured toolchain. Distinguish checks that ran from checks that were unavailable or not applicable.

## Structure

- The declared OpenAPI version matches the project workflow.
- The document parses as YAML or JSON using the repository's configured parser.
- Every path item contains at least one operation; each operation ID is unique.
- Every path parameter is declared and required.
- Every local `$ref` resolves. No unintended remote reference is introduced.
- Reusable components are used consistently and no stale duplicate definitions remain.

## Contract accuracy

- Paths, methods, parameters, request bodies, response codes, headers, and schemas match the source of truth.
- Required fields, nullability, formats, constraints, aliases, and read/write behavior match the implementation.
- Success and error responses cover the documented behavior without inventing status codes or payloads.
- Examples validate against their schemas and contain only synthetic data.
- Server bases are present only when verified; illustrative samples use relative paths.

## Security and compatibility

- Security schemes and operation requirements match actual authentication and authorization behavior.
- Public operations are explicitly justified; no endpoint is made public by omission or an accidental empty security list.
- No secrets, customer data, private hostnames, external links, or unapproved server addresses appear in the contract or examples.
- Breaking changes to required fields, enums, response codes, or security are identified and reported.

## Completion report

Report changed contract and source files, the chosen source of truth, the OpenAPI version, local validation commands and results, SDK outputs if requested, and any unresolved or unverified areas.
