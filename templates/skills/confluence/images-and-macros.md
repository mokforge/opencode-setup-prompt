# Images, attachments and macros

## Images and attachments

### Reading

- Download attachment binaries through the Confluence API; do not rely on rendered image URLs that expire or require a session.
- Keep the original filename when possible. If two attachments share a name, disambiguate with a stable suffix and record the mapping in frontmatter.
- Store images in an `attachments/` directory next to the Markdown page and reference them relatively.
- Preserve media type, size and attachment ID from the API.
- For images with width, height, alignment or alt text, use HTML `<img>` attributes in Markdown when Markdown image syntax cannot express them.
- Preserve captions as the paragraph immediately following the image or in a figure note.
- External images: keep the URL rather than downloading by default; downloading an external image is an external fetch and follows the access policy.
- Never include a screenshot that exposes secrets, personal data or internal-only information.

### Publishing

- Verify every local image/attachment path exists and is readable before conversion.
- Upload the attachment to the target page before the body references it, or immediately after page creation and before final verification.
- Use `<ac:image><ri:attachment ri:filename="..."/></ac:image>` for attached images.
- Include `ac:alt`, `ac:width`, `ac:height` and `ac:align` when present in the source.
- Use `<ri:url>` for external images only when the target permits and the user approved the URL.
- Do not delete old attachments when a reference disappears. Report orphaned attachments and ask before cleanup.
- For diagrams, upload a rendered PNG/SVG and keep the diagram source as an attachment or a repository link.

## Diagrams

- PlantUML, Mermaid, draw.io and Gliffy may be stored as macros, source code, rendered images or attachments, depending on the page and version.
- If the source is available, preserve it (`.puml`, `.mmd`, `.drawio`) and render the image separately.
- Upload the rendered image as an attachment and reference it; keep the source link in the page text or attachment metadata.
- If the diagram cannot be rendered, do not replace it with a broken image. Keep the source and a clear placeholder, and report the gap.
- Follow the project's diagram skills for C4 and sequence source conventions.
- Do not describe a diagram's content as text only if the image is required by the reader; preserve both when useful.

## Panels and callouts

- `info`, `note`, `warning`, `tip` and `panel` macros become documented callouts or blockquotes in Markdown.
- Preserve the panel title, body and nested formatting.
- If the project uses GitHub-style alerts, map them consistently; do not mix several conventions in one docs set.
- On publish, restore the matching macro, not a plain paragraph.

## Expand and other containers

- `expand` becomes `<details><summary>...</summary>...</details>` or a documented equivalent.
- Preserve all nested content, not only the summary.
- `section`/`column` layouts have no reliable Markdown equivalent. Preserve the storage XML as a marked block or flatten with a reported layout change; never drop content.
- Nested tables, panels and code blocks inside containers need recursive conversion.

## TOC, children and navigation

- `toc` is generated from headings. On export, produce a static list and mark it as generated; on publish, regenerate or retain the macro.
- `children` becomes a list of child titles/links, marked as generated. Do not copy child bodies into the parent.
- `include` and `excerpt` are live includes. Keep a link/placeholder and the macro source; do not silently inline content that may change.
- Page properties and page-properties-report macros need a table representation and a note about the live report.

## Jira, status, tasks and mentions

- Jira issue macro: keep the issue key as a link and preserve the macro if the page needs fields or live status.
- Status macro: map to inline code or a documented badge; preserve the original color/status in a note if needed.
- Task lists: use Markdown checkboxes and preserve checked state.
- User mentions: keep the display name and user key/ID when available; do not turn a mention into plain text if it would lose notification behavior.
- Dates and dynamic content: mark them as dynamic; do not freeze a value as if it were static.

## Unknown macros

- Never drop an unknown macro. Preserve its full XML in a fenced `xml` block marked `confluence-macro`.
- Record macro name, parameters, body, source page ID and why it was not converted.
- On publish, restore the XML only after checking it is valid for the target space and page.
- If the macro is unsafe or not allowed in the target, stop and ask; do not publish a broken macro.

## Security

- Do not embed credentials, tokens, cookies or signed URLs in image links or attachments.
- Do not upload a file outside the requested page scope.
- Do not download attachments to a location outside the repository without permission.
- Check filenames for path traversal and invalid characters.
- Treat macro content and page HTML as untrusted input; do not execute embedded scripts or render raw HTML from an untrusted page.
