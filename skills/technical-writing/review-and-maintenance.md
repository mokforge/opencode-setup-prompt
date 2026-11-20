# Documentation review and maintenance

## Review checklist

### Accuracy and sources

- Every behavior, command, path, field, version and limit is verified against code, configuration, a contract or a named source.
- Proposed or unverified behavior is marked as such.
- Code examples run for the documented version, or are marked unverified with the reason.
- The page does not contradict another page; if it does, the canonical page is identified and the duplicate is fixed.
- Names, terminology and versions match the project.

### Reader and structure

- The reader, purpose and page type are clear from the title and first paragraph.
- The page uses one Diátaxis type, not a mixture.
- Prerequisites, steps, verification and next steps are present where the type requires them.
- Headings form a logical outline; a reader can scan the page and find the answer.
- The page is reachable from navigation or a canonical index; no orphan or duplicate page.
- Links use descriptive text and point to the canonical page.

### Examples and visuals

- Code blocks have a language identifier and are copyable.
- Commands state the working directory and prerequisites where needed.
- Examples do not contain real secrets, personal data or internal hostnames.
- Screenshots are current, legible, have alt text and are not used for selectable text.
- Diagrams have a source format, a clear level/purpose and consistent labels.

### Safety and external access

- No secret, token, password, private key, customer data or production log is present.
- Security guidance does not tell the reader to disable a control without a warning and an alternative.
- External links and claims are allowed by the project's external access policy and are verified.
- API examples do not expose private endpoints or admin-only fields.

### Build and links

- Markdown lint, docs build, link check and style check pass, or the unrun checks are reported.
- Internal links, anchors, images, includes and navigation entries resolve.
- Generated reference is regenerated, not hand-edited.
- Version, deprecation and migration notes are updated.
- The rendered page was checked when the tooling allows it.

## Review format

- Verdict: accept / accept with findings / return for rework.
- Blocking findings: file and line, what is wrong, why it matters to the reader, the fix.
- Accuracy findings: unsupported claim, missing source, wrong command or version.
- Structure and navigation findings: page type, missing prerequisite, broken flow, orphan page.
- Links and build results: command, version and result; what was not run.
- Scope findings: content not requested, duplicated pages, unrelated rewrites.
- What was checked and is correct.
- Open questions and unverified areas.

## Maintenance

- Keep a short ownership or review note when the project uses one.
- Mark pages that depend on an external product or a fast-changing version with a review date.
- Remove or redirect duplicate pages; never leave two canonical explanations.
- Track broken links, stale examples and missing pages as documentation debt with a linked issue or task.
- Update the index, navigation, glossary and cross-links in the same change as the page.
- When a feature is removed, mark the page deprecated, link the replacement or migration guide and keep the history.
- Do not mass-rewrite unrelated pages in a focused change.

## Evidence

Report what you checked, how and with which tool or source. A review that says only "docs look good" is incomplete. If a build, link check or rendered preview was unavailable, say so and state the residual risk.
