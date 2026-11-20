# C4 validation and PlantUML4Idea compatibility

## Portable format

- Save as a UTF-8 `.puml` file with a balanced `@startuml`/`@enduml` pair so PlantUML4Idea (JetBrains plugin ID `7017`) can open and preview the source. Keep diagram code in plain `.puml` files, not screenshots, embedded Mermaid or generated SVG only.
- Use the C4 files from the PlantUML bundled standard library: `!include <C4/C4_Context>`, `!include <C4/C4_Container>` or `!include <C4/C4_Component>`. They work offline if the plugin's PlantUML engine includes C4. Never switch to a remote `!include` URL: it depends on network access and may change without warning.
- PlantUML4Idea uses its own PlantUML runtime and version. A newer separate CLI can accept a macro that an older plugin cannot. Match the plugin engine or upgrade and configure its PlantUML JAR. On macOS and Linux, install Graphviz if the chosen layout requires it; `dot -V` checks availability.
- CLI success does not prove that the plugin renders the diagram. Open the real file in IntelliJ IDEA or PyCharm with PlantUML4Idea and inspect the preview: text, C4 boundaries, arrow direction, clipping and legibility. If the IDE is not accessible, report manual preview as pending.

## Mandatory checks before accepting a diagram

1. Check exactly one balanced `@startuml`/`@enduml` pair, the local standard-library include for the chosen level, unique aliases and no undeclared relationship endpoints. Verify that L2 contains containers and no components, and that L3 contains components inside one container.
2. Verify syntax with the installed CLI, choosing one available form:

   ```bash
   plantuml -checkonly path/to/diagram.puml
   # Or use the same JAR configured in the JetBrains plugin:
   java -jar /path/to/plantuml.jar -checkonly path/to/diagram.puml
   ```

   Current PlantUML releases also document `--check-syntax`. On a non-zero exit code or diagnostic, fix the source and rerun. Do not swallow errors with `|| true`.

3. Test an actual render to SVG in a temporary directory with the same PlantUML CLI or JAR; check that the output exists, is not an error image and is readable. Do not commit generated images unless requested.
4. Preview the source in PlantUML4Idea. When no CLI, JAR or IDE is available, record which checks were not executed. Never claim successful rendering without execution.
