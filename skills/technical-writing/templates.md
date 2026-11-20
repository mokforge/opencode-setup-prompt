# Documentation templates

Use these outlines as a starting point, not as content to fill mechanically. Remove sections that do not apply and add the project's required metadata.

## README

```markdown
# Project name

> One sentence: what it is and why it matters.

## Why this exists

The problem it solves, in two or three sentences.

## Quick start

Prerequisites and the shortest path to a working result.

## Installation

Full installation, supported versions and requirements.

## Usage

The most common task, a runnable example and the expected result.

## Configuration

Options, types, defaults, constraints and examples.

## Documentation

Where the full guides, reference and architecture live.

## Contributing

How to propose changes, run checks and submit a change.

## License
```

## Tutorial

```markdown
# Tutorial: Build <result> in <time>

What you will build, what you will learn and who it is for.

## Prerequisites

- tool and version;
- access or account;
- prior knowledge.

## Step 1 — <action>

What this step does and why. Command or code. Expected output.

## Step N — <action>

...

## What you built

The result, what was learned and how to verify it.

## Next steps

Links to the next tutorial, how-to, reference and explanation.
```

## How-to guide

```markdown
# How to <task>

When to use this guide, the result and the assumptions.

## Prerequisites

## Steps

1. ...
2. ...

## Verify

Command or check and expected result.

## Troubleshooting

Symptom, cause and fix for the common failures.

## Related

Reference and explanation links.
```

## Reference page

```markdown
# <API / CLI / configuration> reference

Version, scope and source of truth.

## Authentication and access

## Endpoint / command / option

Purpose, parameters, types, defaults, constraints, side effects, errors and example.

## Errors

Code, meaning, retry behavior and handling.

## Versioning and deprecation
```

## Explanation

```markdown
# How <concept> works

The question this page answers and the intended reader.

## Context

## Concepts and boundaries

## How it works

## Trade-offs and alternatives

Links to ADRs and reference.

## Related
```

## Requirements

```markdown
# <Topic> requirements

## Problem and goal

## Scope

In scope / out of scope.

## Actors and constraints

## Functional requirements

FR-1 ...

## Non-functional requirements

## Acceptance criteria

AC-1 ... (Given / When / Then)

## Assumptions

## Open questions

## Related architecture and diagrams
```

## ADR

```markdown
# NNNN. <Decision title>

- Status: proposed / accepted / deprecated / superseded by NNNN
- Date:
- Owners:

## Context

## Decision

## Alternatives

## Consequences

Positive, negative and follow-up work.

## References
```

## Architecture page

```markdown
# <System or container> architecture

## Purpose and scope

## Context and actors

## Containers / components

## Data flow and interfaces

## Storage and consistency

## Failure behavior and limits

## Security and trust boundaries

## Constraints and deviations

## Related ADRs and diagrams
```
