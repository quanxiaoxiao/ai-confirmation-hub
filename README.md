# AI Confirmation Hub

Local-first confirmation monitoring system for terminal-heavy AI workflows.

Designed for users who run multiple AI coding tools concurrently in `tmux` (Codex, Claude, Opencode). These tools often pause and wait for user confirmation across scattered panes. This project detects those pending confirmations, aggregates them into structured events, and surfaces them through a Chrome extension.

## Quick Start

### Prerequisites

- Node.js >= 20
- tmux (running with at least one session)
- Chrome browser

### Install & Build

```bash
npm install
npm run build
```

### Start the Backend

```bash
node dist/src/cli/index.js
```

The server starts on `http://localhost:47321` and the tmux watcher begins scanning every 2 seconds.

Verify it's working:

```bash
curl http://localhost:47321/health
```

### Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` directory from this repository
5. The extension icon appears in the toolbar — click it to see pending confirmations

### Run Tests

```bash
npm run build
npm test
```

## How It Works

1. **Watcher** periodically captures text from all tmux panes
2. **Rule engine** matches captured text against detection rules (`config/default-rules.json`)
3. Matched text is normalized into **confirmation events** with tool, risk level, and evidence
4. Events are persisted to a local JSON file (`state/active-events.json`)
5. **HTTP API** serves events to the Chrome extension
6. Extension shows a badge count, desktop notifications, and a popup panel with actions (Resolve / Ack / Snooze / Ignore)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health with watcher status |
| GET | `/events` | List events (filters: `?status=`, `?tool=`, `?project=`) |
| GET | `/events/:id` | Get single event |
| POST | `/events/:id/ack` | Acknowledge event |
| POST | `/events/:id/snooze` | Snooze event (body: `{"until": "ISO timestamp"}`) |
| POST | `/events/:id/ignore` | Ignore event |
| POST | `/events/:id/resolve` | Resolve event |

## Repository Layout

```text
config/       default config and detection rules
docs/         product and technical design documents
extension/    Chrome extension (manifest v3)
src/
  core/       shared types, event lifecycle, fingerprinting, rule engine
  watcher/    tmux capture, detection pipeline, scan loop
  server/     JSON file store, HTTP routes, server
  cli/        entry point
tests/        unit tests and fixture-based detection tests
```

## Configuration

Edit `config/default-config.json`:

| Key | Default | Description |
|-----|---------|-------------|
| `scanIntervalMs` | 2000 | How often to scan tmux panes (ms) |
| `captureLines` | 100 | Lines to capture per pane |
| `tmux.enabled` | true | Enable/disable tmux watcher |
| `store.stateDir` | `./state` | Where to persist event data |

Detection rules live in `config/default-rules.json`. Each rule has `match` conditions (`all`/`any` with `contains`) and an `extract` block (`kind`, `risk`, `summary`).

## Development

```bash
npm run check    # type-check without emitting
npm run build    # compile TypeScript to dist/
npm test         # run all tests
npm run dev      # start with --watch (rebuild manually)
```

## Design Principles

- Safe by default — no auto-confirm of risky actions
- Local-first — no cloud dependencies
- Tool-agnostic — works with any AI tool in tmux
- Deterministic — rule-based detection, explainable outputs
- Testable — fixture-driven tests for every detection pattern
