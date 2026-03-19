# Event lifecycle transitions — ack, snooze, ignore, resolve, invalid

# 1. Create event for ack -> resolve flow
POST {{host}}/events
Content-Type: application/json
{
  "id": "hurl_lc_ack_{{rid}}",
  "tool": "opencode",
  "source": { "kind": "tmux", "session": "test", "window": "0", "pane": "0" },
  "kind": "overwrite_file",
  "risk": "high",
  "summary": "Lifecycle ack test"
}
HTTP 201

# 2. Acknowledge the event
POST {{host}}/events/hurl_lc_ack_{{rid}}/ack
HTTP 200
[Asserts]
jsonpath "$.event.status" == "acknowledged"
jsonpath "$.event.acknowledgedAt" exists

# 3. Resolve from acknowledged
POST {{host}}/events/hurl_lc_ack_{{rid}}/resolve
HTTP 200
[Asserts]
jsonpath "$.event.status" == "resolved"
jsonpath "$.event.resolvedAt" exists

# 4. Invalid transition — resolve -> ack should fail
POST {{host}}/events/hurl_lc_ack_{{rid}}/ack
HTTP 400
[Asserts]
jsonpath "$.error" == "bad_request"

# 5. Create event for snooze test
POST {{host}}/events
Content-Type: application/json
{
  "id": "hurl_lc_snooze_{{rid}}",
  "tool": "codex",
  "source": { "kind": "tmux", "session": "test", "window": "0", "pane": "1" },
  "kind": "apply_patch",
  "risk": "medium",
  "summary": "Lifecycle snooze test"
}
HTTP 201

# 6. Snooze with until
POST {{host}}/events/hurl_lc_snooze_{{rid}}/snooze
Content-Type: application/json
{
  "until": "2026-12-31T23:59:59.000Z"
}
HTTP 200
[Asserts]
jsonpath "$.event.status" == "snoozed"
jsonpath "$.event.snoozedUntil" == "2026-12-31T23:59:59.000Z"

# 7. Cleanup — resolve snoozed event
POST {{host}}/events/hurl_lc_snooze_{{rid}}/resolve
HTTP 200
[Asserts]
jsonpath "$.event.status" == "resolved"

# 8. Create event for ignore test
POST {{host}}/events
Content-Type: application/json
{
  "id": "hurl_lc_ignore_{{rid}}",
  "tool": "claude",
  "source": { "kind": "tmux", "session": "test", "window": "0", "pane": "2" },
  "kind": "task_complete",
  "risk": "low",
  "summary": "Lifecycle ignore test"
}
HTTP 201

# 9. Ignore the event
POST {{host}}/events/hurl_lc_ignore_{{rid}}/ignore
HTTP 200
[Asserts]
jsonpath "$.event.status" == "ignored"

# 10. Action on non-existent event returns 404
POST {{host}}/events/hurl_nonexistent/ack
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"
