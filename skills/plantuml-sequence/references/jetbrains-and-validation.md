# Validating sequence diagrams for PlantUML4Idea

1. Save the diagram as a UTF-8 `.puml` file with one `@startuml` and `@enduml`; keep the source file as the deliverable. PlantUML4Idea (JetBrains plugin ID `7017`) displays native PlantUML source in its preview window.
2. Check declared participant aliases, matching `alt`/`opt`/`loop`/`par` and `end`, matching `activate`/`deactivate` (if used), existing message endpoints and genuine method/path/event names. Note that a syntactically valid diagram can still depict the wrong runtime behavior.
3. Run a real syntax check with a local PlantUML CLI, preferably the same engine version as the IDE plugin:

   ```bash
   plantuml -checkonly path/to/Sequence_Flow.puml
   # Or, for an explicitly configured PlantUML JAR:
   java -jar /path/to/plantuml.jar -checkonly path/to/Sequence_Flow.puml
   ```

   Recent PlantUML also supports `--check-syntax`. A non-zero exit or parser error must be fixed; do not ignore it or pretend validation happened.
4. Render the `.puml` to SVG in a temporary directory and inspect for errors and legibility; do not commit generated output unless requested. In IntelliJ IDEA / PyCharm with PlantUML4Idea installed, open the same `.puml` and check that the preview renders without errors, truncation, crossed labels or confusing interactions.
5. If neither PlantUML CLI/JAR nor the IDE is accessible, explicitly report unperformed checks. Never infer compatibility solely from Markdown formatting or the presence of `.puml` extension.

References: [PlantUML sequence syntax](https://plantuml.com/sequence-diagram), [PlantUML command-line verification](https://plantuml.com/command-line), [PlantUML4Idea plugin](https://github.com/esteinberg/plantuml4idea), [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/7017-plantuml4idea/).
