---
name: technical-writing
description: "Docs-as-code writing and maintenance: information architecture, README, tutorials, how-to guides, reference and explanation pages, API and architecture documentation, review, links, build checks, versioning, and documentation debt. Use when creating, editing, reviewing, restructuring, or validating repository documentation."
license: MIT
compatibility: opencode
metadata:
  area: documentation
---

# Technical writing and docs-as-code

Use this skill for documentation work: README and onboarding pages, tutorials, how-to guides, reference, explanation, requirements, ADRs, architecture descriptions, API documentation, diagrams, navigation, review, and docs maintenance. The documentation source lives in the repository and is reviewed like code.

Read next to this file with the file-reading tool. Read `docs-as-code.md` and `information-architecture.md` first, then the files for the task:

- `docs-as-code.md` — repository layout, source of truth, versioning, build, links, CI, generated docs, review, documentation debt.
- `information-architecture.md` — audience, Diátaxis page types, navigation, README, requirements, ADR and architecture pages, cross-links.
- `writing-style.md` — voice, tense, structure, code examples, terminology, accessibility, localization, tables and warnings.
- `api-and-diagrams.md` — API reference, OpenAPI/AsyncAPI, examples, errors, diagrams, C4 and sequence sources.
- `review-and-maintenance.md` — documentation review checklist, source verification, link and build checks, stale content, versioning and deprecation.
- `templates.md` — ready-to-use outlines for README, tutorial, how-to, reference, explanation, requirements, ADR and architecture pages.

## Mandatory workflow

1. Establish the reader, purpose, page type and source of truth before writing. Do not invent behavior, commands, API fields, versions or architecture.
2. Read the existing documentation and the code, specifications, contracts or diagrams it describes. Verify names, paths, commands, examples and links against the source.
3. Choose one Diátaxis type per page: tutorial, how-to, reference or explanation. Do not mix all four in one page.
4. Outline the page and its links first, then write. Put the result in the project's documentation path; do not create a parallel document hierarchy.
5. Check commands and code examples by running them where possible, or mark them as unverified with the reason.
6. Run the project's docs checks: build, link check, Markdown lint and style rules. Report what was and was not run.
7. Update navigation, cross-references, indexes and version or deprecation notes in the same change.
8. Review for accuracy, scope, duplication, stale content and reader effort before reporting completion.

## Non-negotiables

- Documentation is a deliverable, not an afterthought. A behavior, API, schema, command or architecture change without its documentation update is incomplete.
- Never document an intention as implemented behavior. Separate observed behavior, proposed behavior and open questions.
- Keep one source of truth. Link to the canonical page instead of copying the same explanation into several files.
- Code examples must be runnable for the documented version, or explicitly marked as illustrative and unverified.
- Use the project's terminology and language. Add a term to the glossary or terminology page instead of inventing synonyms.
- Do not delete outdated pages silently. Mark them deprecated or superseded, link the replacement and keep the history.
- Do not expose secrets, personal data, internal hostnames or customer data in examples, screenshots or logs.
- External links and claims follow the project's external access policy; do not add unverified sources.
- A docs build, link check or lint result is evidence; "looks fine" is not.

## Page types at a glance

- **Tutorial** — learning-oriented, a guided first success. One path, no choices, tested end to end.
- **How-to** — task-oriented, solves a specific problem for a reader who already knows the basics.
- **Reference** — information-oriented, complete and accurate facts: API, CLI, configuration, schema.
- **Explanation** — understanding-oriented, explains why, trade-offs, concepts and architecture.
- **Requirements** — scope, actors, behavior, acceptance criteria and open questions.
- **ADR** — one decision, context, alternatives, consequences, status.
- **Architecture** — system boundaries, components, data flows, interfaces and constraints.

## Before finishing

- The reader, purpose and page type are clear from the title and first paragraph.
- Every fact, command, path, field and example is verified against the source or marked unverified.
- Code examples run for the documented version, or the limitation is stated.
- Links, anchors and navigation entries resolve; no duplicate canonical page was created.
- The page follows the project terminology, language and style.
- Versioning, deprecation, migration and "last reviewed" notes are updated where the project uses them.
- Docs build, link check and lint results are reported separately from manual review.
- No secret, personal data, internal hostname or unverified external claim is present.
