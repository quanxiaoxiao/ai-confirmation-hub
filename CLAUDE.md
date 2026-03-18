# CLAUDE.md

## Mission

Implement AI Confirmation Hub as a local-first, testable, safe-by-default system that detects blocked AI-agent confirmations across tmux panes and surfaces them through a local API for browser-facing notification flows.

## Constraints

- TypeScript
- Prefer standard library and platform APIs
- Avoid unnecessary third-party dependencies
- Functional-leaning code style
- Every core behavior must be testable
- Rule-based detection for MVP
- No risky auto-confirm flows in MVP

## Build Order

Implement in this order unless strong evidence requires adjustment:

1. shared types
2. event normalization and lifecycle helpers
3. rule engine
4. fixture-driven detection tests
5. tmux watcher integration
6. file-backed event store
7. local HTTP API
8. extension integration surface

## What Good Looks Like

- clear type definitions
- pure detection functions
- explicit event lifecycle transitions
- readable JSON config and rules
- strong fixtures
- explainable outputs with evidence lines
- no over-engineered abstractions

## What To Avoid

- deep framework adoption
- speculative plugin systems
- premature browser extension implementation before local API is stable
- hidden state and implicit side effects
- mixing tmux-specific logic into the generic core model

## Required Outputs

At a minimum, produce:

- stable types under `src/core`
- default rule loader
- rule evaluator
- detection pipeline over plain text input
- tmux capture integration
- event store with persistence
- HTTP routes for listing and updating events
- tests for both positive and negative detection cases
