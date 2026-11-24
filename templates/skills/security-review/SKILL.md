---
name: security-review
description: "Security review gate for code, configuration, dependency, migration, and infrastructure changes: SQL injection, access control, secrets, XSS/SSRF, unsafe deserialization, file handling, crypto, and supply-chain risks. Mandatory for the reviewer on every review and for the tech-lead before acceptance."
license: MIT
compatibility: opencode
metadata:
  area: security
---

# Security review

Use this skill for every code, configuration, dependency, migration, or infrastructure change before it is accepted. It is mandatory for the reviewer on every review and for the tech-lead at the acceptance gate. This is a code-visible review gate, not a penetration test and not a guarantee that the system is secure.

Read next to this file with the file-reading tool. Read `review-process.md` and `checklist.md` first, then the topic files for the surfaces in the change:

- `review-process.md` — scope, data-flow tracing, verification, severity, finding format and report.
- `checklist.md` — the must-not-miss checklist, default severity and quick searches.
- `injection.md` — SQL/NoSQL/ORM, command, template, LDAP/XPath and header/log injection, path traversal, XXE and unsafe deserialization.
- `access-control.md` — authentication, authorization, IDOR/BOLA/BFLA, mass assignment, sessions, JWT/OAuth, CSRF and tenant isolation.
- `web-and-api.md` — XSS, SSRF, open redirect, CORS, file upload/download, GraphQL, WebSocket, rate limiting and data exposure.
- `secrets-and-crypto.md` — hardcoded and leaked secrets, rotation, cryptography, password storage, PII in logs and errors, TLS.
- `dependencies-and-platform.md` — vulnerable dependencies, CI/CD, Docker, IaC/cloud, debug settings and LLM or agent features.

## Mandatory workflow

1. Load this skill with the native `skill` tool before reviewing or accepting a change. A review without a security section is incomplete.
2. Determine the risk surface from the diff: entrypoints, trust boundaries, authentication and authorization, data access, file/network/command sinks, secrets, dependencies and configuration.
3. Trace untrusted input from source to sink. Check authorization for every object and every function, not only in the UI.
4. Apply `checklist.md` and the topic files for the surfaces in the change. Scanners help, but they do not replace reading the code and its callers.
5. Verify each finding or mark it as unverified. Assign severity from exploitability and impact, and report evidence.
6. Critical and High findings block acceptance. Never accept "we will fix it later". A Medium finding blocks a change to authentication, payments, PII or tenant boundaries.
7. After a fix, re-review the changed code and require a regression test that would fail before the fix.

## Non-negotiables

- All user-controlled data is hostile: request parameters, body, headers and cookies; file names and content; queue and webhook payloads; third-party responses; LLM output used in a code path.
- Never treat client-side validation, hidden fields, UI guards or "internal" endpoints as security controls. Authentication and authorization are enforced server-side and deny by default.
- Never approve SQL injection, command injection, unsafe deserialization, path traversal, missing object-level authorization or a live secret in code. These are blocking regardless of the size of the change.
- Prefer parameterized queries, allowlists, safe APIs and proven libraries. Do not hand-roll cryptography, escaping or authentication protocols.
- Do not run destructive payloads, denial-of-service tests or exploitation against production. Use local, non-destructive verification, or report what could not be verified.
- Distinguish confirmed, likely and needs-verification findings. Silence about an unexamined area is not a clean result.

## For the reviewer

- Add a `Security` section to every review report: scope checked, findings by severity, commands and scans run, unverified areas and residual risk.
- If the change has no executable or security surface (for example, comments or documentation only), say so explicitly instead of omitting the section.
- Block on an unresolved Critical or High finding and return the fix to the developer through tech-lead.

## For the tech-lead

- Use `checklist.md` as the acceptance gate. Do not accept "the reviewer found nothing" without what was checked and the evidence.
- Spot-check the highest-risk path yourself: authentication, SQL or ORM queries, file and network sinks, secret handling, new dependencies.
- Do not close a task with an open Critical or High finding. Record accepted Medium risks and who accepted them; never accept a risk silently.
- Include the security gate result in the final report.

## Before finishing

- The review report has a security section, even when there are no findings.
- Every checklist category is checked or explicitly marked not applicable to the change.
- Every finding has file and line, input source, sink, non-destructive exploit path, impact, fix and confidence.
- No unresolved Critical or High finding remains in an accepted change.
- Secret values are redacted, and the report asks for rotation at the provider when a real secret was exposed.
- Each fixed vulnerability has a regression test or a stated reason why a test is not possible.
- Commands and scans that were run and areas that were not verified are listed.
