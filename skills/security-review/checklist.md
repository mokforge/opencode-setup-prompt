# Security checklist: do not miss these

Use this checklist for every review. Open the detail file for each surface present in the change. Default severity is a starting point: raise it for public entrypoints, admin paths, payments, PII, multi-tenant data and high-privilege processes; lower it only with evidence.

## Must-not-miss checklist

| Area                                     | What to check                                                                                                                                                                                 | Default severity                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| SQL injection                            | Every SQL string: string interpolation, concatenation, `format`, f-strings, raw query APIs, dynamic `ORDER BY`, table or column names, `LIKE` patterns, stored values reused in a later query | Critical when data or authentication is exposed; High otherwise      |
| NoSQL and ORM injection                  | Request body passed as a query filter, operator keys such as `$ne`, `$where`, `$expr`, unsafe raw ORM fragments, unvalidated JSON query objects                                               | High to Critical                                                     |
| OS command injection                     | User input reaching `os.system`, `subprocess` with `shell=True`, `exec`, backticks, `Runtime.exec`, `child_process.exec`; argument injection into external tools                              | Critical                                                             |
| Template injection                       | User input used as a template source or rendered with a template engine on the server; sandbox escapes; `render_template_string` with user data                                               | Critical when code execution is possible; High otherwise             |
| LDAP, XPath and query-language injection | User input concatenated into filters, queries or expressions; missing escaping or allowlists                                                                                                  | High                                                                 |
| Path traversal and local file inclusion  | `..`, absolute paths, symlinks, user-controlled file names, download and upload paths, archive extraction (zip slip)                                                                          | High to Critical                                                     |
| XXE                                      | XML parsers with DTD or external entity resolution enabled; untrusted XML or SVG input                                                                                                        | High to Critical                                                     |
| Unsafe deserialization                   | `pickle`, `marshal`, `yaml.load`, Java `ObjectInputStream`, .NET `BinaryFormatter`, PHP `unserialize`, unsafe JSON-to-object binding                                                          | Critical                                                             |
| Header and log injection                 | User input in headers, logs, CSV cells, terminal output; CRLF characters; forged log entries; CSV/formula injection                                                                           | Medium to High                                                       |
| Broken authentication                    | Login, password reset, MFA, session lifecycle, account recovery, default accounts, timing leaks                                                                                               | Critical                                                             |
| Object-level authorization (IDOR/BOLA)   | Every endpoint that accepts an object ID; ownership and tenant checks; sequential IDs; bulk endpoints; nested resources                                                                       | Critical for sensitive data; High otherwise                          |
| Function-level authorization (BFLA)      | Admin and privileged actions; HTTP method bypass; direct endpoint calls; hidden UI actions; internal APIs                                                                                     | High to Critical                                                     |
| Mass assignment                          | Request body bound to a model or entity; fields such as `role`, `is_admin`, `owner_id`, `price`, `status`, `tenant_id` writable by the client                                                 | High when privilege, money or tenant data is affected                |
| Tenant isolation                         | Tenant ID taken from the request instead of the authenticated context; queries missing a tenant filter; shared caches and storage keys                                                        | Critical                                                             |
| Sessions, JWT and OAuth                  | Cookie flags, session rotation, logout invalidation, JWT signature and algorithm, `exp`/`aud`/`iss`, token storage, OAuth state and redirect URI, PKCE                                        | Critical to High                                                     |
| CSRF                                     | State-changing requests using cookies; missing token or Origin check; `SameSite=None`; GET requests with side effects                                                                         | High for sensitive actions; Medium otherwise                         |
| XSS                                      | Stored, reflected and DOM XSS; raw HTML sinks; autoescape disabled; unsafe attributes and URLs; CSP gaps                                                                                      | High for stored or authenticated XSS; Medium for reflected/DOM       |
| SSRF                                     | User-controlled URLs or hostnames; allowlists; redirects; DNS rebinding; private, link-local and cloud metadata addresses; egress controls                                                    | High to Critical when internal services or credentials are reachable |
| Open redirect and host header injection  | Redirect targets from request data; password-reset links; absolute URL generation from the `Host` or `X-Forwarded-Host` header                                                                | Medium; High in authentication and recovery flows                    |
| CORS                                     | Wildcard origin with credentials; reflected origin; permissive methods and headers; trust in `null` origin                                                                                    | Medium to High                                                       |
| File upload and download                 | Content and extension allowlist, content-type spoofing, size limits, storage outside the web root, executable files, random names, signed URLs, malware                                       | High to Critical                                                     |
| GraphQL and WebSocket                    | Introspection in production, batching and depth limits, field-level authorization, subscription authorization, WebSocket authentication on upgrade and origin checks                          | High                                                                 |
| Rate limiting and denial of service      | Login, OTP, password reset, expensive queries, unbounded pagination, regex backtracking, large payloads, archive bombs                                                                        | Medium; High on authentication and public expensive endpoints        |
| Secrets                                  | Hardcoded keys and passwords, `.env` in the repository, client bundle exposure, `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_`, CI logs, git history, error output                                     | Critical for live privileged secrets; High otherwise                 |
| Cryptography and password storage        | MD5/SHA-1 for passwords, unsalted hashes, static IVs or nonces, weak randomness, home-made crypto, disabled TLS verification, hardcoded encryption keys                                       | High to Critical                                                     |
| Sensitive data exposure                  | Excessive response fields, PII or card data in logs, stack traces and debug output, data in URLs, cache and storage retention, backup exposure                                                | High for regulated or authentication data; Medium otherwise          |
| Race conditions and business logic       | Double spend, coupon reuse, stock oversell, TOCTOU in file or permission checks, replay of signed requests, negative quantities, price and step tampering                                     | High to Critical when money, inventory or access is affected         |
| Dependencies and supply chain            | New packages, known vulnerable versions, lockfile changes, typosquatting, install scripts, unmaintained packages, transitive risk                                                             | High when a known exploit is reachable; Medium otherwise             |
| CI/CD and infrastructure                 | Secrets in build logs, unpinned actions, fork pull-request permissions, artifact integrity, public buckets, wildcard IAM, `0.0.0.0/0`, metadata access, container root users                  | High to Critical                                                     |
| Debug and default settings               | `DEBUG=True`, stack traces in responses, open admin or metrics endpoints, default credentials, permissive development flags in production                                                     | High                                                                 |
| LLM and agent features                   | Prompt injection from untrusted content, tools with side effects, excessive agency, secrets in prompts, model output used as SQL, HTML, shell or authorization input                          | High to Critical when tools can act or sensitive data is reachable   |

