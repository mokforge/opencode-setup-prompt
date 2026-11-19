# JetBrains PlantUML4Idea compatibility and validation

## Portable format

- Save as UTF-8 `.puml`, with `@startuml` and `@enduml`, so PlantUML4Idea (JetBrains plugin ID `7017`) can open and preview the source. Keep diagram code in plain `.puml` files, not screenshots, embedded Mermaid or generated SVG only.
- Use the C4 files in the PlantUML bundled standard library: `!include <C4/C4_Context>`, `!include <C4/C4_Container>` or `!include <C4/C4_Component>`. They work offline **if the plugin's PlantUML engine includes C4**. Never silently switch to `raw.githubusercontent.com/.../master`, which depends on network access and may change without warning.
- PlantUML4Idea uses its own PlantUML runtime/version. A newer separate CLI can accept a macro that an older plugin cannot. Match the plugin engine or upgrade/configure its PlantUML JAR. On macOS/Linux, install Graphviz if the chosen layout requires it; `dot -V` can check availability.
- Do not assume CLI success proves the plugin renders: open the real file in IntelliJ IDEA / PyCharm with PlantUML4Idea and inspect its preview. Verify text, C4 boundaries, arrow direction, clipping and legibility. If the IDE is not accessible, report manual preview as pending.

## Mandatory check before accepting a diagram

1. Check exactly one balanced `@startuml` / `@enduml` pair, correct local stdlib include, unique aliases, and no undeclared relationship endpoints. Verify that L2 contains containers and L3 contains components.
2. Verify syntax with the installed CLI (choose **one** available form):

   ```bash
   plantuml -checkonly path/to/diagram.puml
   # Or use the same JAR configured in the JetBrains plugin:
   java -jar /path/to/plantuml.jar -checkonly path/to/diagram.puml
   ```

   Current PlantUML releases also document `--check-syntax`. On a non-zero exit code or diagnostic, fix the source and rerun. Do not swallow errors with `|| true`.
3. Test an actual render to SVG in a temporary directory using the same PlantUML CLI/JAR; check that the output exists, is not an error image, and is readable. Do not commit generated images unless requested.
4. Preview the source in PlantUML4Idea. When no CLI/JAR or IDE is available, clearly record which checks were **not executed**. Never claim successful rendering without execution.

## References

- [C4-PlantUML maintained project and levels](https://github.com/plantuml-stdlib/C4-PlantUML)
- [PlantUML standard library](https://plantuml.com/stdlib)
- [PlantUML command line](https://plantuml.com/command-line)
- [PlantUML4Idea plugin documentation](https://github.com/esteinberg/plantuml4idea)
- [PlantUML4Idea on JetBrains Marketplace](https://plugins.jetbrains.com/plugin/7017-plantuml4idea/)
