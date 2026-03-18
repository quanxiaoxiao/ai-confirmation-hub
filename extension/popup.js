const API_BASE = "http://localhost:47321";

const statusDot = document.getElementById("statusDot");
const errorBanner = document.getElementById("errorBanner");
const eventCountEl = document.getElementById("eventCount");
const eventListEl = document.getElementById("eventList");
const refreshBtn = document.getElementById("refreshBtn");
const paneListEl = document.getElementById("paneList");

// Tab switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab + "Panel").classList.add("active");
    if (btn.dataset.tab === "panes") loadPanes();
  });
});

refreshBtn.addEventListener("click", loadEvents);

loadEvents();

async function loadEvents() {
  try {
    const healthRes = await fetch(`${API_BASE}/health`);
    const health = await healthRes.json();
    statusDot.className = "status-dot " + (health.ok ? "ok" : "err");
    errorBanner.style.display = "none";
  } catch {
    statusDot.className = "status-dot err";
    errorBanner.textContent = "Cannot connect to server at localhost:47321. Is the backend running?";
    errorBanner.style.display = "block";
    eventCountEl.textContent = "Server offline";
    eventListEl.innerHTML = renderEmpty("Server unreachable", "Start the backend with: node dist/src/cli/index.js");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/events?status=pending`);
    const data = await res.json();
    const events = data.events || [];

    eventCountEl.textContent = events.length === 0
      ? "No pending confirmations"
      : `${events.length} pending`;

    if (events.length === 0) {
      eventListEl.innerHTML = renderEmpty("All clear", "No AI tools waiting for confirmation");
      return;
    }

    eventListEl.innerHTML = events.map(renderEventCard).join("");
    attachActions();
  } catch (err) {
    eventListEl.innerHTML = renderEmpty("Error", err.message);
  }
}

function renderEmpty(title, subtitle) {
  return `<div class="empty"><span class="emoji">${title === "All clear" ? "✅" : "⚠️"}</span>${title}<br><small>${subtitle}</small></div>`;
}

function renderEventCard(evt) {
  const ago = timeAgo(evt.firstSeenAt);
  return `
    <div class="event-card" data-id="${evt.id}">
      <div class="event-top">
        <span class="tool-badge ${evt.tool}">${evt.tool}</span>
        <span class="risk-badge ${evt.risk}">${evt.risk}</span>
        <span class="event-kind">${evt.kind.replace(/_/g, " ")}</span>
      </div>
      <div class="event-summary">${escapeHtml(evt.summary)}</div>
      <div class="event-source">
        tmux ${evt.source.session}:${evt.source.window}.${evt.source.pane}
        &nbsp;·&nbsp; ${ago}
      </div>
      <div class="event-actions">
        <button class="focus-btn" data-action="focus" data-id="${evt.id}">Focus</button>
        <button class="resolve-btn" data-action="resolve" data-id="${evt.id}">Resolve</button>
        <button data-action="ack" data-id="${evt.id}">Ack</button>
        <button data-action="snooze" data-id="${evt.id}">Snooze 5m</button>
        <button data-action="ignore" data-id="${evt.id}">Ignore</button>
      </div>
    </div>`;
}

function attachActions() {
  document.querySelectorAll(".event-actions button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      let body = undefined;
      if (action === "snooze") {
        const until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        body = JSON.stringify({ until });
      }
      try {
        await fetch(`${API_BASE}/events/${id}/${action}`, {
          method: "POST",
          headers: body ? { "content-type": "application/json" } : undefined,
          body,
        });
        loadEvents();
      } catch (err) {
        console.error("Action failed:", err);
      }
    });
  });
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

async function loadPanes() {
  try {
    const res = await fetch(`${API_BASE}/panes`);
    const data = await res.json();
    const panes = data.panes || [];

    if (panes.length === 0) {
      paneListEl.innerHTML = renderEmpty("No AI panes", "No tmux panes running AI tools detected");
      return;
    }

    const byTool = {};
    for (const p of panes) {
      (byTool[p.tool] = byTool[p.tool] || []).push(p);
    }

    const toolOrder = ["claude", "codex", "opencode"];
    let html = `<div class="pane-summary">${panes.length} AI pane${panes.length > 1 ? "s" : ""} active</div>`;

    for (const tool of toolOrder) {
      const group = byTool[tool];
      if (!group) continue;
      for (const p of group) {
        const winLabel = p.windowName ? ` (${escapeHtml(p.windowName)})` : "";
        html += `
          <div class="pane-card">
            <span class="tool-badge ${p.tool}">${p.tool}</span>
            <div class="pane-info">
              <div class="pane-target">${escapeHtml(p.session)}:${escapeHtml(p.window)}.${escapeHtml(p.pane)}</div>
              <div class="pane-window-name">${escapeHtml(p.session)} / window ${escapeHtml(p.window)}${winLabel}</div>
            </div>
          </div>`;
      }
    }

    paneListEl.innerHTML = html;
  } catch {
    paneListEl.innerHTML = renderEmpty("Error", "Could not load panes. Is tmux running?");
  }
}
