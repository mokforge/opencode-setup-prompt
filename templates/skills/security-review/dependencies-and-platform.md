# Dependencies, CI/CD and platform configuration

## Dependencies and supply chain

- Review every new dependency: why it is needed, whether the standard library or an existing package covers it, its maintenance and license.
- Check the resolved version and the lockfile, not only the manifest range. A floating range can pull a vulnerable release.
- Run the project's dependency audit where available (`pip-audit`, `npm audit`, `cargo audit`, `govulncheck`, or the CI equivalent). Verify that the vulnerable path is reachable before calling it blocking.
- Look for typosquatting, unexpected ownership changes, install scripts and packages that fetch code at install time.
- Do not add a dependency from an unverified fork, a pastebin or a URL outside the registry unless the task requires it and the source is pinned.
- Check transitive dependencies for known critical issues when the change updates a lockfile.
- Do not vendor a package without recording its version and source, and do not patch dependencies silently.
- For container and build dependencies, prefer pinned digests and reproducible builds.

## CI/CD

- Check that secrets are not echoed into logs and are masked; use short-lived tokens and OIDC federation where possible.
- Pin third-party actions and build images to a commit or version; `@main` and `latest` are supply-chain risks.
- Review pull-request workflows from forks: they must not receive production secrets or write permissions they do not need.
- Set the minimum token permissions (`permissions:` in GitHub Actions or the platform equivalent).
- Verify artifacts and release signatures where the project supports them; do not publish unsigned artifacts from an untrusted runner.
- Do not let a build step execute arbitrary code from a pull request with deployment credentials.

## Containers and orchestration

- Do not run as root; set a non-root user, a read-only filesystem where possible and dropped capabilities.
- Do not bake secrets into image layers or build arguments. A deleted layer is still in the image history.
- Pin base images and rebuild for security updates; avoid unmaintained or end-of-life images.
- Do not expose the Docker socket or privileged mode unless the task requires it and the risk is accepted.
- Check Kubernetes RBAC, service-account token mounting, network policies and secret objects; avoid wildcard roles.
- Limit CPU, memory and process counts where the platform allows it; do not let one workload exhaust the node.

## Cloud and infrastructure as code

- Check public storage buckets, database endpoints and admin interfaces; encryption and access policies.
- Avoid wildcard IAM permissions (`*` actions or resources) and long-lived access keys; use roles and least privilege.
- Review security groups and firewall rules for `0.0.0.0/0` on management, database or internal ports.
- Block access to cloud metadata services from workloads that do not need it; check IMDSv2 or the platform equivalent.
- Check that logs, backups and snapshots follow the same access and retention rules as the source data.
- Review Terraform, CloudFormation, Helm and Kubernetes changes for destructive or permissive defaults.

## Application configuration

- `DEBUG`, development error pages, profilers, admin panels, metrics and health endpoints must be closed or authenticated in production.
- Do not ship default credentials, sample users, permissive test flags or disabled authentication to production.
- Security headers, cookie flags, allowed hosts, trusted proxies and CORS settings belong to the deployment configuration; review changes there as carefully as code.
- Check file permissions, temporary directories and log locations for secrets or world-readable sensitive data.
- Verify that feature flags and "temporary" bypasses cannot be enabled by an unauthorized user.

## LLM and agent features

- Treat model input from users, documents, web pages and tool output as untrusted. Keep it in a user-role message or data field; do not concatenate it into the system prompt.
- Trace untrusted content to tools and function calls. A model that can send email, run SQL, move money or call internal APIs has excessive agency unless every action is authorized and confirmed.
- Never put secrets or privileged credentials in a prompt, context window or tool description.
- Validate model output before using it as SQL, HTML, shell, a URL, a file path or an authorization decision. The model is not a trust boundary.
- Apply prompt-injection defenses appropriate to the risk: instruction hierarchy, allowlisted tools, confirmation for side effects, output validation and logging.
- Do not send sensitive data to an external model provider without a documented data-processing decision.
- Test for indirect injection through retrieved documents, web pages, email and tool responses, not only direct user messages.

## When reporting

Name the dependency, version and advisory or the configuration path and its exposure. Explain who can reach it and what they gain. For infrastructure, give the exact resource and the corrected setting. For LLM features, give the source of the untrusted content, the tool or sink it reaches and the missing confirmation or authorization.
