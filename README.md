# OpenCode Setup Prompt

Configure any repository for development or documentation as code in OpenCode.

## Use

From the root of your project (a git repository), invoke the setup prompt in OpenCode. For example:

```bash
opencode --prompt "Set up this project using the OpenCode setup prompt at https://github.com/mokforge/opencode-setup-prompt"
```

Any wording or language works. You can also provide only the prompt's URL or local file path.

The prompt detects whether the project is new or already configured and sets it up or updates it accordingly. No exact phrase or extra rerun instruction is needed. Existing project choices and skill content are preserved in meaning and structure; prose in every installed skill is translated into the selected language. Proposed changes are shown for confirmation.

Requires OpenCode V2 with a configured provider and model. Setup files go in `.opencode/`; nothing is committed or pushed. Review the result with `git diff`.
