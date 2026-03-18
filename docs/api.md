# Local API

## Goals

Provide a minimal localhost API for browser-facing clients and local inspection tools.

## Endpoints

### GET /health
Returns service health and degraded conditions.

### GET /events
Returns all events.

Optional query params:
- `status`
- `tool`
- `project`

### GET /events/:id
Returns one event.

### POST /events
Creates a new event (for testing or external injection).

Required body fields: `id`, `tool`, `summary`, `kind`, `risk`, `source`.

### GET /panes
Lists tmux panes currently running AI tools (codex, claude, opencode). For each pane, the system captures recent terminal output and infers which tool is active based on the last occurrence of a known tool keyword.

Optional query params:
- `tool` — filter by tool name (e.g. `?tool=claude`)

Response:

```json
{
  "total": 2,
  "panes": [
    {
      "session": "dev",
      "window": "0",
      "windowName": "editor",
      "pane": "1",
      "tool": "claude"
    }
  ]
}
```

Returns `502` if tmux is not reachable.

### POST /events/:id/focus
Switches the tmux client to the pane associated with the event. This allows the user to jump directly to the blocked terminal pane from the browser extension, without changing the event's lifecycle status.

Returns `502` if tmux is not reachable.

### POST /events/:id/ack
Marks event as acknowledged. This means the user has seen the confirmation but has not yet acted on it in the terminal.

### POST /events/:id/snooze
Snoozes event until a timestamp or duration-derived timestamp.

Optional body: `{"until": "ISO timestamp"}`

### POST /events/:id/ignore
Marks event as ignored.

### POST /events/:id/resolve
Marks event as resolved.

## Action Semantics

| Action | Meaning | Changes tmux? |
|--------|---------|---------------|
| Focus | Jump to the tmux pane so the user can act | Yes (switches pane) |
| Ack | "I've seen this" — acknowledgement only | No |
| Snooze | Hide temporarily, resurface later | No |
| Ignore | Dismiss permanently | No |
| Resolve | Mark as done (user confirmed in terminal) | No |

Focus is the only action that interacts with tmux. All other actions only update event metadata. The system never sends input to the terminal on behalf of the user.

## Response Principles

- JSON only
- explicit timestamps
- stable field names
- no hidden lifecycle transitions in read endpoints

## Health Shape

```json
{
  "ok": true,
  "watcher": {
    "ok": true,
    "running": true,
    "lastScanAt": "2026-03-18T08:00:00.000Z",
    "errorCount": 0
  },
  "store": {
    "ok": true
  }
}
```
