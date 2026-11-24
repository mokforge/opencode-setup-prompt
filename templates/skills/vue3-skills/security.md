# Vue 3 security

- Never build a Vue template from user-controlled or otherwise untrusted strings. A template is executable code, not a safe rendering format.
- Vue escapes normal text interpolation and attribute bindings, but this does not make every HTML or URL use safe.
- Avoid `v-html` and other raw HTML sinks for untrusted content. If rich text is a required feature, use a well-maintained sanitizer at the trusted boundary and review the allowed elements, attributes, and URL schemes.
- Do not bind user-provided JavaScript to event-handler attributes or compile dynamic scripts.
- Validate and sanitize URLs on the server before storing or distributing them. Do not trust a URL because it was checked only in the browser.
- Restrict user-controlled CSS to a small allowlist of safe properties and values; arbitrary styles can obscure or imitate security-sensitive controls.
- Treat client-side route guards and hidden UI as presentation, not authorization. Enforce access control, validation, and secrets management on the server.
- For SSR, isolate request-specific state and escape data at serialization boundaries. Never render untrusted input as a server-side Vue template.
- Add regression tests for security-sensitive rendering or URL handling without using live data or real credentials.
