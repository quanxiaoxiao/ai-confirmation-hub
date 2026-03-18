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

### POST /events/:id/ack
Marks event as acknowledged.

### POST /events/:id/snooze
Snoozes event until a timestamp or duration-derived timestamp.

### POST /events/:id/ignore
Marks event as ignored.

### POST /events/:id/resolve
Marks event as resolved.

## Response Principles

- JSON only
- explicit timestamps
- stable field names
- no hidden lifecycle transitions in read endpoints

## Initial Health Shape

```json
{
  "ok": true,
  "watcher": {
    "ok": true
  },
  "store": {
    "ok": true
  }
}
```
