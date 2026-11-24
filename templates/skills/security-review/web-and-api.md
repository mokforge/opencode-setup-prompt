# Web and API security

## XSS: cross-site scripting

- Stored XSS is usually the most severe: user content rendered to other users, profile fields, comments, names, file metadata, admin views and exported HTML.
- Reflected XSS: request data echoed into HTML, errors, search pages or redirects.
- DOM XSS: client code writes untrusted data into `innerHTML`, `outerHTML`, `document.write`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, `v-html`, jQuery `.html()` or a URL assigned to `javascript:`.
- Use context-specific output encoding: HTML body, attribute, JavaScript, CSS and URL contexts are different. Relying on a single generic escape is a bug.
- Keep template autoescaping on. Any raw HTML sink needs a sanitizer with an allowlist and a documented reason.
- Validate URL schemes against an allowlist (`https`, `mailto`, relative); reject `javascript:`, `data:` and `vbscript:`.
- Add a restrictive Content-Security-Policy where the project can support it; CSP reduces impact but does not replace encoding.
- In single-page applications, do not put server data into `window` globals or inline scripts without encoding; avoid `eval` and string-to-code APIs.

## SSRF: server-side request forgery

- Any feature that fetches a user-supplied URL is a candidate: webhooks, image import, link preview, PDF rendering, office document conversion, URL metadata, proxy endpoints.
- Use an allowlist of schemes, hosts and ports. Prefer a fixed destination or a signed, server-side mapping.
- Resolve the hostname and block loopback, private, link-local, multicast and cloud metadata ranges (for example `169.254.169.254` and provider-specific addresses). Re-check after redirects.
- Disable or limit redirects; a redirect can move an allowed URL to an internal target. Watch DNS rebinding.
- Add network egress controls and require authentication for internal services; do not rely on the URL parser alone.
- For file fetchers, enforce size, content type and time limits to avoid resource exhaustion.

## Open redirect and host header injection

- Do not redirect to an arbitrary `next`, `return_to` or `url` parameter. Allow only relative paths or exact allowlisted hosts.
- Do not build absolute links for password reset, invitations or OAuth from the `Host` or `X-Forwarded-Host` header unless the host is allowlisted by configuration.
- Validate the final parsed URL, not only the string prefix; `https://trusted.example@evil.example` is not a trusted host.

## CORS

- Do not combine `Access-Control-Allow-Origin: *` with credentials.
- Do not reflect any origin. Use an exact allowlist, including scheme, host and port; treat `null` as untrusted.
- Restrict methods and headers; do not expose sensitive response headers unnecessarily.
- Remember that CORS is a browser control, not server-side authorization.

## File upload and download

- Allowlist extensions and content types; verify the actual file signature where possible, not only the client-provided `Content-Type`.
- Enforce size, count and decompression limits. Reject archives or scan them before extraction.
- Store uploads outside the web root or in object storage; use generated names and never execute uploaded content.
- Prevent path traversal in the stored name and in the download path. Serve downloads by an opaque ID with an authorization check.
- Set `Content-Disposition: attachment` and a safe `Content-Type` for user files; avoid rendering user HTML or SVG inline on the application origin.
- Scan for malware where the project has a scanner. Do not trust a file because it is "only an image".
- Signed URLs need a short expiry, a narrow scope and no ability to change the object key.

## GraphQL

- Enforce authorization in every resolver and for every field, not only at the query root.
- Disable or restrict introspection in production if it exposes internal schema details.
- Limit query depth, complexity and aliases/batching to prevent resource exhaustion.
- Disable or limit mutations that can be batched for brute force or race conditions.
- Validate variables with a schema; do not pass unvalidated input into filters or raw resolvers.
- Check that errors do not leak stack traces, SQL or internal field names.

## WebSocket

- Authenticate on the connection upgrade, not only in the first message.
- Validate the `Origin` against an allowlist; do not rely on cookies alone.
- Authorize every message and subscription; a connection authenticated as user A must not read user B's channel.
- Validate message shape and size; apply rate limits and close idle or abusive connections.

## Rate limiting, brute force and denial of service

- Rate limit login, OTP, password reset, invitation and expensive search endpoints; use per-account and per-IP limits with care for shared networks.
- Limit page size, query complexity, upload size, JSON depth and array length.
- Check regular expressions for catastrophic backtracking and XML/JSON parsers for entity or depth attacks.
- Use timeouts on outbound calls and database queries; do not let one request hold resources indefinitely.
- Protect expensive endpoints with authentication and quotas; return generic errors without revealing whether a user exists.

## API data exposure

- Return only the fields the client needs. Do not serialize whole models with secrets, password hashes, internal flags, tokens or other users' data.
- Check object and field authorization on read as well as write, including nested expansions, includes and `fields` parameters.
- Do not expose stack traces, SQL, internal hostnames or dependency versions in production errors.
- Use stable, non-enumerable identifiers where enumeration is a risk, but still enforce authorization.
- Version and document security-relevant behavior changes; do not silently weaken validation for backward compatibility.

## Webhooks and third-party callbacks

- Verify the signature with the provider's documented algorithm and a server-side secret; reject missing or stale timestamps and replayed delivery IDs.
- Do not trust the payload's tenant, user or amount until it is matched to your own records.
- Make handlers idempotent; a retry must not duplicate money, messages or state.
- Apply the same input validation as a public endpoint.

## HTTP conventions

- Use HTTPS and HSTS where the deployment supports it; do not disable certificate verification.
- Set secure cookie flags and sensible cache headers for authenticated responses.
- Add `X-Content-Type-Options: nosniff`, a frame-ancestors policy or `X-Frame-Options`, and a referrer policy where relevant.
- Do not expose debug, metrics, admin or health endpoints with sensitive data to the public internet.
