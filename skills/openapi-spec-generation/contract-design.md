# Contract structure and design

Use this reference when creating or reviewing the shape of an OpenAPI contract. Examples below are illustrative only; replace them with facts from the project or an explicitly approved design.

## Choose the workflow

- **Design-first:** write or update the contract before implementation. Use when the contract is the agreed interface between teams or clients.
- **Code-first:** derive the contract from route handlers, models, annotations, or a configured generator. Change those sources rather than patching generated output.
- **Hybrid:** maintain annotations or code models and a reviewed contract artifact. Identify which representation is authoritative for each field.

Record the workflow and source of truth in project instructions or the change report. Do not create a second contract because the existing generation path is inconvenient.

## Document structure

An OpenAPI 3.1 document normally has:

- `openapi` and `info` metadata.
- `servers` only when the project provides verified server bases; relative paths are acceptable.
- `paths` containing operations and their parameters, request bodies, responses, and security.
- `components` for reusable schemas, parameters, responses, request bodies, and security schemes.
- Top-level `security` only when the same requirement applies to the API by default.

Minimal illustrative shape:

```yaml
openapi: 3.1.0
info:
  title: Example service API
  version: 1.0.0
servers:
  - url: /api/v1
paths:
  /items/{itemId}:
    get:
      operationId: getItem
      summary: Get an item
      parameters:
        - name: itemId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Item returned
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Item"
        "404":
          $ref: "#/components/responses/NotFound"
components:
  schemas:
    Item:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
        name:
          type: string
  responses:
    NotFound:
      description: Item not found
```

## Operations and reusable components

- Give every operation a unique, stable `operationId`; use the project's naming convention.
- Provide a useful `summary`; add a longer `description` only when it clarifies behavior.
- Declare each path, query, header, and cookie parameter in the correct location. Path parameters must be required.
- Define request bodies only for methods and behaviors that actually accept them. Use the media types the implementation supports.
- Document successful and relevant error responses, including their body schemas and headers.
- Move repeated schemas, parameters, and response definitions into `components` and reference them locally with `$ref`.
- Avoid duplicate or unused components. Do not create a component solely to avoid a small amount of clear repetition.

## Schemas and examples

- Use JSON Schema types and constraints that match the API: `required`, `enum`, `format`, numeric bounds, string lengths, array items, and object properties.
- OpenAPI 3.1 follows JSON Schema null semantics. For a nullable string, use `type: [string, "null"]`; do not use the OpenAPI 3.0 `nullable: true` keyword.
- Set `additionalProperties` deliberately when the object shape is important; do not invent a closed schema if the implementation accepts arbitrary fields.
- Distinguish create, update, and response models when their required fields or read/write behavior differ.
- Keep examples valid against their schemas. Use synthetic values and label illustrative examples as such.

## Security and compatibility

- Model only authentication schemes and authorization requirements found in project code, configuration, or approved requirements.
- Reference reusable security schemes from operations. An operation-level empty `security` list makes an operation public; use it only when that is verified.
- Do not put tokens, credentials, private hostnames, personal data, or customer data in examples.
- Treat removed fields, changed requiredness, status-code changes, and security changes as compatibility changes. Explain impact and migration needs.
- Record a proposed contract decision separately from implemented behavior.
