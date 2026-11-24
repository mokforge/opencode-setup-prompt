# Confluence access, authentication and API

## Connection details

- Confluence Cloud base URL: `https://<site>.atlassian.net/wiki`.
- Confluence Server/Data Center may use `https://<host>/confluence` or another context path. Do not assume `/wiki`; take the base URL from the project configuration or the user.
- Page URL shape: `.../spaces/<SPACE>/pages/<PAGE_ID>/<Title>`. Extract the numeric page ID, not the title slug.
- Ask for the site, space key and page ID/title when they are not in the task. Do not guess a tenant.

## Authentication

- Prefer an existing authenticated MCP server or a project-provided client. Do not invent credentials.
- Cloud commonly uses the account email plus an API token with Basic authentication. Server/Data Center may use a personal access token or the organization's approved method.
- Keep credentials in environment variables or a secret manager, never in Markdown, source, command history, logs, reports or examples.
- Suggested variable names: `CONFLUENCE_BASE_URL`, `CONFLUENCE_EMAIL`, `CONFLUENCE_API_TOKEN`, `CONFLUENCE_SPACE`.
- Do not echo the token or place it in a command argument where process listings or logs can capture it. Use a helper that reads from the environment.
- If authentication fails, report `401`/`403` and the missing permission; do not retry with another credential or ask the user to paste a token into chat.

## MCP or REST

Use an Atlassian MCP server when available and sufficient:

- search pages with CQL;
- read a page and metadata;
- list children, labels or spaces;
- create or update small pages.

Verify the actual tool names exposed by the installed MCP server; names differ between servers. Do not call an imagined `confluence_*` tool.

Use the Confluence REST API when:

- the page is large or the MCP payload limit is reached (`413` or a client-side size error);
- attachments or images must be uploaded or downloaded;
- you need exact version control or storage-format content;
- you need page history, properties or a feature the MCP server does not expose.

Some MCP servers impose small payload limits. Do not assume MCP is suitable for publishing a page with images or a large body.

## REST endpoints

Use the site's base URL, then:

- search: `GET /rest/api/content/search?cql=<encoded CQL>&limit=...&start=...`
- page: `GET /rest/api/content/{id}?expand=body.storage,version,space,ancestors,children.page,metadata.labels`
- page by title: `GET /rest/api/content?spaceKey=<SPACE>&title=<Title>&expand=body.storage,version`
- create: `POST /rest/api/content` with `type: page`, `title`, `space`, `ancestors` (optional), `body.storage`
- update: `PUT /rest/api/content/{id}` with the next `version.number` and a version comment
- children: `GET /rest/api/content/{id}/child/page?limit=...`
- attachments: `GET /rest/api/content/{id}/child/attachment?limit=...`
- download: `GET /rest/api/content/{id}/child/attachment/{attachmentId}/download`
- upload: `POST /rest/api/content/{id}/child/attachment` as multipart with `file` and an optional comment; use the correct `X-Atlassian-Token: no-check` behavior required by the instance if documented
- labels: `GET/POST /rest/api/content/{id}/label`
- page history/version: `GET /rest/api/content/{id}/version`

URL-encode spaces, titles and CQL. Follow `next`/`start` pagination; do not assume the first page is complete.

## Errors and limits

- `400` — malformed storage format, missing title/space, invalid parent or bad request body. Fix the request; do not retry unchanged.
- `401` — missing/invalid credentials. Stop and report.
- `403` — authenticated but not allowed to view/edit the space or page. Stop and report the permission.
- `404` — wrong page ID/space or no access. Re-read the URL; do not create a replacement page.
- `409` — version conflict. Re-read the page, rebase the change on the latest version and retry once with the new version.
- `413` — payload too large. Use the REST API, split the page with the user's agreement, or move large content to attachments.
- `429` — rate limited. Back off with a bounded delay and retry; do not hammer the API.
- Timeouts/network errors are not success. Re-read the page before retrying a write.

## Permission and data boundary

- The external access policy applies to every Confluence call, including reads. Ask before connecting to a site or page not named in the task.
- State what will be sent: page title, space, body, attachments and metadata.
- Do not publish repository secrets, internal hostnames, customer data, logs or credentials.
- Do not use a personal credential for a shared automation without the user's approval.
- Never disable TLS verification or proxy protections to make a connection work.
