const STORAGE_KEY = "blockedVenues";
const STATS_KEY = "localStats";
const TELEMETRY_SETTINGS_KEY = "telemetrySettings";
const TELEMETRY_QUEUE_KEY = "telemetryQueue";
const listNode = document.getElementById("blocked-list");
const topBlockedListNode = document.getElementById("top-blocked-list");
const searchNode = document.getElementById("search");
const emptyNode = document.getElementById("empty-state");
const clearAllButton = document.getElementById("clear-all");
const telemetryEnabledNode = document.getElementById("telemetry-enabled");
const resetTelemetryButton = document.getElementById("reset-telemetry");
const telemetryQueueCountNode = document.getElementById("telemetry-queue-count");
const telemetryStatusNode = document.getElementById("telemetry-status");
const telemetryPreviewNode = document.getElementById("telemetry-preview-json");

let blockedVenues = {};
let localStats = {};
let telemetrySettings = {};
let telemetryQueue = [];
let searchTerm = "";

init().catch((error) => {
  console.error("Options init failed", error);
});

async function init() {
  blockedVenues = await loadBlockedVenues();
  localStats = await loadObject(STATS_KEY);
  telemetrySettings = await loadObject(TELEMETRY_SETTINGS_KEY);
  telemetryQueue = await loadArray(TELEMETRY_QUEUE_KEY);
  render();

  searchNode.addEventListener("input", () => {
    searchTerm = searchNode.value.trim().toLowerCase();
    render();
  });

  clearAllButton.addEventListener("click", async () => {
    blockedVenues = {};
    await saveState();
    render();
  });

  telemetryEnabledNode.addEventListener("change", async () => {
    telemetrySettings = {
      ...telemetrySettings,
      enabled: telemetryEnabledNode.checked,
      consentedAt: telemetryEnabledNode.checked
        ? telemetrySettings.consentedAt || new Date().toISOString()
        : null
    };
    await saveState();
    renderTelemetry();
  });

  resetTelemetryButton.addEventListener("click", async () => {
    telemetryQueue = [];
    await saveState();
    renderTelemetry();
  });
}

function render() {
  renderTelemetry();
  renderTopBlocked();

  const items = Object.values(blockedVenues)
    .sort((left, right) => (right.blockedAt || "").localeCompare(left.blockedAt || ""))
    .filter((item) => {
      if (!searchTerm) {
        return true;
      }
      return `${item.name} ${item.pathname} ${item.type} ${item.platformLabel || item.platform || ""}`.toLowerCase().includes(searchTerm);
    });

  listNode.replaceChildren();

  for (const item of items) {
    const entry = document.createElement("li");
    entry.className = "item";

    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("strong");
    title.textContent = item.name;

    const subtitle = document.createElement("span");
    const label = getTypeLabel(item.type);
    subtitle.textContent = `${item.platformLabel || humanizePlatform(item.platform)} • ${label} • ${item.pathname}`;

    meta.append(title, subtitle);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Unhide";
    button.addEventListener("click", async () => {
      localStats = updateLocalStats(localStats, item, "unblock");
      delete blockedVenues[item.key];
      await saveState();
      render();
    });

    entry.append(meta, button);
    listNode.appendChild(entry);
  }

  const hasAnyBlocked = Object.keys(blockedVenues).length > 0;
  emptyNode.hidden = hasAnyBlocked && items.length > 0;
  emptyNode.textContent = hasAnyBlocked
    ? "No blocked places match that search."
    : "You have not blocked anything yet.";
}

async function loadBlockedVenues() {
  return loadObject(STORAGE_KEY);
}

async function loadObject(key) {
  const result = await chrome.storage.sync.get(key);
  return result[key] || {};
}

async function loadArray(key) {
  const result = await chrome.storage.sync.get(key);
  return result[key] || [];
}

async function saveState() {
  await chrome.storage.sync.set({
    [STORAGE_KEY]: blockedVenues,
    [STATS_KEY]: localStats,
    [TELEMETRY_SETTINGS_KEY]: telemetrySettings,
    [TELEMETRY_QUEUE_KEY]: telemetryQueue
  });
}

function renderTelemetry() {
  const enabled = Boolean(telemetrySettings.enabled);
  telemetryEnabledNode.checked = enabled;
  telemetryQueueCountNode.textContent = `${telemetryQueue.length} queued event${telemetryQueue.length === 1 ? "" : "s"}`;
  telemetryStatusNode.textContent = enabled
    ? "Opt-in is enabled. Events are queued locally only until a backend exists."
    : "Telemetry sending is disabled. No shared events are being prepared.";
  telemetryPreviewNode.textContent = telemetryQueue.length
    ? JSON.stringify(telemetryQueue.slice(-5), null, 2)
    : "[]";
}

function renderTopBlocked() {
  const items = Object.values(localStats)
    .filter((item) => item.blockCount > 0)
    .sort((left, right) => {
      if (right.blockCount !== left.blockCount) {
        return right.blockCount - left.blockCount;
      }
      return (right.lastActionAt || "").localeCompare(left.lastActionAt || "");
    })
    .slice(0, 10);

  topBlockedListNode.replaceChildren();

  for (const item of items) {
    const entry = document.createElement("li");
    entry.className = "item";

    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("strong");
    title.textContent = item.name;

    const subtitle = document.createElement("span");
    subtitle.textContent = `${item.platformLabel || humanizePlatform(item.platform)} • Hidden ${item.blockCount} time${item.blockCount === 1 ? "" : "s"}`;

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item.unblockCount > 0
      ? `Unhidden ${item.unblockCount} time${item.unblockCount === 1 ? "" : "s"}`
      : "Still hidden-friendly";

    meta.append(title, subtitle, pill);
    entry.append(meta);
    topBlockedListNode.appendChild(entry);
  }
}

function getTypeLabel(type) {
  if (type === "restaurant") {
    return "Restaurant";
  }

  if (type === "venue") {
    return "Shop";
  }

  if (type === "store") {
    return "Store";
  }

  return "Place";
}

function humanizePlatform(platform) {
  if (platform === "bolt-food") {
    return "Bolt Food";
  }

  if (platform === "foody") {
    return "Foody";
  }

  return "Wolt";
}

function updateLocalStats(stats, venue, action) {
  const next = { ...stats };
  const existing = next[venue.key] || {
    key: venue.key,
    name: venue.name,
    platform: venue.platform,
    platformLabel: venue.platformLabel,
    type: venue.type,
    pathname: venue.pathname,
    blockCount: 0,
    unblockCount: 0
  };

  existing.name = venue.name;
  existing.platform = venue.platform;
  existing.platformLabel = venue.platformLabel;
  existing.type = venue.type;
  existing.pathname = venue.pathname;
  existing.lastActionAt = new Date().toISOString();

  if (action === "block") {
    existing.blockCount += 1;
  } else {
    existing.unblockCount += 1;
  }

  next[venue.key] = existing;
  return next;
}
