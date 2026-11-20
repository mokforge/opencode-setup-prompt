---
name: openapi-spec-generation
description: "Design, generate, update, and validate Swagger/OpenAPI 3.1 contracts from project requirements or API code. Use when documenting REST APIs, checking contract drift, or generating SDKs."
license: MIT
compatibility: opencode
metadata:
  area: api-documentation
---

# Swagger / OpenAPI specification generation

Use this skill to create or maintain an OpenAPI 3.1 contract for a REST API. The contract must describe verified project behavior or clearly mark a proposed design.

## When to use

- Designing a new API contract before implementation.
- Documenting routes and models from an existing API.
- Updating a contract after API behavior changes.
- Checking implementation-to-contract drift.
- Generating an SDK when the user requests it.

## Workflow

1. Read project instructions, existing API contracts, route definitions, request/response models, authentication, error handling, and generation scripts.
2. Determine whether the project uses design-first, code-first, or a hybrid workflow. Keep the existing source of truth; do not create a competing specification.
3. Use the repository's existing OpenAPI version, file format, path, naming, tooling, and conventions. If they are absent, make a proposed choice explicit rather than presenting it as an existing project rule.
4. Add or update only operations supported by requirements or source code. Separate implemented behavior from proposed behavior.
5. Reuse local components for repeated schemas, parameters, responses, and security schemes. Keep references resolvable within the contract.
6. Validate with tools already configured in the project. Do not install packages, fetch remote references, publish documentation, or generate SDKs unless the task and external-access policy authorize it.
7. Report changed files, the contract source of truth, validation commands and results, and anything unverified.

## Core rules

- Keep the OpenAPI version explicit. Do not silently convert Swagger 2.0 or OpenAPI 3.0 files to 3.1.
- Preserve existing operation IDs and compatibility unless the task explicitly changes them.
- Use project terminology and actual field names, types, status codes, and security behavior. Do not infer missing endpoints or responses.
- In OpenAPI 3.1, model nullable values with JSON Schema types that include `"null"`; do not copy OpenAPI 3.0 `nullable: true` patterns into a 3.1 schema.
- Path parameters are required. Request and response schemas must match the implementation or the approved design.
- Describe authentication, authorization, errors, pagination, idempotency, and side effects when they apply.
- Keep credentials, secrets, customer data, and unverified live server addresses out of examples.
- Use local references and project sources. Do not add external links, remote `$ref` values, or citations to this skill's files.
- Treat generated specifications and SDKs according to the project's generation workflow; do not hand-edit generated output unless the project requires it.

## References

- [Contract structure and design](contract-design.md) — document structure, reusable components, schemas, operations, and security.
- [Code-first and validation workflows](code-first-and-tooling.md) — framework-derived contracts, local validation, and SDK generation.
- [Validation checklist](validation-checklist.md) — structural and semantic checks before reporting completion.
