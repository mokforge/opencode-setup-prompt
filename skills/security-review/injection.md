# Injection and unsafe data handling

Injection is any case where untrusted data becomes code, a query, a path or a trusted instruction. Trace every source to every sink; do not stop at the first validation layer.

## SQL injection

### Vulnerable patterns

- String interpolation or concatenation into SQL: f-strings, `%`, `.format`, `+`, JavaScript template literals, Java `String.format`, PHP interpolation.
- Raw query APIs: `cursor.execute` on a built string, SQLAlchemy `text()` with interpolation, Django `.raw()`, `.extra()` and `RawSQL`, Prisma `$queryRawUnsafe`, Sequelize `query`, ActiveRecord fragments built from input.
- Dynamic identifiers: table, column, sort direction, `ORDER BY`, `LIMIT` and `OFFSET` cannot be safely bound as ordinary parameters. Input used there needs an allowlist mapping.
- Second-order injection: a value stored safely and later concatenated into another query, report, migration or export.
- `LIKE` and `IN` built by joining user input; escaping wildcards when the user should not control them.

```python
# Vulnerable: request data is SQL syntax
email = request.args["email"]
cursor.execute(f"SELECT id, role FROM users WHERE email = '{email}'")

# Safe: the driver binds the value, not the string
cursor.execute("SELECT id, role FROM users WHERE email = %s", (email,))
```

```javascript
// Vulnerable
db.query(`SELECT * FROM products WHERE name LIKE '%${q}%'`);

// Safe: placeholders depend on the driver, but the value is always bound
db.query("SELECT * FROM products WHERE name LIKE $1", [`%${q}%`]);
```

### Safe patterns

- Use the driver's parameter placeholders: `%s`, `?`, `$1`, `:name` according to the driver. Bind a tuple, list or object; never interpolate.
- Use ORM query builders with values, not raw fragments: `select(User).where(User.email == email)`, `User.objects.filter(email=email)`.
- For SQLAlchemy `text()`, bind parameters explicitly: `text("... WHERE email = :email")` with `{"email": email}`.
- Map sort and filter keys to fixed query fragments with a dict; reject unknown keys. Never pass the raw key into `ORDER BY`.
- Parameterization does not protect identifiers. Use a fixed allowlist for columns, tables, directions and operators.
- Use a least-privilege database account, disable detailed SQL errors in production, and add a regression test that sends a quote or boolean payload and asserts no data leak or error.
- Review every call, including `LIKE` handling: `%` and `_` are data wildcards, not injection, but they change semantics when the user should provide a literal.

### Review questions

- Does any SQL string contain `+`, `f"`, `%`, `.format(`, a template literal or an ORM raw fragment?
- Is every raw query call bound? Is the binding at the correct call, not only in a helper?
- Can the user influence an identifier, sort order or limit? Where is the allowlist?
- Is stored input reused in a query, migration, export or report later?
- Does the database user have more privileges than this code needs?

## NoSQL and ORM injection

- Never pass a request body or JSON object directly as a Mongo or other NoSQL filter. Validate its shape and allowlist operators.
- Reject operator keys such as `$ne`, `$gt`, `$where`, `$expr`, `$regex` when they come from the client; `$where` and JavaScript execution are especially dangerous.
- Do not build Redis or Lua commands from user input; use the client's safe command API.
- Watch ORM features that accept raw fragments (`whereRaw`, `havingRaw`, `orderByRaw`, `extra`, `RawSQL`) even when the rest of the code is safe.

## OS command injection

- Prefer APIs over shell commands. If a command is necessary, pass an argument list with `shell=False` or the platform equivalent: `subprocess.run(["tool", value], check=True)`.
- Do not use `os.system`, `eval`, `exec`, backticks or `child_process.exec` with untrusted data.
- If a shell is unavoidable, quote only with the platform's correct escaping function and still validate against an allowlist; `shlex.quote` is not a substitute for understanding the command.
- Check argument injection even without a shell: a value beginning with `-` can become an option. Use `--` where supported or validate the value.
- Restrict the command's environment, working directory and privileges.

## Template injection

- Do not render user input as a template source. User data belongs in template context variables, never in the template string.
- Do not use `render_template_string` or equivalent with request data.
- Keep autoescaping on for HTML contexts; if it is disabled, require context-specific encoding and a reason.
- If the product intentionally supports user-authored templates, use a sandboxed engine and review the sandbox, available objects and escape paths.

## LDAP, XPath and query languages

- Use the library's escaping function for the target syntax and escape at the point where the value enters the filter.
- Validate against an allowlist when the syntax does not support safe parameters.
- Never concatenate user input into an LDAP filter, XPath expression, JMESPath/JSONPath selector or search query used for authorization.

## Path traversal and file inclusion

- Never build a filesystem path directly from a request name. Resolve the final path and verify it is inside the intended base directory (`Path.resolve()` plus an `is_relative_to(base)` check or the platform equivalent).
- Reject absolute paths, `..` segments, null bytes and unexpected symlinks. Be careful with URL decoding and double encoding.
- Use generated storage names and keep the original name as metadata only.
- For downloads, serve by an opaque ID and look up the path server-side; do not accept the path from the client.
- For archives, validate every extracted entry against the destination root (zip slip) and enforce size and file-count limits.
- Do not include or execute files selected by the user; map allowed logical names to fixed paths.

## XXE

- Disable DTDs and external entities in every XML parser: Python `defusedxml` or lxml with `resolve_entities=False`, `load_dtd=False`, `no_network=True`; equivalent settings in Java, .NET, PHP and Node.
- Do not parse untrusted SVG, SOAP, RSS or Office XML with default settings.
- Prefer a JSON format when the protocol does not require XML.

## Unsafe deserialization

- Never deserialize untrusted data with `pickle`, `marshal`, `yaml.load`, Java `ObjectInputStream`, .NET `BinaryFormatter`, PHP `unserialize` or equivalent.
- Use `yaml.safe_load`, JSON with schema validation and explicit field mapping. Validate length, types and allowed values.
- For signed payloads, verify the signature with a trusted key before parsing, check expiry and replay protection, and still validate the schema.
- Do not let a request choose the class, type or module that will be instantiated.

## Header, log and output injection

- Reject CR/LF in values written to HTTP headers, redirects, cookies and logs. Encode or strip them at the boundary.
- Use structured logging and encode user data as fields, not by concatenating into a log line.
- Do not log secrets, tokens, passwords, full card numbers or sensitive personal data.
- Escape CSV cells that begin with `=`, `+`, `-` or `@` when the file may be opened in a spreadsheet.
- Encode terminal output when it includes untrusted data that a person or script may read.

## When reporting

State the source, the sink, the exact path and who can reach it. Include a non-destructive proof or code path, the impact, the safe pattern for the project's stack and a regression test. Do not run destructive payloads or test against production.
