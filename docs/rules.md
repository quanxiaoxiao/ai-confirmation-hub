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

## Event Kinds

Rules classify detected events into the following kinds:

| Kind | Description | Typical Risk |
|------|-------------|--------------|
| `apply_patch` | Waiting for confirmation to apply code changes | medium |
| `overwrite_file` | Waiting for confirmation to overwrite an existing file | high |
| `run_command` | Waiting for confirmation to execute a shell command | high |
| `permission_request` | Waiting for permission or access approval | medium |
| `task_complete` | AI agent task has finished — informational notification | low |
| `network_access` | Waiting for network access confirmation | medium |
| `interactive_prompt` | Generic interactive prompt | low |
| `menu_selection` | Waiting for menu choice | low |
| `warning_continue` | Warning requiring acknowledgement to continue | medium |
| `unknown_confirmation` | Could not confidently classify the prompt | low |

The `task_complete` kind is not a confirmation requiring user action — it is an informational event that notifies the user an AI agent has finished its work. This allows the user to review results promptly.

## Ambiguity Handling

If the system cannot confidently classify the prompt, it should emit `unknown_confirmation` rather than pretending certainty.