## Quick searches

These searches find candidates, not findings. Read each match and trace the data flow before reporting it.

| Search for                                                                                             | Investigate                                                                               |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `execute(`, `.raw(`, `.extra(`, `RawSQL`, `text(`, `query(`, `$queryRawUnsafe`                         | SQL or raw ORM fragments, especially with `+`, `f"`, `%`, `.format(` or template literals |
| `SELECT`, `INSERT`, `UPDATE`, `DELETE`                                                                 | String construction, dynamic identifiers, `ORDER BY` from request data                    |
| `subprocess`, `os.system`, `shell=True`, `exec(`, `eval(`, `child_process`                             | Command construction and argument injection                                               |
| `pickle.loads`, `yaml.load(`, `marshal.loads`, `unserialize`, `ObjectInputStream`, `BinaryFormatter`   | Untrusted deserialization                                                                 |
| `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, `Markup(`, `autoescape=False`, `safe` filter         | XSS sinks and disabled escaping                                                           |
| `requests.get(`, `httpx.get(`, `fetch(`, `urllib.request`, `open(`                                     | SSRF and path or file access with user-controlled targets                                 |
| `verify=False`, `InsecureSkipVerify`, `NODE_TLS_REJECT_UNAUTHORIZED`, `ssl._create_unverified_context` | Disabled TLS verification                                                                 |
| `DEBUG`, `debug=True`, `TRACE`, `stacktrace`, `console.log`                                            | Debug output, stack traces and sensitive logging                                          |
| `AKIA`, `sk-`, `BEGIN PRIVATE KEY`, `password`, `secret`, `token`, `api_key`                           | Hardcoded or logged credentials; verify, redact and request rotation                      |
| `role`, `is_admin`, `tenant_id`, `owner_id`, `price`, `balance`                                        | Mass assignment, authorization and tenant-boundary fields                                 |

## Blocking examples

These are blocking even when the diff is small:

- A query built by string interpolation or concatenation with request data.
- An endpoint that loads an object by ID without checking ownership, tenant or permission.
- A live secret in source, configuration, a client bundle or git history.
- `pickle`, `yaml.load`, Java or .NET unsafe deserialization on untrusted input.
- A file path, download name or archive entry controlled by the user without canonicalization and a safe root.
- An admin action reachable without server-side authorization.
- A password stored with a fast hash, unsalted hash or reversible encryption.
- A production debug mode or default admin credential.
- A new dependency with a known reachable critical vulnerability.
