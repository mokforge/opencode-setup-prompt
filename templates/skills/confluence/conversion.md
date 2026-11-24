# Markdown and Confluence storage conversion

## Direction and source of truth

- **Read:** Confluence storage → Markdown. Preserve metadata, attachments, tables, macros and links.
- **Publish:** Markdown → Confluence storage. Generate valid storage XML and upload attachments.
- Keep Markdown as the repository source when the project uses docs-as-code. Do not edit storage XML by hand unless the task is a targeted migration.
- Use a real parser/converter for nested content. Regex-only conversion is unsafe for nested lists, tables, code blocks and macros.

## Common mapping

| Confluence storage              | Markdown representation                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| `<h1>`–`<h6>`                   | `#`–`######`                                                          |
| `<p>`                           | Paragraph separated by a blank line                                   |
| `<strong>`, `<em>`              | `**bold**`, `*italic*`                                                |
| `<code>`                        | Inline code                                                           |
| `<ul>`, `<ol>`, `<li>`          | Nested Markdown lists                                                 |
| `<pre>` / code macro            | Fenced code block with language                                       |
| `<table>`                       | GFM table if simple; HTML table if merged/nested                      |
| `<a href="...">`                | `[text](url)`                                                         |
| `<ac:link><ri:page ...>`        | Link to the page title/URL; keep page ID in frontmatter or a note     |
| `<ac:image><ri:attachment ...>` | `![alt](relative/path)` or an HTML image with attributes              |
| `<ac:image><ri:url ...>`        | Markdown/HTML image with the external URL and an external-source note |
| Info/note/warning/tip macro     | Blockquote or a documented callout such as `> [!NOTE]`                |
| Expand macro                    | `<details><summary>...</summary>...</details>`                        |
| TOC macro                       | Generated list of headings or a marked placeholder                    |
| Status macro                    | Inline code or a documented badge representation                      |
| Task list                       | Markdown task list with explicit checked/unchecked state              |
| Jira issue macro                | Link with the issue key; keep the macro source if fields are needed   |
| Children macro                  | List of child titles/links; mark as generated                         |
| Include/excerpt macro           | Link or a marked placeholder; do not silently copy the included body  |
| Unknown macro                   | Fenced `xml` block marked `confluence-macro` with its attributes/body |

## Tables

- Simple rectangular tables with a header row → GFM tables.
- Merged cells (`colspan`/`rowspan`), nested tables, cell macros or complex alignment → inline HTML table in Markdown. Do not flatten merged cells or drop cells.
- Preserve header rows, alignment and cell contents. If Markdown cannot express a cell attribute, use HTML attributes or a note.
- On publish, convert GFM tables to `<table><tbody>...`; convert HTML tables to the same storage structure, preserving `colspan`, `rowspan`, `headers`, `scope` and cell markup.
- Validate the number of rows and cells on read-back.

## Code and preformatted text

- Fenced code becomes the Confluence code macro with a `language` parameter.
- Preserve indentation, blank lines and special characters; use CDATA for the macro body when required.
- Escape `</ac:plain-text-body>` sequences if they occur; do not break the XML.
- On export, read the code macro language and produce a fenced block; if the language is unknown, use `text`.
- Do not convert code blocks into paragraphs or inline code.

## Links

- External links become `<a href="...">`.
- Internal page links should keep the page title and, where available, page ID. If the converter cannot resolve a title, keep a normal Markdown link and report the unresolved target.
- Anchors must match the generated heading IDs; do not invent anchors.
- Attachments can be linked directly with `ri:attachment`.
- Do not turn links into plain text.

## Callouts and panels

Use a documented convention consistently. One acceptable mapping:

```markdown
> [!NOTE]
> Content of the note.
```

On export, convert Confluence `info`, `note`, `warning`, `tip` and `panel` macros to the matching callout and keep the panel title. On publish, map the callout back to the macro. If the project uses a different convention, follow it and document it in frontmatter or the skill's examples.

## Expand and details

```markdown
<details>
<summary>More details</summary>

Content of the expand macro.
</details>
```

On publish, convert to the `expand` macro with the `title` parameter, or keep an HTML `<details>` if the project's Confluence version supports it. Do not drop the hidden content.

## Table of contents and generated navigation

- On export, TOC is a generated navigation aid; a static list of headings is acceptable, but mark it as generated.
- On publish, either regenerate TOC from headings or keep the Confluence `toc` macro. Do not publish a stale manual TOC as if it were dynamic.
- Children macros are generated lists; do not duplicate child content.

## Images and attachments

- Inline Markdown images reference local files relative to the Markdown page.
- On publish, upload the file and produce `<ac:image><ri:attachment ri:filename="..."/></ac:image>`; add `ac:alt`, `ac:width`, `ac:height` and `ac:align` when the source carries them.
- External images use `<ri:url>` only if external images are allowed and verified. Otherwise download with permission and attach.
- Preserve captions and surrounding text.

## Unknown and unsupported macros

- Do not delete a macro because the converter does not know it.
- Preserve the exact macro XML in a fenced block:

````text
```xml confluence-macro
<ac:structured-macro ac:name="...">...</ac:structured-macro>
```
````

- Add a short note beside it: macro name, original page ID, what was not converted and what must be checked before publishing.
- On publish, replace the marked block with the original XML only after validating it against the target page/space. Do not leave the fenced block visible in Confluence.
- If the macro has dynamic or user-specific content (Jira filters, user mentions, live includes), keep it as a macro and warn that its rendered content may differ.

## Round-trip rules

- Preserve the Confluence page ID, version, space, parent and labels in frontmatter.
- Preserve attachment filenames and media types.
- Keep original IDs in links where possible.
- Do not rewrite unrelated Markdown.
- A round-trip is not required to be byte-identical, but no content may be lost. Report every intentional representation change.
- Run the checks in `validation.md` after both directions.
