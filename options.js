const STORAGE_KEY = "blockedVenues";
const listNode = document.getElementById("blocked-list");
const searchNode = document.getElementById("search");
const emptyNode = document.getElementById("empty-state");
const clearAllButton = document.getElementById("clear-all");

let blockedVenues = {};
let searchTerm = "";

init().catch((error) => {
  console.error("Options init failed", error);
});

async function init() {
  blockedVenues = await loadBlockedVenues();
  render();

  searchNode.addEventListener("input", () => {
    searchTerm = searchNode.value.trim().toLowerCase();
    render();
  });

  clearAllButton.addEventListener("click", async () => {
    blockedVenues = {};
    await saveBlockedVenues();
    render();
  });
}

function render() {
  const items = Object.values(blockedVenues)
    .sort((left, right) => (right.blockedAt || "").localeCompare(left.blockedAt || ""))
    .filter((item) => {
      if (!searchTerm) {
        return true;
      }
      return `${item.name} ${item.pathname} ${item.type}`.toLowerCase().includes(searchTerm);
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
    const label = item.type === "restaurant" ? "Restaurant" : "Shop";
    subtitle.textContent = `${label} • ${item.pathname}`;

    meta.append(title, subtitle);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Unblock";
    button.addEventListener("click", async () => {
      delete blockedVenues[item.key];
      await saveBlockedVenues();
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
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

async function saveBlockedVenues() {
  await chrome.storage.sync.set({
    [STORAGE_KEY]: blockedVenues
  });
}
