(function () {
  const STORAGE_KEY = "blockedVenues";
  const ROOT_ATTR = "data-wolt-blocker-root";
  const BUTTON_ATTR = "data-wolt-blocker-button";
  const PAGE_BANNER_ATTR = "data-wolt-blocker-page-banner";
  const processedRoots = new WeakSet();
  let blockedVenues = {};
  let scanTimer = null;
  let observer = null;

  init().catch((error) => {
    console.error("Wolt Blocker init failed", error);
  });

  async function init() {
    blockedVenues = await loadBlockedVenues();
    injectPageBannerIfNeeded();
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
    if (message?.type !== "WOLT_BLOCKER_GET_PAGE_STATE") {
      return;
    }

    const currentVenue = getVenueFromPathname(location.pathname, document.querySelector("h1")?.textContent || "");
    sendResponse({
      isWolt: location.hostname === "wolt.com",
      venue: currentVenue,
      isBlocked: currentVenue ? isBlocked(currentVenue.key) : false
    });
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "sync" || !changes[STORAGE_KEY]) {
      return;
    }
    blockedVenues = changes[STORAGE_KEY].newValue || {};
    injectPageBannerIfNeeded();
    scanPage();
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      injectPageBannerIfNeeded();
      scanPage();
    }, 120);
  }

  function scanPage() {
    const links = document.querySelectorAll("a[href*='/restaurant/'], a[href*='/venue/']");
    const seenKeys = new Set();

    for (const link of links) {
      const venue = getVenueFromLink(link);
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
    const matchingLinks = document.querySelectorAll(
      `a[href="${CSS.escape(venue.pathname)}"], a[href^="${CSS.escape(venue.pathname)}?"]`
    );
    const roots = new Set();

    for (const link of matchingLinks) {
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

        if (
          area > 18000 &&
          uniqueKeys.size <= 1 &&
          uniqueKeys.has(venue.key)
        ) {
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
    return Array.from(
      node.querySelectorAll("a[href*='/restaurant/'], a[href*='/venue/']")
    )
      .map((link) => getVenueFromLink(link))
      .filter(Boolean);
  }

  function decorateVenueRoot(root, venue) {
    root.setAttribute(ROOT_ATTR, "true");
    root.dataset.woltBlockerKey = venue.key;
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
    const currentVenue = getVenueFromPathname(location.pathname);
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
        <strong>This venue is blocked</strong>
        <span>It will stay hidden from Wolt listings until you unblock it.</span>
      </div>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Unblock";
    button.addEventListener("click", async () => {
      await unblockVenue(currentVenue.key);
    });
    banner.appendChild(button);

    const mount = document.body.firstElementChild || document.body;
    mount.parentElement?.insertBefore(banner, mount);
  }

  function injectPageBannerIfNeeded() {
    const currentVenue = getVenueFromPathname(location.pathname);
    const existingBanner = document.querySelector(`[${PAGE_BANNER_ATTR}]`);

    if (!currentVenue) {
      existingBanner?.remove();
      return;
    }

    if (isBlocked(currentVenue.key)) {
      applyPageLevelBlocking();
      return;
    }

    existingBanner?.remove();
    if (title.parentElement?.querySelector(`[${BUTTON_ATTR}]`)) {
      return;
    }

    const title = document.querySelector("h1");
    if (!title) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "wolt-blocker-hide-button";
    button.style.opacity = "1";
    button.style.pointerEvents = "auto";
    button.style.position = "static";
    button.style.marginLeft = "12px";
    button.textContent = "Hide this venue";
    button.addEventListener("click", async () => {
      const venue = getVenueFromPathname(location.pathname, title.textContent || "");
      if (venue) {
        await blockVenue(venue);
      }
    });

    if (title.parentElement && !title.parentElement.querySelector(`[${BUTTON_ATTR}]`)) {
      button.setAttribute(BUTTON_ATTR, "true");
      title.insertAdjacentElement("afterend", button);
    }
  }

  async function blockVenue(venue) {
    blockedVenues[venue.key] = {
      key: venue.key,
      name: venue.name,
      pathname: venue.pathname,
      type: venue.type,
      blockedAt: new Date().toISOString()
    };
    await saveBlockedVenues();
    scanPage();
  }

  async function unblockVenue(key) {
    delete blockedVenues[key];
    await saveBlockedVenues();
    scanPage();
  }

  function isBlocked(key) {
    return Boolean(blockedVenues[key]);
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

  function getVenueFromLink(link) {
    if (!(link instanceof HTMLAnchorElement) || !link.href) {
      return null;
    }

    const url = new URL(link.href, location.origin);
    return getVenueFromPathname(url.pathname, getVenueName(link));
  }

  function getVenueFromPathname(pathname, fallbackName = "") {
    const match = pathname.match(/^\/[^/]+\/[^/]+\/[^/]+\/(restaurant|venue)\/([^/?#]+)/);
    if (!match) {
      return null;
    }

    const type = match[1];
    const slug = decodeURIComponent(match[2]);
    return {
      key: `${type}:${slug}`,
      slug,
      type,
      pathname: pathname.replace(/\/+$/, ""),
      name: fallbackName.trim() || humanizeSlug(slug)
    };
  }

  function getVenueName(link) {
    const ariaLabel = link.getAttribute("aria-label");
    if (ariaLabel) {
      return ariaLabel;
    }

    const heading = link.querySelector("h1, h2, h3, h4, h5, h6");
    if (heading?.textContent) {
      return heading.textContent.trim();
    }

    const text = (link.textContent || "").trim();
    if (text) {
      return text.split("\n").map((part) => part.trim()).filter(Boolean)[0] || text;
    }

    return "";
  }

  function humanizeSlug(slug) {
    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
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
})();
