# Information architecture

## Reader and purpose

Define before writing:

- who the reader is: newcomer, experienced developer, operator, architect, decision maker;
- what they already know and what must be explained;
- what they should be able to do or understand after the page;
- where the page sits in the journey: discovery, first success, daily task, reference, troubleshooting, decision;
- what the page is not for; link to the right page instead.

A page without a named reader and purpose becomes a mixture of tutorial, reference and notes.

## Diátaxis page types

Use one type per page.

### Tutorial

Learning-oriented. A guided first success with one path:

- state what the reader will build and what they will learn;
- list prerequisites and versions;
- give ordered, tested steps with expected output;
- explain the why briefly before the how;
- end with what was built, what was learned and next steps;
- do not offer alternative paths or deep reference in the middle.

### How-to guide

Task-oriented. Solves a specific problem for a reader who knows the basics:

- start with the goal and when to use the task;
- give the shortest reliable procedure;
- state prerequisites and assumptions;
- include verification and common failure modes;
- link to reference and explanation instead of teaching the whole topic.

### Reference

Information-oriented. Complete, accurate and scannable:

- organize by the user's model: endpoints, commands, options, fields, events, errors;
- state types, defaults, constraints, side effects and errors;
- include short, correct examples, not long tutorials;
- state version and deprecation;
- keep generated reference generated.

### Explanation

Understanding-oriented. Explains why and how the system works:

- concepts, boundaries, trade-offs, alternatives and constraints;
- architecture and data flow at the right level;
- links to decisions and reference;
- no step-by-step instructions unless they illustrate a concept.

## Common page set

- `README.md` — entry point: what it is, why it exists, quick start, where the full docs are, how to contribute, license.
- Quick start — shortest path to a working result.
- Tutorial and how-to sections — goal-driven guides.
- Reference — API, CLI, configuration, schema, errors.
- Explanation — concepts and architecture.
- Requirements — scope, actors, functional and non-functional requirements, acceptance criteria, open questions.
- ADR — one decision per file, status, context, alternatives, consequences.
- Architecture — system context, containers, components, data flows, interfaces, constraints.
- Operations — deployment, observability, backup, recovery, troubleshooting.
- Contributing and support — how to propose changes, report bugs and get help.
- Changelog, release notes and migration guides.

## Navigation and structure

- The navigation mirrors the reader's tasks, not the internal team structure.
- Every page is reachable from the index or navigation. No orphan pages.
- Use short, stable titles and descriptive file names. Avoid "misc", "notes" and "other".
- Use lowercase kebab-case file names. Follow existing project conventions; if none exist, use `req--<short-kebab-description>.md` for requirements, `adr--<short-kebab-description>.md` for ADRs, `seq-<short-kebab-description>.puml` for sequence diagrams, and `c4-l<n>-<short-kebab-description>.puml` for C4 diagrams.
- Keep headings in a logical hierarchy; do not skip levels.
- Put the most important information first. Progressive disclosure for long reference pages.
- Cross-link related pages in both directions when the reader may arrive from either side.
- Use a glossary or terminology page for domain terms; link terms on first use when helpful.
- Keep URLs and anchors stable. Add redirects when reorganizing.

## README

The README passes the five-second test:

1. What is this?
2. Why should I care?
3. How do I start?

Then: prerequisites, install, minimal example, configuration, where the full documentation lives, contributing, license. Keep badges and screenshots purposeful.

## Requirements pages

- State the problem, goal, scope in and out, actors and constraints.
- Use numbered requirements and acceptance criteria; each criterion is verifiable.
- When the project has no established file naming, use `req--<short-kebab-description>.md`; the `FR-1` and `AC-1` identifiers stay in the document body.
- Mark assumptions and open questions. Do not hide an unresolved decision in prose.
- Link to the related architecture, ADR and diagrams.
- Keep requirements separate from the proposed solution.

## ADRs

Use one file per significant decision. Follow the project convention; when none exists, use `adr--<short-kebab-description>.md` with no numeric prefix:

- title and status: proposed, accepted, deprecated or superseded;
- context and forces;
- decision;
- alternatives considered;
- consequences, including trade-offs and follow-up work;
- links to related requirements, diagrams and superseded decisions.

Do not rewrite an accepted ADR to hide history. Add a new ADR and mark the old one superseded.

## Architecture pages

- Start with system context and scope.
- Show containers/components at a consistent level; do not mix C4 L2 and L3.
- Explain data flows, interfaces, protocols, storage, failure behavior and trust boundaries.
- Link diagrams to the text and text to diagrams; each has a purpose.
- State constraints and known deviations from the intended architecture.
- Keep implementation details in component pages, not in the system context.

## Cross-links and discovery

- Link prerequisites before the step that needs them.
- Link reference from how-to pages and explanation from both.
- Use descriptive link text, not "here" or "read more".
- Add a "Next steps" or "Related" section for guided pages.
- Check anchors after renaming headings.
