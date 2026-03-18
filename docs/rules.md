# Rule System

## Purpose

Rules detect likely confirmation states from pane text.

## MVP Rule Style

Rules are declarative and text-pattern-based.

Each rule contains:

- `id`
- `enabled`
- `match`
- `extract`

## Matching

MVP match operators:

- `all`
- `any`

Each condition initially supports:

- `contains`

Later expansion may include:

- regex
- line proximity
- negation
- tool-specific gating

## Extract

A matched rule emits:

- `kind`
- `risk`
- `summary`

## Rule Principles

- deterministic
- auditable
- simple to test
- conservative when ambiguous

## Ambiguity Handling

If the system cannot confidently classify the prompt, it should emit `unknown_confirmation` rather than pretending certainty.
