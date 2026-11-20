# Code-first generation and tooling

Use this reference when the project generates OpenAPI from route code, model declarations, annotations, or framework metadata.

## Code-first workflow

1. Identify the framework, installed generator, source annotations/models, generated-file location, and regeneration command from project files.
2. Confirm whether the generated contract is committed or produced only during builds.
3. Update route metadata, request/response models, or generator configuration at the authoritative source.
4. Regenerate only with the project's existing command. Do not install a generator or change dependencies without authorization.
5. Compare the generated contract with the intended API behavior. Report unsupported constructs and unverified output.

For design-first or hybrid projects, do not regenerate over hand-maintained contract content unless the existing workflow says to do so.

## Framework notes

- **Python/FastAPI:** inspect route decorators, Pydantic request/response models, dependencies, exception handlers, and the configured OpenAPI export. Check how the project's Pydantic/FastAPI versions express aliases, optional values, examples, and security.
- **TypeScript/Express:** inspect the route registration and validation models. If a decorator-based generator such as `tsoa` is already configured, follow its controller, model, and generation conventions.
- **Other frameworks:** use only generators already present in the repository. Do not assume framework behavior from a similar project or add annotations solely to imitate these examples.

Illustrative FastAPI shape; verify imports and syntax against the installed project version:

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Example service", version="1.0.0")


class ItemResponse(BaseModel):
    id: str
    name: str


@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str) -> ItemResponse:
    return ItemResponse(id=item_id, name=f"Item {item_id}")
```

This example shows only where route and model metadata may come from. It does not establish a project's endpoint, model, implementation, or server address.

## Local validation

- Prefer the project's existing scripts and CI checks.
- If configured, use the project's OpenAPI linter (for example, Spectral or Redocly) and its existing ruleset. Do not add a ruleset or package just for a task unless requested.
- Check both structural validity and contract quality: unresolved references, duplicate operation IDs, missing path parameters, incomplete response coverage, schema drift, security, and example validity.
- Do not claim validation passed unless the command ran successfully. If the tool is absent or cannot run, report the gap.
- Validation tools may read or write outside the repository or contact package registries. Follow the external-access policy; use only already-installed tools without network access unless permission was granted.

## SDK generation

- Generate an SDK only when the request asks for it or the project workflow requires it.
- Use the project's configured generator, version, language target, package metadata, and output directory.
- Do not install or download a generator without permission.
- Keep generated code separate from hand-maintained source and follow the project's ignore, commit, and regeneration rules.
- Report the contract version, generator and version, output path, command, and checks performed.
