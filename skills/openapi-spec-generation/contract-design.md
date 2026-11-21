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
- `components` for reusable schemas, parameters, headers, responses, request bodies, examples, and security schemes.
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
- Declare every applicable path, query, header, and cookie parameter in `parameters`, with the correct `in`, `schema`, requiredness, and useful description. Path parameters must be required. Put input fields for a body in the request-body schema, not in parameters.
- Define request bodies only for methods and behaviors that actually accept them. Set `requestBody.required` accurately and use the media types the implementation supports. List fields under `schema.properties` and include `schema.required` only for fields the endpoint requires.
- For `PATCH`, document the actual patch media type and semantics (for example, JSON Merge Patch, JSON Patch, or a project-specific partial-update object). Do not infer patch semantics from the method name alone.
- Put custom request headers in `parameters` with `in: header`; model `Accept` and `Content-Type` through response/request media types, and `Authorization` through security schemes rather than header parameters.
- Document successful and relevant error responses, including response headers under `responses.<status>.headers` and body schemas under `content`.
- Put request and response examples under the matching media type's `examples` map. Keep example values valid against their schemas and use synthetic, non-sensitive data.
- Move repeated schemas, parameters, and response definitions into `components` and reference them locally with `$ref`.
- Avoid duplicate or unused components. Do not create a component solely to avoid a small amount of clear repetition.

### Comprehensive capability showcase

Apply this section only when the user asks for a broad template or a synthetic demonstration of OpenAPI capabilities. It does not authorize adding fictional behavior to a contract for a real project:

- For an existing API, include only methods, parameters, headers, media types, and responses verified in code or approved requirements. Do not add a full CRUD set or optional headers just because they are common.
- For a synthetic showcase, label the API and its examples as fictional. The OpenAPI 3.1 Path Item operation keys are `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, and `trace`; `CONNECT` is not an OpenAPI 3.1 Path Item operation.
- Demonstrate required and optional path/query/header/cookie parameters accurately. Path parameters are always required. Put custom headers in `parameters`; model authentication with security schemes, and model `Accept`/`Content-Type` through media types rather than as ordinary parameters.
- Show both required and optional request bodies only where the operation semantics allow them. `requestBody.required` controls whether the whole body may be omitted; the schema's `required` array controls which fields must appear when a body is sent. Use distinct create, full-replacement, and partial-update schemas when their semantics differ.
- Include only the request media types supported by the operation. A capability showcase may illustrate JSON, a verified PATCH format, or `multipart/form-data`; for multipart, put fields in the body schema and describe per-part media types with `encoding`. In OpenAPI 3.1, model file content with JSON Schema keywords such as `contentMediaType` (and `contentEncoding` when appropriate); do not mechanically copy OpenAPI 3.0 `format: binary` examples.
- Document successful and relevant error responses, including response headers under the matching response. A `HEAD` response has no body; `204` and `304` responses also have no body. Use response links only when they describe a real or explicitly illustrative follow-up operation.
- `OPTIONS` may document the supported methods with `Allow`, but it does not guarantee that a browser's CORS preflight will succeed. CORS depends on server/deployment configuration.
- `TRACE` is generally disabled and can expose sensitive request headers if reflected. Do not add it to a real contract without explicit verification and security review. If included solely to demonstrate syntax, mark it as illustrative and use a harmless request example with no credentials, cookies, or sensitive data.
- Reuse local components for repeated headers, parameters, schemas, responses, examples, and security schemes where useful. Keep every example synthetic and valid against its schema.

### Complete PATCH operation example

This illustrative OpenAPI 3.1 fragment includes path, query, and header parameters, a partial-update body with input fields, a request example, response headers, and multiple response examples. It uses JSON Merge Patch only for illustration; use the format and behavior verified in the project.

```yaml
openapi: 3.1.0
info:
  title: Example inventory API
  version: 1.0.0
servers:
  - url: /api/v1
paths:
  /widgets/{widgetId}:
    patch:
      operationId: updateWidget
      summary: Update widget fields
      parameters:
        - name: widgetId
          in: path
          required: true
          description: Widget identifier.
          schema:
            type: string
          example: widget-123
        - name: dryRun
          in: query
          required: false
          description: Validate the update without persisting it.
          schema:
            type: boolean
            default: false
          example: false
        - name: X-Request-Id
          in: header
          required: false
          description: Optional request correlation identifier.
          schema:
            type: string
          example: req-7f31
      requestBody:
        required: true
        content:
          application/merge-patch+json:
            schema:
              type: object
              minProperties: 1
              properties:
                name:
                  type: string
                  minLength: 1
                enabled:
                  type: boolean
            examples:
              renameAndDisable:
                summary: Rename and disable the widget
                value:
                  name: Compact widget
                  enabled: false
      responses:
        "200":
          description: Widget updated.
          headers:
            ETag:
              description: Current entity tag.
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Widget"
              examples:
                updated:
                  summary: Updated fields
                  value:
                    id: widget-123
                    name: Compact widget
                    enabled: false
                    labels: [hardware]
                unchanged:
                  summary: Existing values retained
                  value:
                    id: widget-123
                    name: Original widget
                    enabled: true
                    labels: [hardware]
        "404":
          description: Widget not found.
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/Problem"
              examples:
                notFound:
                  value:
                    title: Widget not found
                    status: 404
                    detail: No widget exists with identifier widget-123.
        "422":
          description: Request validation failed.
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/Problem"
              examples:
                invalidName:
                  value:
                    title: Validation failed
                    status: 422
                    detail: The name must not be empty.
components:
  schemas:
    Widget:
      type: object
      required: [id, name, enabled]
      properties:
        id:
          type: string
          readOnly: true
        name:
          type: string
        enabled:
          type: boolean
        labels:
          type: array
          items:
            type: string
    Problem:
      type: object
      required: [title, status]
      properties:
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
```

### Interactive execution

OpenAPI describes the operation; it has no standard `execute` field. Swagger UI and similar consoles provide `Try it out`/`Execute` from the documented operation.

- To make an operation usable in an interactive console, describe its supported parameters, request body and media type, responses, and security scheme accurately.
- Set `servers` only to a verified API base. A relative server URL works only when the API is reachable at that path from the console's origin.
- A valid contract alone cannot guarantee a successful call. The endpoint must be reachable, authentication configured, and the server's CORS policy must allow the console's origin. Report any unverified prerequisite; do not invent a server URL or claim the operation was executed.
- Do not add a non-standard `execute` property to an OpenAPI operation.

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
