# Read and export Confluence pages

## Inputs

Collect before reading:

- base URL/site;
- space key;
- page ID, or exact title and space;
- whether to include child pages, descendants, attachments and labels;
- output directory in the repository;
- whether a read-only token or MCP server is available.

If the user only provides a URL, parse the numeric page ID and confirm the site/space from the URL. Do not guess a page from a similar title.

## Read the page

Fetch metadata and `body.storage`, not only rendered HTML:

- id, title, type, status;
- space key and name;
- version number and last updated;
- ancestors/breadcrumb and parent page;
- children page IDs and titles;
- labels;
- attachments: id, filename, media type, size, version;
- body storage and, where useful, rendered view for a visual comparison.

Read the page in storage format so tables, macros and image references survive. Use the rendered view only as a secondary check.

## Export layout

Use this default layout unless the project has a docs layout:

```text
<output>/<Page_Title>/
├── index.md
├── attachments/
│   ├── diagram.png
│   └── data.csv
└── children/
    └── <Child_Title>.md
```

For a flat export, use `<Page_Title>.md` and `<Page_Title>_attachments/`. Keep file and attachment names stable and safe; replace path separators and characters that are invalid on the target filesystem.

## Frontmatter

Preserve enough metadata for a safe round-trip:

```yaml
---
title: "Page title"
confluence:
  base_url: "https://site.atlassian.net/wiki"
  page_id: "123456789"
  space_key: "DOCS"
  version: 42
  url: "https://site.atlassian.net/wiki/spaces/DOCS/pages/123456789/Page+Title"
  parent_id: "123456"
  labels: [docs, api]
attachments:
  - filename: "diagram.png"
    media_type: "image/png"
    local_path: "attachments/diagram.png"
---
```

Do not put credentials, cookies or tokens in frontmatter.

## Attachments and images

- Download each attachment to the attachments directory using a collision-safe name.
- Rewrite storage-format image references (`<ri:attachment ri:filename="...">`) to relative Markdown links in `index.md`.
- Keep the original attachment filename in frontmatter so publishing can restore it.
- Preserve alt text, width, height and alignment where the Markdown representation can carry them. Use inline HTML image tags when attributes are needed.
- For external images, keep the URL and note that it is external; do not download it without permission.
- Do not silently skip an attachment that cannot be downloaded; list it as missing with the reason.

## Page tree

- Download children only when requested or required by the task.
- Keep the parent/child structure and avoid cycles.
- If a child is inaccessible, record the page ID/title and the error; do not create an empty placeholder that looks complete.
- Preserve page order only if the source exposes an order; do not invent a navigation order.
- Report the number of pages, attachments and skipped items.

## Conversion

Convert storage to Markdown with `conversion.md`. Preserve:

- headings and paragraph structure;
- ordered/unordered/nested lists;
- tables, including merged cells and nested tables;
- code blocks and language hints;
- links, anchors and page references;
- images and attachment metadata;
- callouts, expand, TOC and other macros;
- unknown macros as marked source blocks.

## Verification

Before reporting an export:

- the Markdown file exists and has frontmatter with the page ID/version;
- every downloaded attachment exists and is referenced by a relative path;
- table row/cell counts and merged cells are preserved;
- internal links and anchors resolve or are reported;
- code fences are balanced and language hints are retained;
- unknown macros are preserved and marked;
- the rendered page was compared with the exported Markdown where tooling allows;
- skipped/ inaccessible pages and attachments are listed.

## Report

List page ID, title, URL, version, output path, number of children, attachments, tables, images, macros and any unverified or lost content.
