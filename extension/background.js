const API_BASE = "http://localhost:47321";
const POLL_INTERVAL_SEC = 3;

let lastPendingIds = new Set();

chrome.alarms.create("poll-events", { periodInMinutes: POLL_INTERVAL_SEC / 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "poll-events") return;
  await pollEvents();
});

// Also poll immediately on startup
pollEvents();

async function pollEvents() {
  try {
    const res = await fetch(`${API_BASE}/events?status=pending`);
    if (!res.ok) {
      updateBadge("!", "#888");
      return;
    }
    const data = await res.json();
    const events = data.events || [];
    const count = events.length;

    // Update badge
    if (count > 0) {
      updateBadge(String(count), riskColor(events));
    } else {
      updateBadge("", "#4CAF50");
    }

    // Notify for new pending events
    const currentIds = new Set(events.map((e) => e.id));
    for (const evt of events) {
      if (!lastPendingIds.has(evt.id)) {
        chrome.notifications.create(evt.id, {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: `⏳ ${evt.tool} - ${evt.kind.replace(/_/g, " ")}`,
          message: evt.summary,
          priority: evt.risk === "high" || evt.risk === "critical" ? 2 : 1,
        });
      }
    }
    lastPendingIds = currentIds;

    // Store for popup
    chrome.storage.local.set({ events, lastPoll: new Date().toISOString() });
  } catch {
    updateBadge("?", "#999");
    chrome.storage.local.set({ events: null, lastPoll: new Date().toISOString(), error: "Server unreachable" });
  }
}

function riskColor(events) {
  const hasHigh = events.some((e) => e.risk === "high" || e.risk === "critical");
  return hasHigh ? "#F44336" : "#FF9800";
}

function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}
