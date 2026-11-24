# L1: System context

## Scope

Show one software system, the people who use it and the neighboring software systems it depends on. L1 answers: who uses the system, and which external systems does it communicate with? Every element is a person or a software system; containers, components, databases and queues are not separate L1 elements.

## Notation

- Include exactly `!include <C4/C4_Context>`.
- `Person(alias, "Label", "Description")` for a person or role.
- `System(alias, "Label", "Description")` for the system in scope.
- `System_Ext(alias, "Label", "Description")` for each neighboring external system.
- `Rel(from, to, "verb phrase", "protocol/technology")` for dependencies.

## Rules

- Keep exactly one `System` for the diagram scope; represent everything outside it with `System_Ext`.
- Confirm every actor, external system and relationship in the code, configuration, contracts, deployment or the user's requested design.
- Describe each flow in its real direction; use `Rel_D`, `Rel_U`, `Rel_L` or `Rel_R` only for layout, never to change meaning.
- Put the business intent in the relationship label and the protocol or technology in the last parameter when confirmed.
- Keep internal structure, database schemas and implementation details out of L1; move them to L2 or L3.
- Use `LAYOUT_WITH_LEGEND()` where it improves legibility.

## Example

`examples/c4-l1-store.puml` — a fictional store context: a customer, the Store system and one external payment provider. Replace its elements with verified project facts.
