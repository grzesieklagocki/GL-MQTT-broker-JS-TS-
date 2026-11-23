# Project: MQTT Broker (TypeScript)

## Purpose

This project implements an MQTT 3.1.1 broker and client in TypeScript as part of an engineering thesis.

The primary goal is to deliver a working, tested MVP and finish the thesis. This is not a general-purpose MQTT framework.

## Scope

- Target MQTT 3.1.1 (protocol level 4).
- MQTT 5.0 is out of scope for now.
- Implement only the functionality required for the current task.
- Do not assume that planned features are already implemented.
- Check the code before making claims about implementation status.

## Shared project context

- If `docs/project-context.md` exists, read it before planning or implementing project tasks. It is a local, untracked file with project status, the current next step, decisions, and handoff notes.
- Follow the current user request. The context and backlog do not authorize starting additional work or creating commits.
- Distinguish user-reported results, locally verified behavior, and planned features. Helper classes and unit tests do not prove broker integration.
- If the local context file exists and an authorized task changes project status, update it with evidence and an incremented revision. Do not claim another agent or an external dashboard has received an update without confirmation.

## Development principles

- Prefer the simplest correct solution.
- Follow existing project conventions.
- Avoid speculative abstractions, unnecessary generics, and premature optimization.
- Do not introduce dependencies unless explicitly requested.
- Keep changes small, focused, and easy to review.
- Preserve public APIs and existing behavior during refactoring unless instructed otherwise.

## MQTT correctness

- Do not invent MQTT protocol rules.
- Distinguish specification requirements from implementation choices.
- When protocol behavior is uncertain, state the uncertainty and request verification against the MQTT 3.1.1 specification.
- Do not silently change protocol behavior during refactoring.

## Tests

- Use the existing Vitest conventions.
- Prefer focused tests covering observable behavior and edge cases.
- After committing a verified GREEN increment, immediately explain the next focused increment, add its basic tests, and verify the expected RED result. Leave those tests out of the completed commit and leave production implementation to the user unless explicitly requested.
- Do not change tests merely to make failing code pass.
- Run relevant tests and type checking after changes when possible.
- Report what was actually executed and what was not verified.

## Agent behavior

- Respond in Polish. Keep code and identifiers in English.
- For analysis-only requests, do not modify files.
- Before making substantial changes, briefly explain the intended approach.
- Modify only files relevant to the requested task.
- Do not perform unrelated cleanup.
- Before running `git add`, format only the files you intend to stage with Prettier (`prettier --write <files>`), preserving CRLF. Review the resulting diff before staging.
- Never create Git commits, push, or rewrite history without explicit permission.
- If a task requires a design decision beyond the requested scope, ask before proceeding.
- Keep responses concise and avoid unnecessary explanations.

## MQTT specification — mandatory source of truth

The official MQTT 3.1.1 specification with errata is stored locally in `docs/mqtt/` (relative to the repository root):

- HTML: `docs/mqtt/mqtt-v3.1.1-plus-errata01.html` (primary source for reading and searching).
- PDF: `docs/mqtt/mqtt-v3.1.1-plus-errata01.pdf`.

**This documentation is the authoritative source for all MQTT protocol behavior. Do not rely on model memory or general MQTT knowledge when answering protocol-related questions.**

### Mandatory workflow

For every task involving MQTT protocol semantics, implementation, validation, or tests:

1. **Read the relevant sections of `docs/mqtt/mqtt-v3.1.1-plus-errata01.html` before answering or modifying code.** Do this even if the behavior seems obvious or familiar.
2. Locate the exact sections defining the behavior, including applicable exceptions and edge cases.
3. Base all protocol-related conclusions, implementation decisions, and test expectations on those sections.
4. Reference the relevant section numbers and normative requirement identifiers (e.g. `[MQTT-4.7.1-1]`) when available.
5. Clearly distinguish normative requirements (`MUST`, `MUST NOT`, `SHOULD`, `MAY`) from implementation choices.
6. If the documentation is ambiguous or incomplete, explicitly state the uncertainty. Do not invent rules or fill gaps from memory.
7. If the relevant documentation cannot be accessed or read, report this and do not claim that the behavior is specification-compliant.

### Verification rules

- Never use model memory as a substitute for reading the specification.
- Never fabricate specification references or requirement identifiers.
- Verify both positive and negative test expectations against the specification.
- Check relevant exceptions before declaring an implementation incorrect.
- When reviewing code, distinguish confirmed specification violations from potential issues and optional improvements.
- Do not silently change existing behavior based on assumptions about MQTT.

### Scope

The current implementation targets MQTT 3.1.1 (protocol level 4).

Use the MQTT 3.1.1 specification for all current implementation and testing tasks. Do not apply MQTT 5.0 requirements unless explicitly requested.

**Protocol correctness takes precedence over model confidence.**
