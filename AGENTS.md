# AGENTS.md

## Purpose

This repository is for a local-first confirmation monitoring system focused on terminal AI workflows.

Agents working in this repository must preserve the following priorities:

1. safety
2. observability
3. deterministic behavior
4. testability
5. local-first operation
6. low coupling between components

## Repository Truth

The main product and architecture truth lives in:

- `docs/prd.md`
- `docs/architecture.md`
- `docs/api.md`
- `docs/rules.md`
- `docs/testing.md`

Implementation must align with those docs unless intentionally revised.

## Working Style

- Prefer small focused changes
- Keep modules narrow and explicit
- Avoid hidden global state
- Prefer pure functions in core detection logic
- Separate watcher, detection, store, and API concerns
- Avoid premature optimization
- Add regression fixtures for every new detection pattern or false positive

## Safety Rules

Do not implement unsafe auto-confirm behavior by default.

In MVP, the system must not blindly auto-confirm:

- destructive actions
- delete operations
- force push
- privileged execution
- unclear shell execution
- broad overwrite operations

## Testing Requirements

Any change to detection or event lifecycle must include tests.

Minimum expectations:

- unit coverage for core rule matching
- fixture-based tests for detection behavior
- regression tests for false positives and missed confirmations

## Documentation Discipline

When behavior changes, update the relevant docs in `docs/`.

Do not let implementation drift silently away from design.

## Architectural Boundaries

- `src/core` contains shared types and pure logic
- `src/watcher` contains tmux-specific observation and detection integration
- `src/server` contains storage and HTTP API
- browser extension code should remain external or isolated later

Keep these boundaries clear.
