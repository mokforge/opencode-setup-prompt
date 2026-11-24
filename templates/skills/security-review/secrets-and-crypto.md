# Secrets, cryptography and sensitive data

## Secrets

- A secret in source, configuration, a client bundle, a build artifact, a log or git history is compromised from the moment it was written. Removing it from the latest commit is not enough: rotate it at the provider.
- Search for API keys, tokens, passwords, private keys, connection strings and signing keys in the diff, configuration, tests, fixtures, CI files and documentation.
- Check client-exposed environment prefixes (`NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, `EXPO_PUBLIC_`) and anything compiled into a frontend bundle. A server key there is visible to every user.
- Do not put secrets in URLs, query strings, analytics, error messages or exception traces.
- Prefer a secret manager or workload identity over static credentials. Scope each credential to one workload and the minimum permissions; use short-lived credentials where possible.
- Never print a raw secret in a review, log or report. Give the type, location and a masked preview, and state the required rotation.
- Check git history and CI logs when a secret is found, not only the current file.
- Distinguish a real secret from a value designed to be public (for example, a publishable key) before reporting it; still verify what protects the public value.

## Cryptography

- Use proven libraries and standard constructions. Do not invent encryption, hashing, token formats or random generators.
- Passwords: Argon2id, bcrypt or scrypt with a unique salt and a calibrated cost. Never use MD5, SHA-1, SHA-256 alone or reversible encryption for passwords.
- Symmetric encryption: authenticated encryption such as AES-GCM or ChaCha20-Poly1305 with a unique nonce per message. Never reuse a nonce with the same key.
- Random values for tokens, salts, nonces and IDs come from a cryptographic source (`secrets`, `os.urandom`, `crypto.randomBytes`), not from `random`, `Math.random` or timestamps.
- Compare secrets and signatures in constant time where the platform provides it.
- Do not hardcode encryption keys or IVs. Manage keys in a KMS or secret manager, rotate them, and document the key version with the ciphertext.
- TLS: verify certificates and hostnames; do not disable verification to "make it work". Pin only with a rotation plan.
- Hashing for integrity is not authentication. Use an HMAC or a signature with a key for authenticity.

## Sensitive data

- Classify the data the change touches: credentials, tokens, personal data, financial data, health data, tenant-confidential data.
- Minimize collection and retention. Do not add a field or log line "just in case".
- Encrypt sensitive data in transit and at rest where the project's data classification requires it.
- Do not expose sensitive fields through serializers, admin panels, exports, search indexes, caches or error pages.
- Redact logs, metrics and traces. Do not log full request bodies, authorization headers, cookies, passwords, card numbers or personal identifiers.
- Do not put sensitive data in URLs, browser storage, filenames or third-party analytics.
- Check backups, temporary files and debug dumps for the same data.
- Apply access control to exports, reports and bulk endpoints; they often bypass normal response filtering.

## Tokens and identifiers

- Use enough entropy for the token's lifetime and purpose; do not derive tokens from predictable values.
- Set expiry, scope and audience; support revocation where the threat model requires it.
- Store refresh tokens and API keys hashed server-side where possible; never log them.
- Use opaque, random identifiers for external references when enumeration enables abuse, but keep authorization checks in place.
- Do not trust a token claim that the client can edit without verification.

## Configuration

- Keep secrets out of committed `.env` files. Provide an example file with placeholders only.
- Use different credentials per environment; do not reuse production secrets in tests or preview deployments.
- Restrict who can read CI variables and deployment secrets; mask them in logs.
- Check that error responses do not include configuration, connection strings or stack traces in production.
- Review encryption, retention and access settings for storage, queues, backups and analytics when the change touches them.

## When reporting

Name the secret type and location, never the value. State whether it is live, what it can access, and the rotation step at the provider. For crypto findings, explain the concrete weakness and give the safe construction for the project's stack. For data exposure, name the field, the audience and the boundary that was crossed.
