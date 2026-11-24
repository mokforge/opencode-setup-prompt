# Publish Markdown to Confluence

## Preflight

Before any write:

1. Confirm the user explicitly authorized publishing to the target site, space and page.
2. Identify the target:
   - existing page: page ID and current version;
   - new page: space key, exact title and parent page ID (if any).
3. Read the existing page when updating. Compare title, space, parent, labels and body.
4. Search the space for the exact title before creating. If a page exists, update it instead of creating a duplicate.
5. Present a short dry-run: operation (create/update), page, title, space, parent, attachments, number of tables/images/macros and the body summary.
6. Confirm no secret, personal data, internal hostname or unverified claim is in the content.

Do not publish if the target is ambiguous or the user only asked to review Markdown.

## Markdown preparation

- The Markdown file is the source; do not hand-edit generated storage XML.
- Resolve title from frontmatter or the first H1. Do not guess a title from a filename.
- Keep one page per Markdown file. If the file contains several unrelated pages, ask how to split.
- Ensure images use Markdown or inline HTML with local paths; verify every referenced file exists.
- Ensure tables are valid and consistent. Convert complex/merged tables to the representation supported by the converter.
- Ensure code fences are balanced and have language hints.
- Ensure macros and callouts use the project's documented Markdown conventions, or are preserved as marked raw storage blocks.
- Do not include credentials or tokens in frontmatter.

## Convert to storage format

Use `conversion.md` to produce `body.storage`. At minimum verify:

- headings, paragraphs, emphasis and inline code;
- ordered/unordered/nested lists;
- GFM and HTML tables, including merged cells;
- code blocks with language parameters;
- internal and external links;
- images and attachment references;
- panels, expand, TOC, status and other macros;
- unknown macros preserved from raw blocks.

If the converter cannot represent a construct, stop and report it rather than publishing a lossy page.

## Attachments

1. Upload or replace attachments before the page body references them, or immediately after creating a new page and before final verification.
2. Use the original attachment filename from frontmatter when available; otherwise use a stable, collision-safe name.
3. Do not delete existing attachments that are no longer referenced unless the user explicitly asks. Report orphans instead.
4. Verify each attachment exists on the page after upload.
5. For diagrams, upload the rendered image and, when possible, keep the source (Mermaid/PlantUML/draw.io) as an attachment or a linked repository file.

## Create or update

- **Update:** `PUT` the page with the current version + 1. Include a version comment describing the change.
- **Create:** `POST` with `type: page`, exact title, space, optional ancestors and storage body.
- Preserve page ID, URL and parent unless the user requested a move.
- Do not change the title, space, parent or labels as a side effect. Include them only when explicitly requested.
- If the page has no content change (same title/body/attachments), report a no-op instead of creating a version.

## Version conflicts

A `409` means the page changed after it was read.

1. Re-read the page: body, version, title, parent and labels.
2. Rebase the intended change onto the latest body; do not overwrite unrelated edits.
3. Retry once with the new version number.
4. If the conflict persists or the change cannot be merged safely, stop and ask the user.
5. Never force an update, delete a version or bypass optimistic locking.

## Large pages

- Some MCP servers and clients limit request size. If the body is large or includes many images, use the REST API.
- If the platform rejects the body size (`413`), ask whether to split the page, move large content to attachments or reduce the payload. Do not silently truncate.
- Upload attachments separately from the page body.

## Errors

- `401`/`403`: stop and report authentication/permission; do not try another credential.
- `404`: wrong page/space or no access; do not create a replacement automatically.
- `409`: rebase as above.
- `413`: use REST/split with approval.
- `429`: bounded backoff, then report.
- Network timeout: the write may have succeeded. Re-read the page before retrying to avoid duplicates.

## Read back

After create/update:

- fetch the page again and verify page ID, title, space, parent, version, labels and body;
- verify table dimensions and merged cells;
- verify every image/attachment exists and renders;
- verify internal/external links and anchors;
- verify code blocks and macro rendering;
- check for escaped HTML/XML and literal markup;
- report the page URL and version.

If read-back fails or is unavailable, report the write as unverified; do not claim success.
