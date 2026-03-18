# Product Requirements Document

## Purpose

AI Confirmation Hub is a local-first confirmation monitoring system for terminal-heavy AI workflows. It detects blocked confirmation states across tmux panes and exposes them as structured events for notification and user action.

## Target Workflow

- tmux with multiple panes and windows
- concurrent Codex / Claude / Opencode sessions
- Chrome extension as the notification and action surface

## Primary Problem

Multiple AI tools pause and wait for user confirmation, but those confirmations are distributed across terminal panes and easy to miss. This creates idle waiting, context switching, and workflow drag.

## Product Goal

Build a system that:

- detects likely pending confirmations
- aggregates them into one place
- notifies the user through browser notifications
- helps the user jump to the blocked pane (Focus)
- preserves manual decision-making (no auto-confirm)

## Non-Goals

- blind auto-confirmation
- sending keystrokes to the terminal
- cloud-first architecture
- hard dependency on one agent
- terminal replacement

## MVP Features

- tmux watcher with periodic scanning
- rule-based confirmation detection
- event normalization with tool, risk, evidence
- local JSON-backed event store
- local HTTP API
- Chrome extension with badge, notifications, popup
- Focus action to jump to the blocked tmux pane
- Event lifecycle: Ack / Snooze / Ignore / Resolve

## Core Principles

- safe by default — Focus switches the view, never sends input
- local-first — no cloud dependencies
- tool-agnostic — works with any AI tool in tmux
- deterministic — rule-based detection
- explainable — events include evidence lines
- testable — fixture-driven tests

## Acceptance Criteria

1. can scan tmux panes on a configurable interval
2. can detect basic confirmation prompts from Codex, Claude, Opencode
3. can normalize them into events with tool, risk, kind, evidence
4. can persist active state locally
5. can expose events through HTTP API with filtering
6. Chrome extension shows pending events with badge and notifications
7. Focus button switches tmux to the blocked pane
8. can distinguish risk levels (low, medium, high, critical)
9. includes regression fixtures and tests for detection
