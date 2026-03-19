# Query events — list, filter, not-found

# 1. Create setup data
POST {{host}}/events
Content-Type: application/json
{
  "id": "hurl_query_codex_{{rid}}",
  "tool": "codex",
  "source": { "kind": "tmux", "session": "test", "window": "0", "pane": "0" },
  "kind": "run_command",
  "risk": "high",
  "summary": "Query test codex"
}
HTTP 201

POST {{host}}/events
Content-Type: application/json
{
  "id": "hurl_query_claude_{{rid}}",
  "tool": "claude",
  "source": { "kind": "tmux", "session": "test", "window": "1", "pane": "0" },
  "kind": "permission_request",
  "risk": "low",
  "summary": "Query test claude"
}
HTTP 201

# 2. Verify retrievable by id
GET {{host}}/events/hurl_query_codex_{{rid}}
HTTP 200
[Asserts]
jsonpath "$.event.id" == "hurl_query_codex_{{rid}}"

# 3. List all events — should contain at least our 2
GET {{host}}/events
HTTP 200
[Asserts]
jsonpath "$.events" count >= 2

# 4. Filter by tool
GET {{host}}/events?tool=codex
HTTP 200
[Asserts]
jsonpath "$.events" count >= 1
jsonpath "$.events[0].tool" == "codex"

GET {{host}}/events?tool=claude
HTTP 200
[Asserts]
jsonpath "$.events" count >= 1
jsonpath "$.events[0].tool" == "claude"

# 5. Not-found for unknown event id
GET {{host}}/events/hurl_nonexistent_event
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 6. Unknown path returns 404
GET {{host}}/unknown_path
HTTP 404

# 7. Cleanup
POST {{host}}/events/hurl_query_codex_{{rid}}/resolve
HTTP 200

POST {{host}}/events/hurl_query_claude_{{rid}}/resolve
HTTP 200
