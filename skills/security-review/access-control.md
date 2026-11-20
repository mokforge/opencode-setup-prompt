# Authentication, authorization and session security

## Authentication

- Check every login path, including API, mobile, admin, SSO and service-to-service.
- Passwords: use Argon2id, bcrypt or scrypt with a per-password salt and appropriate cost. Never use MD5, SHA-1 or a fast unsalted hash, and never store recoverable passwords.
- Compare secrets with a constant-time function where the platform provides one; do not leak whether the account or the password was wrong.
- Password reset and email verification: use a random, single-use, expiring token stored hashed; invalidate it after use; do not put secrets in a URL that is logged or referrer-leaked without expiry and scope.
- MFA: enforce for admin and sensitive actions; do not allow a client to disable it without re-authentication; protect against replay and brute force.
- Account recovery must not become an authorization bypass (security questions, support overrides, predictable reset codes).
- Default and seeded accounts: no known default passwords, no demo admin in production.
- Rate limit and lock out carefully; avoid user enumeration through timing, errors or response differences.

## Authorization

- Enforce authorization server-side on every request, including direct API calls, alternate HTTP methods, bulk endpoints, exports, GraphQL fields and internal routes.
- Deny by default. A missing policy is a denial, not an allow.
- Object-level authorization (IDOR/BOLA): for every ID, verify that the authenticated principal may access that object. Do not rely on an unguessable ID as authorization.
- Function-level authorization (BFLA): admin and privileged operations need an explicit role or permission check, not only a hidden button or route guard.
- Tenant isolation: derive the tenant from the authenticated context, not from a request parameter. Add the tenant filter to every query, cache key, storage path and background job.
- Check nested and related resources: access to a project does not automatically grant access to its invoices, members or files unless the policy says so.
- Bulk and batch endpoints must apply the check per object, not only to the first one.
- GraphQL: check authorization per field and resolver, not only at the query root; protect introspection according to the environment.
- Do not authorize from client-editable data: role in the request body, `user_metadata`, a header the client sets, a hidden field or a JWT claim that the server does not verify.

## Mass assignment

- Bind only an explicit allowlist of fields. Never pass a request body or dictionary directly into a model, ORM create/update or serializer.
- Treat `role`, `is_admin`, `permissions`, `owner_id`, `tenant_id`, `status`, `price`, `balance` and `email_verified` as privileged fields. They need a separate authorization decision.
- For frameworks with strong parameters or serializers, confirm the allowlist is present on every create and update path, including nested attributes.

## Sessions and cookies

- Set `HttpOnly`, `Secure` and an appropriate `SameSite` value; use the `__Host-` prefix where it fits.
- Rotate the session ID on login and privilege change; invalidate the session on logout, password change and account disable.
- Set idle and absolute timeouts; store sessions server-side or use a signed, encrypted token with revocation.
- Do not put sensitive data in cookies, local storage or URLs.
- Protect session fixation: do not accept a session ID from the client before authentication.

## JWT and OAuth/OIDC

- Verify the signature with the expected algorithm and key. Reject `alg: none`, algorithm confusion and keys chosen by the token.
- Validate `exp`, `nbf`, `aud`, `iss` and the intended token type. Do not trust claims the issuer does not control.
- Keep signing keys and client secrets server-side; rotate them; never ship them in a client bundle.
- OAuth: use Authorization Code with PKCE for public clients, validate `state`, use exact redirect URI matching, and do not accept open redirects.
- Do not put secrets, full personal data or authorization decisions that must be revocable into a long-lived token without a revocation path.

## CSRF

- Protect every state-changing request that authenticates with cookies: synchronizer token, double-submit token or a verified Origin/Referer check.
- `SameSite=Lax` or `Strict` reduces risk but is not a complete replacement for a token on sensitive actions.
- Do not use GET for state changes. Do not accept a token from a place an attacker can set.
- Check CORS together with CSRF: permissive CORS with credentials can defeat the protection.

## Business logic and race conditions

- Check price, quantity, discount, currency, status and ownership on the server; never trust values calculated or hidden by the client.
- Use transactions, row locks or atomic updates for balance, inventory, coupon and quota changes. Test concurrent requests, not only sequential happy paths.
- Make retried and duplicate requests idempotent where money or state is involved. Verify replay protection for signed webhooks and one-time tokens.
- Check TOCTOU gaps between a permission or file check and the operation that follows.
- Reject negative, zero, oversized and out-of-range values where the business rule requires it.

## When reporting

State the actor, the object, the missing or incorrect check and the impact. For an IDOR, name the endpoint, the parameter and the data reachable. For a session or token issue, state the preconditions and the concrete attack. Include a regression test with two identities or two tenants.
