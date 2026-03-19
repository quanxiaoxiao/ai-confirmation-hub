# Create event — happy path and validation

# 1. Create a valid event and verify response
POST {{host}}/events
Content-Type: application/json
{
  "id": "hurl_create_{{rid}}",
  "tool": "codex",
  "source": { "kind": "tmux", "session": "test", "window": "0", "pane": "0" },
  "kind": "apply_patch",
  "risk": "medium",
  "summary": "Hurl test event"
}
HTTP 201
[Asserts]
jsonpath "$.event.id" == "hurl_create_{{rid}}"
jsonpath "$.event.status" == "pending"
jsonpath "$.event.tool" == "codex"
jsonpath "$.event.kind" == "apply_patch"
jsonpath "$.event.risk" == "medium"
jsonpath "$.event.summary" == "Hurl test event"
jsonpath "$.event.fingerprint" exists
jsonpath "$.event.firstSeenAt" exists
jsonpath "$.event.lastSeenAt" exists

# 2. Verify it can be fetched by id
GET {{host}}/events/hurl_create_{{rid}}
HTTP 200
[Asserts]
jsonpath "$.event.id" == "hurl_create_{{rid}}"

# 3. Cleanup — resolve the created event
POST {{host}}/events/hurl_create_{{rid}}/resolve
HTTP 200
[Asserts]
jsonpath "$.event.status" == "resolved"

# 4. Missing required fields returns 400
POST {{host}}/events
Content-Type: application/json
{
  "id": "incomplete"
}
HTTP 400
[Asserts]
jsonpath "$.error" == "bad_request"

# 5. Invalid JSON body returns 400
POST {{host}}/events
Content-Type: application/json
```
not json
```
HTTP 400
[Asserts]
jsonpath "$.error" == "bad_request"
