# Validate Confluence read, export and publish

## Read/export validation

Check the actual page and the generated Markdown:

- Page identity: ID, title, space, URL and version match the source.
- Frontmatter contains page ID, version, space, parent and attachment metadata.
- Every heading exists and the hierarchy is intact.
- Paragraph text is present and not duplicated or escaped.
- Lists preserve order, nesting and checked state.
- Tables preserve row/cell counts, headers, alignment, merged cells and nested content.
- Code blocks preserve language, indentation and blank lines.
- Links: external URLs, internal page links and anchors resolve or are reported.
- Images: every referenced local file exists, has non-zero size and the correct media type; width/height/alt are preserved where possible.
- Attachments not referenced by images are listed and downloaded or reported.
- Known macros are converted according to the documented convention.
- Unknown macros are preserved in a marked XML block with a warning.
- No content was silently dropped; the report lists every intentional representation change.

Compare the rendered Confluence page with the Markdown preview when both are available. A Markdown view can look correct while the storage format is broken.

## Publish validation

After create/update, read the page back through the API:

- Page ID, title, space, parent and URL are correct.
- Version is the expected new version; no duplicate page was created.
- Body is the storage body that was sent, not a truncated or escaped copy.
- Tables have the same number of rows and cells; merged cells render.
- Every attachment exists on the page, has the expected filename and size, and is referenced by the body.
- Images render; no broken image icon or filename-only text.
- Code blocks render as code, not escaped HTML.
- Panels, expand, TOC, status, Jira and other macros render correctly.
- Links and anchors resolve; no literal `<ac:` or `ri:` markup is visible.
- Labels, title, parent and space were changed only if requested.
- No secret, token, personal data or internal hostname is visible in the page or attachments.

If the rendered preview is available, inspect the page visually. If not, report that visual verification is pending and rely on the read-back body plus a structural check.

## Round-trip comparison

For an import/export/publish cycle:

1. Inventory the source: pages, tables, images, attachments, links, code blocks and macros.
2. Inventory the re-export or read-back.
3. Compare counts and identities, not only text.
4. Report missing, added, duplicated or changed items.
5. Treat a mismatch as a defect unless the representation change was documented and accepted.

A byte-for-byte match is not required for storage/HTML, but no content may be lost.

## Failure handling

- If a check cannot run because credentials, MCP or the renderer are unavailable, say exactly which check was not run and do not claim success.
- If the page is inaccessible, report the status and page ID; do not create a replacement.
- If a version conflict occurs, re-read and rebase; do not overwrite.
- If an attachment fails, report the filename and error; do not publish a page with a broken image reference.
- If a table or macro cannot be represented, stop before publishing or preserve the source and ask.

## Report

Include:

- action (read/export/create/update), site, space, page ID/title and URL;
- source and output paths;
- page version before and after;
- counts: pages, tables, images, attachments, links, code blocks, macros;
- checks run, command/tool versions and results;
- visual preview status;
- unsupported or lost constructs and the decision taken;
- external data sent and user permission reference;
- remaining risks or unverified areas.
