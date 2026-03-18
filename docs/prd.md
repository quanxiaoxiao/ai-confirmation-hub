# Product Requirements Document

## Purpose

AI Confirmation Hub is a local-first confirmation monitoring system for terminal-heavy AI workflows. It detects blocked confirmation states across tmux panes and exposes them as structured events for notification and user action.

## Target Workflow

- tmux
- multiple panes and windows
- concurrent Codex / Claude / Opencode sessions
- browser extension or local dashboard as the notification surface

## Primary Problem

Multiple AI tools pause and wait for user confirmation, but those confirmations are distributed across terminal panes and easy to miss. This creates idle waiting, context switching, and workflow drag.

## Product Goal

Build a system that:

- detects likely pending confirmations
- aggregates them into one place
- notifies the user
- helps the user jump to the blocked pane
- preserves manual decision-making

## Non-Goals

- blind auto-confirmation
- cloud-first architecture
- hard dependency on one agent
- terminal replacement

## MVP

- tmux watcher
- rule-based detection
- event normalization
- local store
- local API
- browser notification integration later

## Core Principles

- safe by default
- local-first
- tool-agnostic
- deterministic
- explainable
- testable

## Acceptance Criteria

1. can scan tmux panes
2. can detect basic confirmation prompts
3. can normalize them into events
4. can persist active state locally
5. can expose events through HTTP API
6. can support browser-facing consumers
7. can distinguish at least basic risk levels
8. includes regression fixtures and tests
