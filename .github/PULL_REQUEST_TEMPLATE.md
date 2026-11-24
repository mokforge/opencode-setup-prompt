## Summary

<!-- What changed and why. -->

## Checklist

- [ ] Skills: frontmatter has `name` and `description`, the description explains when to use the skill, and referenced files exist.
- [ ] `node --test tests/*.test.mjs` passes on Node.js 24.x.
- [ ] `pre-commit run --all-files` passes.
- [ ] For behavior changes, requirements and relevant architecture/ADR documents were reviewed before implementation; developer, tester, and reviewer received the same approved baseline.
- [ ] Role boundaries and orchestration are preserved, including for trivial changes: analyst/architect own documentation, developer owns implementation code and test changes, and tester/reviewer do not edit files.
- [ ] Documentation is current and matches the implementation, or analyst/architect and reviewer provided evidence that no documentation update was needed.
- [ ] Blockers were routed to the responsible role, answers were documented and reviewed, and no work relied on an unapproved assumption.
- [ ] Prompt, README, contributor guidance, and verification checks are updated when their behavior or instructions change.
