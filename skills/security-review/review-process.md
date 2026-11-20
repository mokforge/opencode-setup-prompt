# Review process

## 1. Scope the change

- Read the task, acceptance criteria, architectural decision and the full diff (`git diff`, `git status`), not only the changed lines. Read the callers and configuration around each change.
- Identify entrypoints and trust boundaries: HTTP and GraphQL handlers, CLI commands, queue consumers, scheduled jobs, webhooks, file imports, admin interfaces, internal service calls.
- Identify security-critical surfaces: authentication, authorization, data access, file and network access, command execution, serialization, secrets, cryptography, dependencies and deployment configuration.
- A documentation-only or comment-only change still gets a security sentence: state that no executable surface changed and why.

## 2. Trace data from source to sink

- Sources: request parameters, body, headers, cookies, path segments, uploaded files, queue and webhook payloads, third-party API responses, database fields written earlier, LLM output.
- Sinks: SQL and NoSQL queries, shell commands, template rendering, HTML output, file paths, HTTP clients, deserializers, logs, redirects, authorization decisions.
- Follow the value through validation, normalization, encoding and storage. A value validated on input can still become dangerous when read later (second-order injection).
- Check the trust boundary where control changes: client to server, service to service, tenant to platform, user to admin.

## 3. Check authentication and authorization

- Who can call the endpoint or function? Where is the check enforced? Is it enforced on every path, including alternate methods, bulk endpoints, exports and internal routes?
- Which object is accessed? Is ownership, tenant and permission checked against the authenticated identity rather than an ID from the request?
- Is the decision made from server-side data (session, signed token, database) rather than a client-editable field (role in body, `user_metadata`, header)?
- Does the change create a new privileged action, a new role, a new tenant boundary or a new public endpoint? Those deserve a deeper review even when the diff is small.

## 4. Verify, do not assume

- Prefer project tools: the configured linter, type checker, tests, SAST, dependency audit and secret scanner. Use read-only or local modes.
- Safe checks include `git grep`, reading code, running tests, local static analysis and a dependency audit. Do not send secrets or proprietary code to external services, and do not run exploits against production.
- A scanner result is a candidate. Verify reachability, input source and authorization. Do not report a raw scanner dump as a finding.
- If a check cannot be run, say which one and what risk remains unverified. Never write "security checked" when only a scanner was run.

## 5. Assign severity

Use exploitability and business impact, not only a CVSS score.

- **Critical:** remote code execution; authentication bypass; SQL injection with read or write access; unsafe deserialization; arbitrary file read or write on sensitive paths; SSRF to cloud metadata or internal control planes; missing tenant or object authorization over sensitive data at scale; a live privileged secret.
- **High:** stored XSS; CSRF on a sensitive action; privilege escalation; weak password storage; IDOR over non-public but sensitive data; a reachable vulnerable dependency; open admin functionality; secrets with limited but real scope.
- **Medium:** reflected or DOM XSS with meaningful impact; missing rate limiting on authentication; verbose errors; permissive CORS without credentials; a hardening gap that is exploitable only with unusual conditions.
- **Low:** defense-in-depth and hardening with no demonstrated path to impact.

If two severities are plausible, choose the higher one and state the evidence that would lower it. Do not downgrade because the change is small or the endpoint is "internal".

## 6. Write the finding

Each confirmed finding contains:

- file and line;
- the input source and the sink, with the data path;
- who can trigger it and under which preconditions;
- a non-destructive exploit description or the exact code path that proves it;
- impact: confidentiality, integrity, availability, tenant or privilege boundary;
- the concrete fix, with a safe pattern for the project's language and framework;
- confidence: confirmed, likely or needs verification;
- the regression test that should fail before the fix and pass after it.

Redact secret values. Report the type, location and a short masked preview; never paste a live credential into the review, a log or a report.

## 7. Report and re-review

Report scope, method, commands and scans run, findings by severity, what was checked and clean, what was not verified and residual risk. For a fix, re-read the changed code: confirm the vulnerable path is gone, the safe pattern is used everywhere it occurs and the regression test fails on the old behavior.

## Safe patterns and false positives

Do not report:

- parameterized queries or ORM query builders where the value is bound, not interpolated;
- test fixtures, documentation examples and clearly fake sample keys;
- publishable keys designed to be public (for example, an anon key whose security depends on server-side authorization), once that authorization is confirmed;
- output encoding that is correct for the context, or HTML that contains no user data;
- a dependency advisory that is not reachable from the changed code, unless the package is directly exposed.

Still verify these patterns. "Looks parameterized" is not evidence: check the actual call, the driver and the dynamic identifier handling.

## Limits

This review covers code-visible risks and the changed configuration. It does not replace threat modeling, penetration testing, infrastructure review, runtime detection or compliance assessment. State that limit in the report; do not claim that a clean review means the system is secure.
