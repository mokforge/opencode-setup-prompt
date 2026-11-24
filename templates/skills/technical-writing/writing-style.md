# Writing style

## Voice and tone

- Address the reader as "you"; use the imperative for steps: "Run the command", "Open the file".
- Use present tense for current behavior: "The service returns", "The command creates".
- Use active voice and name the actor when it matters.
- Be direct and neutral. Avoid marketing language, hype, jokes that date quickly and apologies.
- Explain the why before a non-obvious step, then give the how.
- Use short paragraphs and scannable lists. One idea per paragraph.
- Prefer concrete nouns and verbs over nominalizations: "validate the token", not "perform token validation".

## Structure

- Start with the outcome: what the reader gets after the page.
- Put prerequisites before the steps that need them.
- Use descriptive headings that make the outline understandable without the prose.
- Use numbered lists for sequential steps and bullets for unordered options.
- Use tables for reference data, defaults and comparisons, not for long explanations.
- Put warnings before the dangerous action; use the project's admonition syntax.
- Put the most important information first; do not bury the answer after background.

## Code and commands

- Every code block has a language identifier for highlighting and linting.
- Use the smallest runnable example. Show the expected result.
- Do not use placeholders that look like real secrets; use obvious values such as `<your-token>`.
- State the working directory when a command depends on it.
- Show the version or prerequisite that makes the example valid.
- Test examples against the documented version. If not possible, mark them unverified.
- Do not mix several shell languages or operating systems without labels.
- Avoid screenshots of text when selectable text would work.

## Terminology

- Use the project's domain terms consistently; do not invent synonyms for established concepts.
- Define a term on first use or link the glossary.
- Keep product names, command names, flags and API fields in code formatting.
- Use "repository", "project", "workspace", "service" and "container" with the project's meaning, not interchangeably.
- Expand an acronym on first use, then use the acronym.
- Use inclusive, neutral language.

## Accessibility and readability

- Write descriptive link text; avoid "click here".
- Add alt text to informative images; mark decorative images as decorative when the tool supports it.
- Do not rely on color alone to convey meaning.
- Keep heading levels sequential; use a single top-level title per page.
- Use tables with headers; keep cell content short.
- Write short sentences; expand abbreviations; avoid unexplained jargon.
- Make code and commands copyable; do not break them with line numbers or hidden characters.

## Localization

- Use the project's selected documentation language consistently.
- Keep code, commands, paths, identifiers and product names unchanged.
- Avoid idioms, cultural references and wordplay that do not translate.
- Leave room for longer translations in tables, buttons and navigation labels.
- Use a consistent date, number and unit format; state the time zone when it matters.
- Do not translate error messages or log output that the reader will see verbatim; quote them and explain.

## Errors and troubleshooting

- State the symptom first, then the cause and the fix.
- Quote the exact error text in code formatting.
- Give the command or check that confirms the diagnosis.
- Separate "try this first" from rare edge cases.
- Link to a deeper explanation instead of expanding every cause inline.
- Do not tell the reader to disable security controls as a first fix.

## What to cut

- Restating the heading in the first sentence.
- "Simply", "just", "obviously" and "of course".
- Long introductions before the answer.
- Duplicated explanations across pages.
- Unverified claims about performance, security or compatibility.
- Screenshots of commands when text works.
- Version numbers, dates and links that will silently go stale.
