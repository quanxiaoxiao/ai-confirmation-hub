# Architecture

## Overview

AI Confirmation Hub has four runtime components:

1. watcher — scans tmux panes for confirmation prompts
2. event/store server — persists events and serves the local API
3. Chrome extension — browser-facing notification and action surface
4. tmux focus — jumps the user to the blocked pane on demand

## Component Boundaries

### Core
Shared types and pure logic.

Responsibilities:
- event types and lifecycle transitions
- rule types
- rule evaluation
- fingerprinting
- normalization helpers

### Watcher
tmux-specific observation and detection pipeline.

Responsibilities:
- enumerate panes
- capture recent text
- infer tool/project where possible
- apply detection rules
- emit candidate events
- focus (switch to) a specific pane on request

### Server
Persistence and local API.

Responsibilities:
- track active events
- deduplicate by fingerprint
- apply lifecycle transitions (ack, snooze, ignore, resolve)
- dispatch focus requests to tmux
- serve event data over localhost

### Chrome Extension
Browser-facing notification and control surface.

Responsibilities:
- poll the local API for pending events
- display badge count and desktop notifications
- show event list with tool, risk, source, summary, evidence
- provide action buttons: Focus, Resolve, Ack, Snooze, Ignore

## Data Flow

1. watcher captures pane text every `scanIntervalMs`
2. watcher runs detection rules against captured text
3. watcher emits normalized candidate events
4. server merges and persists events (dedup by fingerprint)
5. Chrome extension polls `GET /events?status=pending`
6. user sees pending confirmations in the popup
7. user clicks **Focus** → server calls `tmux select-pane` → terminal switches to the blocked pane
8. user confirms in the terminal, then clicks **Resolve** in the extension
9. other actions (Ack, Snooze, Ignore) update event metadata only

## Safety Boundary

The system never sends input to a tmux pane. Focus only switches the view. The user always makes the final decision in the terminal.

## Design Decisions

- rule-based detection only (no ML/heuristics in MVP)
- file-backed JSON persistence
- localhost HTTP API with CORS for browser extension
- conservative risk classification
- no unsafe auto-confirm
