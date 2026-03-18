# Architecture

## Overview

AI Confirmation Hub has three core runtime components in MVP:

1. watcher
2. event/store server
3. browser-facing client later

## Component Boundaries

### Core
Shared types and pure logic.

Responsibilities:
- event types
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
- apply rules
- emit candidate events

### Server
Persistence and local API.

Responsibilities:
- track active events
- deduplicate
- apply lifecycle transitions
- serve event data over localhost

## Data Flow

1. watcher captures pane text
2. watcher runs detection rules
3. watcher emits normalized candidate events
4. server merges and persists events
5. clients read events from local API
6. user actions update event lifecycle state

## Initial Design Decisions

- rule-based detection only for MVP
- file-backed JSON persistence
- localhost HTTP API before browser-specific coupling
- conservative risk classification
- no unsafe auto-confirm
