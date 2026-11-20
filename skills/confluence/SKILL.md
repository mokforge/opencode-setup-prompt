---
name: confluence
description: "Read and export Confluence pages as Markdown with tables, images, attachments, links, code and macros preserved; publish Markdown back to Confluence with version-safe page updates, attachment upload and round-trip validation. Use for Confluence imports, exports, sync and publishing."
license: MIT
compatibility: opencode
metadata:
  area: confluence
---

# Confluence documentation

Use this skill whenever a task reads, exports, imports, syncs or publishes Confluence content. Confluence is an external system: follow the project's external access policy in `.opencode/AGENTS.md` and ask for explicit permission before connecting, reading or writing unless the current request already names the site, space and action.

Detailed rules live next to this file:

- `api-and-auth.md` — Confluence Cloud/Server URLs, authentication, MCP versus REST, endpoints, pagination, rate limits and errors.
- `read-export.md` — locate and read pages, page trees, metadata and attachments; export to Markdown with a stable structure and frontmatter.
- `publish.md` — preflight, create/update, version conflicts, attachments, labels, parent pages, large pages and rollback.
- `conversion.md` — Markdown ↔ Confluence storage format mapping, tables, code, links, callouts, macros and unknown content.
- `images-and-macros.md` — images, attachments, diagrams, panels, expand, TOC and other macros.
- `validation.md` — read-back and round-trip checks for content, tables, images, links and version.
- `examples/` — a sample Markdown page and its Confluence storage representation.

## Mandatory workflow

1. Confirm the external action and scope: site/base URL, space, page ID or title, whether reading or writing, and what data will leave the repository. If the user did not already authorize it, stop and ask with the four details required by the external access policy.
2. Identify the page unambiguously: page ID from the URL, or space key plus exact title. Do not guess a page from a similar title.
3. Choose the access path: an Atlassian MCP server for discovery and small reads/updates, or the Confluence REST API for large pages, attachments or full control. Verify the exact MCP tool names in the installed setup; do not invent them.
4. Read the page in storage format and metadata (version, space, ancestors, children, labels). For export, download attachments and convert with `read-export.md` and `conversion.md`.
5. For publishing, convert Markdown to storage with `conversion.md`, upload attachments first, create or update the page, and then read it back with `validation.md`.
6. Preserve every table, image, attachment, link, code block and macro. If a construct cannot round-trip, keep its source and mark the limitation instead of dropping it.
7. Never claim a page was read, created or updated without the actual response and a read-back check. Report page ID, URL, version and what was verified.

## Non-negotiables

- Never publish, update, move or delete a page without an explicit user request for that page/space and action.
- Never overwrite a newer page version. Read the current version, use optimistic concurrency and retry after a conflict.
- Never create a duplicate when a page with the same space and title exists. Search first and update by page ID.
- Never put credentials, tokens, customer data or secrets into Markdown, page content, examples, logs or reports.
- Never drop content silently. Complex tables, merged cells, images, diagrams, unknown macros and embedded content need an explicit representation or a reported gap.
- Storage format is the source for Confluence API writes. Do not send Markdown or plain HTML as `body.storage` unless it is valid storage format.
- Use a real converter/parser for complex content; do not rely on regex-only conversion for nested lists, tables, macros or code.
- The Confluence editor may render content differently from Markdown preview. Read back the actual page and check the rendered result.
- A successful HTTP 200 is not proof of correct content. Verify the stored body and attachments.

## Read and export summary

- Fetch page metadata and `body.storage`; download attachment binaries to a local attachments directory.
- Write one Markdown file per page with YAML frontmatter containing page ID, space, version, URL, parent, labels and attachments.
- Convert simple tables to GFM tables and complex tables (merged cells, nested tables) to inline HTML tables; never flatten cells silently.
- Replace attachment images with relative Markdown image links; preserve alt text, width, height and alignment where possible.
- Convert known macros to documented Markdown conventions; preserve unknown macro XML in a marked code block with a warning.
- For page trees, keep parent/child structure and avoid cycles; report skipped or inaccessible pages.

## Publish summary

- Preflight: read the target, confirm title/space/parent, version, labels and existing attachments; show a dry-run or content summary.
- Convert Markdown to Confluence storage; upload or replace attachments before referencing them.
- Create a page only when no page ID exists and no title match is found; otherwise update the identified page.
- Send the current version + 1 and handle conflicts by re-reading and rebasing, not by forcing.
- Preserve page ID, URL and parent unless the user asked to change them. Never delete old attachments or pages without explicit permission.
- Read back the page and verify tables, images, links, code, macros, labels and version. Report the page URL and version.

## Before finishing

- The target page, space and action were explicitly authorized.
- No credential or sensitive data is present in the exported or published content.
- Tables, images, attachments, links, code blocks and macros were counted and checked before and after conversion.
- The page was read back after publishing; the version and URL are reported.
- Any construct that could not round-trip is documented with its original source and the user is told what remains.
- Network, authentication and permission errors are reported with the actual status, not hidden.
