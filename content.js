(function () {
  const STORAGE_KEY = "blockedVenues";
  const STATS_KEY = "localStats";
  const TELEMETRY_SETTINGS_KEY = "telemetrySettings";
  const TELEMETRY_QUEUE_KEY = "telemetryQueue";
  const ROOT_ATTR = "data-delivery-hider-root";
  const BUTTON_ATTR = "data-delivery-hider-button";
  const PAGE_BANNER_ATTR = "data-delivery-hider-page-banner";
  const PAGE_BUTTON_ATTR = "data-delivery-hider-page-button";
  const MESSAGE_TYPE = "DELIVERY_HIDER_GET_PAGE_STATE";
  const processedRoots = new WeakSet();

  const adapters = [
    createWoltAdapter(),
    createFoodyAdapter(),
    createBoltFoodAdapter()
  ];

  let blockedVenues = {};
  let localStats = {};
  let telemetrySettings = {};
  let telemetryQueue = [];
  let scanTimer = null;
  let observer = null;
  let activeAdapter = null;

  init().catch((error) => {
    console.error("Delivery Hider init failed", error);
  });

  async function init() {
    activeAdapter = getActiveAdapter();
    if (!activeAdapter) {
      return;
    }

    blockedVenues = await loadObject(STORAGE_KEY);
    localStats = await loadObject(STATS_KEY);
    telemetrySettings = await loadObject(TELEMETRY_SETTINGS_KEY);
    telemetryQueue = await loadArray(TELEMETRY_QUEUE_KEY);

    injectPageButtonIfNeeded();
    scanPage();

    observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  }

  function handleRuntimeMessage(message, _sender, sendResponse) {
    if (message?.type !== MESSAGE_TYPE) {
      return;
    }

    const adapter = getActiveAdapter();
    const venue = adapter ? adapter.getCurrentVenue() : null;
    sendResponse({
      isSupported: Boolean(adapter),
      platform: adapter ? getPlatformSummary(adapter.id) : null,
      venue,
      isBlocked: venue ? isBlocked(venue.key) : false
    });
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "sync") {
      return;
    }

    if (changes[STORAGE_KEY]) {
      blockedVenues = changes[STORAGE_KEY].newValue || {};
    }

    if (changes[STATS_KEY]) {
      localStats = changes[STATS_KEY].newValue || {};
    }

    if (changes[TELEMETRY_SETTINGS_KEY]) {
      telemetrySettings = changes[TELEMETRY_SETTINGS_KEY].newValue || {};
    }

    if (changes[TELEMETRY_QUEUE_KEY]) {
      telemetryQueue = changes[TELEMETRY_QUEUE_KEY].newValue || [];
    }

    if (activeAdapter) {
      injectPageButtonIfNeeded();
      scanPage();
    }
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      injectPageButtonIfNeeded();
      scanPage();
    }, 120);
  }

  function scanPage() {
    if (!activeAdapter) {
      return;
    }

    const links = activeAdapter.getListingLinks();
    const seenKeys = new Set();

    for (const link of links) {
      const venue = activeAdapter.getVenueFromLink(link);
      if (!venue || seenKeys.has(venue.key)) {
        continue;
      }

      seenKeys.add(venue.key);
      const roots = findVenueRoots(venue, link);
      for (const root of roots) {
        decorateVenueRoot(root, venue);
      }
    }

    applyPageLevelBlocking();
  }

  function findVenueRoots(venue, sourceLink) {
    const links = activeAdapter.findMatchingLinks(venue);
    const roots = new Set();

    for (const link of links) {
      const root = findCardRoot(link, venue);
      if (root) {
        roots.add(root);
      }
    }

    if (!roots.size) {
      const fallbackRoot = findCardRoot(sourceLink, venue);
      if (fallbackRoot) {
        roots.add(fallbackRoot);
      }
    }

    return Array.from(roots);
  }

  function findCardRoot(link, venue) {
    let current = link;
    let best = link;

    while (current && current !== document.body) {
      if (current instanceof HTMLElement) {
        const rect = current.getBoundingClientRect();
        const area = rect.width * rect.height;
        const venueLinks = getVenueLinksWithin(current);
        const uniqueKeys = new Set(venueLinks.map((item) => item.key));

        if (area > 18000 && uniqueKeys.size <= 1 && uniqueKeys.has(venue.key)) {
          best = current;
        }

        if (uniqueKeys.size > 1) {
          break;
        }
      }

      current = current.parentElement;
    }

    return best instanceof HTMLElement ? best : null;
  }

  function getVenueLinksWithin(node) {
    return activeAdapter.getLinksWithin(node)
      .map((link) => activeAdapter.getVenueFromLink(link))
      .filter(Boolean);
  }

  function decorateVenueRoot(root, venue) {
    root.setAttribute(ROOT_ATTR, "true");
    root.dataset.deliveryHiderKey = venue.key;
    const buttonMount = getButtonMount(root);

    if (!processedRoots.has(buttonMount)) {
      if (getComputedStyle(buttonMount).position === "static") {
        buttonMount.style.position = "relative";
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "wolt-blocker-hide-button";
      button.setAttribute(BUTTON_ATTR, "true");
      button.textContent = "Hide";
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await blockVenue(venue);
      });

      buttonMount.appendChild(button);
      processedRoots.add(buttonMount);
    }

    root.setAttribute("data-wolt-blocker-hidden", isBlocked(venue.key) ? "true" : "false");
  }

  function applyPageLevelBlocking() {
    const currentVenue = activeAdapter.getCurrentVenue();
    const existingBanner = document.querySelector(`[${PAGE_BANNER_ATTR}]`);

    if (!currentVenue || !isBlocked(currentVenue.key)) {
      existingBanner?.remove();
      return;
    }

    if (existingBanner) {
      return;
    }

    const banner = document.createElement("div");
    banner.className = "wolt-blocker-page-banner";
    banner.setAttribute(PAGE_BANNER_ATTR, "true");
    banner.innerHTML = `
      <div>
        <strong>This place is hidden</strong>
        <span>It will stay hidden from ${activeAdapter.label} listings until you unblock it.</span>
      </div>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Unhide";
    button.addEventListener("click", async () => {
      await unblockVenue(currentVenue.key);
    });
    banner.appendChild(button);

    const mount = document.body.firstElementChild || document.body;
    mount.parentElement?.insertBefore(banner, mount);
  }

  function injectPageButtonIfNeeded() {
    if (!activeAdapter) {
      return;
    }

    const currentVenue = activeAdapter.getCurrentVenue();
    const existingBanner = document.querySelector(`[${PAGE_BANNER_ATTR}]`);
    const title = activeAdapter.getPageTitleNode();

    if (!currentVenue || !title) {
      existingBanner?.remove();
      title?.parentElement?.querySelector(`[${PAGE_BUTTON_ATTR}]`)?.remove();
      return;
    }

    if (isBlocked(currentVenue.key)) {
      applyPageLevelBlocking();
      title.parentElement?.querySelector(`[${PAGE_BUTTON_ATTR}]`)?.remove();
      return;
    }

    existingBanner?.remove();

    if (title.parentElement?.querySelector(`[${PAGE_BUTTON_ATTR}]`)) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "wolt-blocker-hide-button";
    button.style.opacity = "1";
    button.style.pointerEvents = "auto";
    button.style.position = "static";
    button.style.marginLeft = "12px";
    button.textContent = "Hide this place";
    button.setAttribute(PAGE_BUTTON_ATTR, "true");
    button.addEventListener("click", async () => {
      const venue = activeAdapter.getCurrentVenue();
      if (venue) {
        await blockVenue(venue);
      }
    });

    title.insertAdjacentElement("afterend", button);
  }

  async function blockVenue(venue) {
    const previous = blockedVenues[venue.key] || {};
    blockedVenues[venue.key] = {
      ...previous,
      ...venue,
      blockedAt: new Date().toISOString()
    };
    localStats = updateLocalStats(localStats, venue, "block");
    telemetryQueue = enqueueTelemetryEvent(telemetryQueue, telemetrySettings, venue, "hide");
    await saveAll();
    scanPage();
  }

  async function unblockVenue(key) {
    const venue = blockedVenues[key];
    if (venue) {
      localStats = updateLocalStats(localStats, venue, "unblock");
      telemetryQueue = enqueueTelemetryEvent(telemetryQueue, telemetrySettings, venue, "unhide");
    }
    delete blockedVenues[key];
    await saveAll();
    scanPage();
  }

  function isBlocked(key) {
    return Boolean(blockedVenues[key]);
  }

  async function saveAll() {
    await chrome.storage.sync.set({
      [STORAGE_KEY]: blockedVenues,
      [STATS_KEY]: localStats,
      [TELEMETRY_SETTINGS_KEY]: telemetrySettings,
      [TELEMETRY_QUEUE_KEY]: telemetryQueue
    });
  }

  async function loadObject(key) {
    const result = await chrome.storage.sync.get(key);
    return result[key] || {};
  }

  async function loadArray(key) {
    const result = await chrome.storage.sync.get(key);
    return result[key] || [];
  }

  function updateLocalStats(stats, venue, action) {
    const next = { ...stats };
    const existing = next[venue.key] || {
      key: venue.key,
      name: venue.name,
      platform: venue.platform,
      type: venue.type,
      pathname: venue.pathname,
      blockCount: 0,
      unblockCount: 0
    };

    existing.name = venue.name;
    existing.platform = venue.platform;
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

  function getPlatformSummary(platformId) {
    const adapter = adapters.find((item) => item.id === platformId);
    return adapter ? { id: adapter.id, label: adapter.label } : null;
  }

  function getActiveAdapter() {
    return adapters.find((adapter) => adapter.matchesLocation(location));
  }

  function getButtonMount(root) {
    if (root.tagName !== "A") {
      return root;
    }

    const parent = root.parentElement;
    if (!parent) {
      return root;
    }

    const venueLinks = getVenueLinksWithin(parent);
    const uniqueKeys = new Set(venueLinks.map((item) => item.key));
    return uniqueKeys.size <= 1 ? parent : root;
  }

  function createBaseVenue(adapter, details) {
    return {
      ...details,
      platform: adapter.id,
      platformLabel: adapter.label,
      key: `${adapter.id}:${details.type}:${details.slug}`
    };
  }

  function getTextLabel(link) {
    const ariaLabel = link.getAttribute("aria-label");
    if (ariaLabel) {
      return ariaLabel.trim();
    }

    const heading = link.querySelector("h1, h2, h3, h4, h5, h6");
    if (heading?.textContent) {
      return heading.textContent.trim();
    }

    const text = (link.textContent || "").trim();
    if (!text) {
      return "";
    }

    return text.split("\n").map((part) => part.trim()).filter(Boolean)[0] || text;
  }

  function humanizeSlug(slug) {
    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function enqueueTelemetryEvent(queue, settings, venue, action) {
    if (!settings?.enabled) {
      return queue;
    }

    const next = queue.slice(-199);
    next.push({
      action,
      country: inferCountryCode(),
      createdAt: new Date().toISOString(),
      extensionVersion: chrome.runtime.getManifest().version,
      platform: venue.platform,
      type: venue.type,
      venueKey: venue.key,
      venueName: venue.name
    });
    return next;
  }

  function inferCountryCode() {
    const segments = location.pathname.split("/").filter(Boolean);
    if (location.hostname === "wolt.com" && segments.length >= 2) {
      return segments[1].slice(0, 3).toUpperCase();
    }

    if (location.hostname === "food.bolt.eu" && segments.length >= 1) {
      return segments[0].slice(0, 2).toUpperCase();
    }

    if (location.hostname.endsWith("foody.com.cy")) {
      return "CY";
    }

    return "UN";
  }

  function createWoltAdapter() {
    const selector = "a[href*='/restaurant/'], a[href*='/venue/']";

    return {
      id: "wolt",
      label: "Wolt",
      matchesLocation(currentLocation) {
        return currentLocation.hostname === "wolt.com";
      },
      getListingLinks() {
        return Array.from(document.querySelectorAll(selector));
      },
      getLinksWithin(node) {
        return Array.from(node.querySelectorAll(selector));
      },
      findMatchingLinks(venue) {
        return Array.from(document.querySelectorAll(
          `a[href="${CSS.escape(venue.pathname)}"], a[href^="${CSS.escape(venue.pathname)}?"]`
        ));
      },
      getPageTitleNode() {
        return document.querySelector("h1");
      },
      getCurrentVenue() {
        return this.getVenueFromPathname(location.pathname, document.querySelector("h1")?.textContent || "");
      },
      getVenueFromLink(link) {
        if (!(link instanceof HTMLAnchorElement) || !link.href) {
          return null;
        }

        const url = new URL(link.href, location.origin);
        return this.getVenueFromPathname(url.pathname, getTextLabel(link));
      },
      getVenueFromPathname(pathname, fallbackName = "") {
        const match = pathname.match(/^\/[^/]+\/[^/]+\/[^/]+\/(restaurant|venue)\/([^/?#]+)/);
        if (!match) {
          return null;
        }

        const type = match[1];
        const slug = decodeURIComponent(match[2]);
        return createBaseVenue(this, {
          slug,
          type,
          pathname: pathname.replace(/\/+$/, ""),
          name: fallbackName.trim() || humanizeSlug(slug)
        });
      }
    };
  }

  function createFoodyAdapter() {
    const selector = "a[href*='/delivery/menu/']";

    return {
      id: "foody",
      label: "Foody",
      matchesLocation(currentLocation) {
        return currentLocation.hostname === "www.foody.com.cy" || currentLocation.hostname === "foody.com.cy";
      },
      getListingLinks() {
        return Array.from(document.querySelectorAll(selector));
      },
      getLinksWithin(node) {
        return Array.from(node.querySelectorAll(selector));
      },
      findMatchingLinks(venue) {
        return Array.from(document.querySelectorAll(
          `a[href="${CSS.escape(venue.pathname)}"], a[href^="${CSS.escape(venue.pathname)}?"]`
        ));
      },
      getPageTitleNode() {
        return document.querySelector("h1");
      },
      getCurrentVenue() {
        return this.getVenueFromPathname(location.pathname, document.querySelector("h1")?.textContent || "");
      },
      getVenueFromLink(link) {
        if (!(link instanceof HTMLAnchorElement) || !link.href) {
          return null;
        }

        const url = new URL(link.href, location.origin);
        return this.getVenueFromPathname(url.pathname, getTextLabel(link));
      },
      getVenueFromPathname(pathname, fallbackName = "") {
        const match = pathname.match(/^\/delivery\/menu\/([^/?#]+)/);
        if (!match) {
          return null;
        }

        const slug = decodeURIComponent(match[1]);
        return createBaseVenue(this, {
          slug,
          type: "store",
          pathname: pathname.replace(/\/+$/, ""),
          name: fallbackName.trim() || humanizeSlug(slug)
        });
      }
    };
  }

  function createBoltFoodAdapter() {
    const selector = "a[href*='/p/']";

    return {
      id: "bolt-food",
      label: "Bolt Food",
      matchesLocation(currentLocation) {
        return currentLocation.hostname === "food.bolt.eu";
      },
      getListingLinks() {
        return Array.from(document.querySelectorAll(selector)).filter((link) => this.getVenueFromLink(link));
      },
      getLinksWithin(node) {
        return Array.from(node.querySelectorAll(selector)).filter((link) => this.getVenueFromLink(link));
      },
      findMatchingLinks(venue) {
        return Array.from(document.querySelectorAll(
          `a[href="${CSS.escape(venue.pathname)}"], a[href^="${CSS.escape(venue.pathname)}?"]`
        ));
      },
      getPageTitleNode() {
        return document.querySelector("h1");
      },
      getCurrentVenue() {
        return this.getVenueFromPathname(location.pathname, document.querySelector("h1")?.textContent || "");
      },
      getVenueFromLink(link) {
        if (!(link instanceof HTMLAnchorElement) || !link.href) {
          return null;
        }

        const url = new URL(link.href, location.origin);
        return this.getVenueFromPathname(url.pathname, getTextLabel(link));
      },
      getVenueFromPathname(pathname, fallbackName = "") {
        const match = pathname.match(/^\/[^/]+\/[^/]+\/p\/(\d+)-([^/?#]+)/);
        if (!match) {
          return null;
        }

        const slug = `${match[1]}-${decodeURIComponent(match[2])}`;
        return createBaseVenue(this, {
          slug,
          type: "store",
          pathname: pathname.replace(/\/+$/, ""),
          name: fallbackName.trim() || humanizeSlug(match[2])
        });
      }
    };
  }
})();
