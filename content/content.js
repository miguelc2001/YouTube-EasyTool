// YouTube EasyTool — Content Script
// Runs on youtube.com pages. Reads settings from storage and modifies
// the page by overriding YouTube's CSS/DOM.

// Guard: bail out if running inside an iframe (e.g. ad iframes)
if (window !== window.top) {
  // do nothing
} else {
  const STORAGE_KEY = 'settings';
  const GRID_STYLE_ID = 'easytool-grid-layout';

  // ─── Grid feature ─────────────────────────────────────────────────────────

  // Builds CSS with the column count baked in — applies to any
  // ytd-rich-grid-renderer (Home, Subscriptions, etc.) without depending on
  // YouTube's inline CSS custom property, which only works reliably on Home.
  function getGridLayoutCSS(columns) {
    return `
    ytd-rich-grid-renderer #contents.ytd-rich-grid-renderer {
      display: grid !important;
      grid-template-columns: repeat(${columns}, minmax(0, 1fr)) !important;
      gap: 16px !important;
      padding: 16px 16px !important;
      box-sizing: border-box !important;
    }
    ytd-rich-item-renderer.ytd-rich-grid-renderer {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
    }
    ytd-rich-section-renderer.ytd-rich-grid-renderer {
      grid-column: 1 / -1 !important;
      width: 100% !important;
      max-width: 100% !important;
    }
  `;
  }

  function applyGridColumns(columns) {
    let styleEl = document.getElementById(GRID_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = GRID_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = getGridLayoutCSS(columns);
  }

  function clearGridOverride() {
    const styleEl = document.getElementById(GRID_STYLE_ID);
    if (styleEl) styleEl.remove();
  }

  // ─── Hide Shorts feature ──────────────────────────────────────────────────

  const SHORTS_STYLE_ID = 'easytool-hide-shorts';

  // CSS using :has() (Chrome 105+, Firefox 121+).
  // Sidebar navigation entries are intentionally NOT hidden so the user can
  // still navigate to the Shorts section to watch them if they choose.
  const SHORTS_CSS = `
    /* Home page Shorts shelf + its outer section wrapper */
    ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]) { display: none !important; }

    /* Search results Shorts shelf */
    ytd-search ytd-reel-shelf-renderer { display: none !important; }

    /* Individual Shorts cards embedded in home/subscriptions feeds (scoped to grid to avoid history) */
    ytd-rich-grid-renderer ytd-rich-item-renderer:has(ytd-reel-item-renderer) { display: none !important; }

    /* Shorts in channel grid feeds (exclude history) */
    ytd-browse:not([page-subtype="history"]) ytd-grid-video-renderer:has(a[href*="/shorts/"]) { display: none !important; }

    /* Individual Short videos in search results only (scoped to avoid hiding on history etc.) */
    ytd-search ytd-video-renderer:has(a[href*="/shorts/"]) { display: none !important; }

    /* Shorts shelf section in search results */
    ytd-search grid-shelf-view-model { display: none !important; }
  `;

  // JS fallback for Firefox 109-120 (no :has() support): hide the home shelf
  // container that the CSS rule above can't reach on those browser versions.
  function hideShortsShelfFallback() {
    document.querySelectorAll('ytd-rich-shelf-renderer[is-shorts]').forEach((shelf) => {
      const section = shelf.closest('ytd-rich-section-renderer');
      if (section) section.style.setProperty('display', 'none', 'important');
    });
  }

  let shortsObserver = null;
  let shortsDebounceTimer = null;

  function applyShortsHiding() {
    // Inject the <style> block if not already present (persists across SPA navigations)
    if (!document.getElementById(SHORTS_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = SHORTS_STYLE_ID;
      style.textContent = SHORTS_CSS;
      document.head.appendChild(style);
    }

    // Run JS fallback immediately for already-rendered shelf elements
    hideShortsShelfFallback();

    // Watch for dynamically added Shorts shelves after SPA navigation.
    // Debounced to avoid running querySelectorAll on every DOM mutation —
    // YouTube fires hundreds of mutations per second.
    if (!shortsObserver) {
      shortsObserver = new MutationObserver(() => {
        clearTimeout(shortsDebounceTimer);
        shortsDebounceTimer = setTimeout(hideShortsShelfFallback, 50);
      });
      shortsObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function clearShortsHiding() {
    const style = document.getElementById(SHORTS_STYLE_ID);
    if (style) style.remove();

    if (shortsObserver) {
      shortsObserver.disconnect();
      shortsObserver = null;
    }
    clearTimeout(shortsDebounceTimer);

    // Remove any inline display:none that the JS fallback applied
    document.querySelectorAll('ytd-rich-section-renderer[style*="display"]').forEach((el) => {
      el.style.removeProperty('display');
    });
  }

  // ─── Sidebar thumbnail size feature ───────────────────────────────────────

  const THUMBNAIL_STYLE_ID = 'easytool-sidebar-thumbnails';

  // YouTube sets the thumbnail link (a.yt-lockup-view-model__content-image)
  // to width: 65% of its parent by default (inline style). We scale that
  // percentage proportionally using !important to override the inline style.
  function getSidebarThumbnailCSS(size) {
    const widthPct = (65 * size / 100).toFixed(1);
    return `
    ytd-watch-next-secondary-results-renderer yt-lockup-view-model a.yt-lockup-view-model__content-image {
      width: ${widthPct}% !important;
      min-width: 0 !important;
      flex-shrink: 0 !important;
    }
  `;
  }

  function applySidebarThumbnails(size) {
    if (size === 100) {
      clearSidebarThumbnailOverride();
      return;
    }
    let styleEl = document.getElementById(THUMBNAIL_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = THUMBNAIL_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = getSidebarThumbnailCSS(size);
  }

  function clearSidebarThumbnailOverride() {
    const styleEl = document.getElementById(THUMBNAIL_STYLE_ID);
    if (styleEl) styleEl.remove();
  }

  // ─── Original Titles (anti-translate) feature ─────────────────────────────

  function applyOriginalTitles(enabled) {
    // Persist so inject-titles.js (document_start) can read it on the next load
    // before YouTube fires its first API call.
    try { localStorage.setItem('easytool-original-titles', enabled ? 'true' : 'false'); } catch (_) {}
    // Also update the already-running page-world script for the current page.
    document.dispatchEvent(
      new CustomEvent('easytool-settings', { detail: { originalTitles: enabled } })
    );
  }

  // ─── Settings handler ─────────────────────────────────────────────────────

  // Validates and sanitizes settings from storage before use.
  // Guards against corrupted storage or unexpected types.
  function validateSettings(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      gridEnabled:           Boolean(raw.gridEnabled),
      gridColumns:           Math.max(2, Math.min(8, parseInt(raw.gridColumns, 10) || 4)),
      hideShorts:            Boolean(raw.hideShorts),
      originalTitles:        Boolean(raw.originalTitles),
      sidebarThumbnailSize:  Math.max(50, Math.min(130, parseInt(raw.sidebarThumbnailSize, 10) || 100)),
    };
  }

  function handleSettings(raw) {
    const settings = validateSettings(raw);
    if (!settings) return;

    // Grid
    if (settings.gridEnabled && settings.gridColumns) {
      applyGridColumns(settings.gridColumns);
    } else {
      clearGridOverride();
    }

    // Hide Shorts
    if (settings.hideShorts) {
      applyShortsHiding();
    } else {
      clearShortsHiding();
    }

    // Sidebar thumbnail size
    if (settings.gridEnabled) {
      applySidebarThumbnails(settings.sidebarThumbnailSize);
    } else {
      clearSidebarThumbnailOverride();
    }

    // Original Titles
    applyOriginalTitles(settings.originalTitles);
  }

  // ─── Initialization ───────────────────────────────────────────────────────

  // In-memory cache — avoids redundant storage reads on every SPA navigation.
  let cachedSettings = null;

  // Load settings on page load
  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    cachedSettings = result[STORAGE_KEY];
    handleSettings(cachedSettings);
  });

  // React immediately when the user changes settings in the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[STORAGE_KEY]) {
      cachedSettings = changes[STORAGE_KEY].newValue;
      handleSettings(cachedSettings);
    }
  });

  // Re-apply after YouTube's internal SPA navigation (Home → Video → Home, etc.)
  document.addEventListener('yt-navigate-finish', () => {
    // Original titles flag must be set before the next page's API calls fire,
    // so apply it immediately rather than waiting for the DOM-settle delay.
    const settings = validateSettings(cachedSettings);
    if (settings) applyOriginalTitles(settings.originalTitles);

    setTimeout(() => handleSettings(cachedSettings), 400);
  });
}
