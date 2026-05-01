const STORAGE_KEY = "blockedVenues";
const MESSAGE_TYPE = "DELIVERY_HIDER_GET_PAGE_STATE";
const statusNode = document.getElementById("status");
const toggleButton = document.getElementById("toggle-current");
const countNode = document.getElementById("blocked-count");
const optionsButton = document.getElementById("open-options");

let currentVenue = null;
let blockedVenues = {};

init().catch((error) => {
  console.error("Popup init failed", error);
  statusNode.textContent = "Something went wrong while loading this tab.";
});

async function init() {
  blockedVenues = await loadBlockedVenues();
  renderCount();
  await loadCurrentTabState();

  toggleButton.addEventListener("click", onToggleCurrent);
  optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
}

async function loadCurrentTabState() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) {
    statusNode.textContent = "No active tab detected.";
    return;
  }

  let pageState = null;
  try {
    pageState = await chrome.tabs.sendMessage(tab.id, {
      type: MESSAGE_TYPE
    });
  } catch (_error) {
    pageState = null;
  }

  if (!pageState?.isSupported) {
    statusNode.textContent = "Open Wolt, Foody, or Bolt Food in this tab to hide a place directly.";
    toggleButton.textContent = "Open a supported place page";
    toggleButton.disabled = true;
    return;
  }

  currentVenue = pageState.venue;
  if (!currentVenue) {
    statusNode.textContent = `Open a specific ${pageState.platform?.label || "supported"} place page to hide it from the popup.`;
    toggleButton.textContent = "Open a place page";
    toggleButton.disabled = true;
    return;
  }

  const blocked = Boolean(pageState.isBlocked);
  statusNode.textContent = blocked
    ? `${currentVenue.name} is currently hidden on ${pageState.platform?.label || "this platform"}.`
    : `${currentVenue.name} is visible on ${pageState.platform?.label || "this platform"}.`;
  toggleButton.textContent = blocked ? "Unhide this place" : "Hide this place";
  toggleButton.disabled = false;
}

async function onToggleCurrent() {
  if (!currentVenue) {
    return;
  }

  if (blockedVenues[currentVenue.key]) {
    delete blockedVenues[currentVenue.key];
  } else {
    blockedVenues[currentVenue.key] = {
      ...currentVenue,
      blockedAt: new Date().toISOString()
    };
  }

  await chrome.storage.sync.set({
    [STORAGE_KEY]: blockedVenues
  });
  renderCount();
  await loadCurrentTabState();
}

function renderCount() {
  countNode.textContent = String(Object.keys(blockedVenues).length);
}

async function loadBlockedVenues() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}
