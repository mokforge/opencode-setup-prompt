# Docs as code

## Repository model

- Documentation lives in the repository, uses a text format (usually Markdown), and changes through the same branch, review and merge flow as code.
- Keep the project's chosen documentation root. The default for this setup is `.opencode/docs/`; a project may map it to `docs/`, `doc/`, a docs site folder or another path. Do not create a second root.
- Keep documentation close to the thing it describes when the project does that, but avoid duplicating the same page in several places. Link to the canonical page.
- One page has one owner, one purpose and one canonical location. Navigation, index pages and cross-links point to it.
- Treat the documentation tree as part of the public interface of the repository: file names, headings and anchors are links that other pages and external sites may use.

## Source of truth

- Code, configuration, OpenAPI/AsyncAPI contracts, schemas, tests and the running product are the source for behavior. Documentation is the source for intent, terminology and reader guidance.
- When code and docs disagree, verify which one is current before editing. Do not "fix" docs to match a guess.
- Generated reference (API, CLI, configuration) comes from the contract or source annotations. Do not hand-maintain a copy that can drift.
- Mark proposals, future behavior and unverified assumptions explicitly. Do not present them as shipped.
- Record where a fact came from in the review report or a source note when the project uses one.

## Versioning and change management

- Documentation follows the version it describes. For versioned products, keep the version selector, release notes and migration guide aligned.
- A breaking change needs a migration note before release. Do not remove the old page; mark it deprecated or superseded and link the replacement.
- Update the changelog, release notes and "last reviewed" date when the project uses them.
- Keep stable anchors when reorganizing pages; add redirects or a link from the old location when the docs site supports them.
- Do not write a future date or a version that does not exist.

## Build, links and checks

- Use the project's existing docs tool: MkDocs, Sphinx, Docusaurus, VitePress, mdBook, Antora, a static site generator or plain Markdown. Do not add a new tool without a task and approval.
- Run the documented build command, link checker, Markdown linter and style checker when they exist. Report the command, version and result.
- Check internal links, anchors, images, include paths, code fences and navigation entries. A build can pass while links are broken if the checker is not configured.
- Check generated reference after schema or annotation changes; regenerate instead of editing generated files by hand.
- Keep large binary assets out of the repository unless the project already stores them. Optimize images and include alt text.
- Do not claim a docs build passed when only Markdown was read.

## Review

- Documentation review is a code review with the reader as the user: verify accuracy, sources, scope, structure, links, terminology and examples.
- Review the rendered page as well as the Markdown source when the tooling is available.
- Review the diff, not only the final page. A large rewrite can hide removed facts or changed links.
- Require an engineering or domain review for technical claims, security guidance, migrations and public API behavior.
- A docs change that alters behavior, API, schema or architecture must be reviewed with the same acceptance criteria as the related code change.

## Documentation debt

- Track stale pages, missing pages, broken links, duplicated explanations and unverified examples as documentation debt.
- Prefer small, continuous updates over a periodic rewrite. A stale page is a bug with a reader impact.
- When a page cannot be updated in the current task, mark the gap, open a follow-up and link the source of truth. Do not leave a false statement in place.
- Measure what matters: search success, time to first success, support questions, broken links, stale pages and review latency. Do not invent metrics.

## Repository hygiene

- Keep file names stable, lowercase and descriptive; use the project's numbering scheme for ADRs, requirements and RFCs.
- Avoid orphan pages: every page is reachable from navigation or a canonical index.
- Keep one `README` entry point; use it for what the project is, why it exists, how to start, where the full docs are and how to contribute.
- Put generated artifacts, caches and build output outside the docs source or ignore them in git.
- Do not commit secrets, customer data, production logs or internal-only URLs into documentation examples.
