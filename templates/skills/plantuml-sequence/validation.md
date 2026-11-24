# Validating sequence diagrams for PlantUML4Idea

1. Save the diagram as a UTF-8 `.puml` file with one `@startuml` and `@enduml`; keep the source file as the deliverable. PlantUML4Idea (JetBrains plugin ID `7017`) displays native PlantUML source in its preview window.
2. Check declared participant aliases, matching `alt`/`opt`/`loop`/`par` and `end`, matching `activate`/`deactivate` when used, existing message endpoints and genuine method/path/event names. A syntactically valid diagram can still depict the wrong runtime behavior.
3. Run a real syntax check with a local PlantUML CLI, preferably the same engine version as the IDE plugin:

   ```bash
   plantuml -checkonly path/to/seq-flow.puml
   # Or, for an explicitly configured PlantUML JAR:
   java -jar /path/to/plantuml.jar -checkonly path/to/seq-flow.puml
   ```

   Recent PlantUML also supports `--check-syntax`. A non-zero exit or parser error must be fixed; do not ignore it or pretend validation happened.

4. In IntelliJ IDEA or PyCharm with PlantUML4Idea installed, open the `.puml` and check the preview for errors, truncation, crossed labels or confusing interactions. Do not export image files unless explicitly requested.
5. If neither PlantUML CLI/JAR nor the IDE is accessible, explicitly report unperformed checks. Never infer compatibility solely from Markdown formatting or the presence of a `.puml` extension.
