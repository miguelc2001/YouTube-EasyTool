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
    ytd-reel-shelf-renderer { display: none !important; }

    /* Individual Shorts cards embedded in home/subscriptions feeds */
    ytd-rich-item-renderer:has(ytd-reel-item-renderer) { display: none !important; }

    /* Shorts in channel grid feeds */
    ytd-grid-video-renderer:has(a[href*="/shorts/"]) { display: none !important; }
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

    // Watch for dynamically added Shorts shelves after SPA navigation
    if (!shortsObserver) {
      shortsObserver = new MutationObserver(() => {
        hideShortsShelfFallback();
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

    // Remove any inline display:none that the JS fallback applied
    document.querySelectorAll('ytd-rich-section-renderer[style*="display"]').forEach((el) => {
      el.style.removeProperty('display');
    });
  }

  // ─── Original Titles (anti-translate) feature ─────────────────────────────

  let titlesInjected = false;

  function ensureTitlesScriptInjected() {
    if (titlesInjected || window.__easytoolInjected) return;

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/inject-titles.js');
    (document.head || document.documentElement).appendChild(script);
    titlesInjected = true;
  }

  function applyOriginalTitles(enabled) {
    if (enabled) {
      ensureTitlesScriptInjected();
    }
    // Dispatch the setting to the page-world script.
    // Use a short delay on first injection to let the script load and register
    // its event listener before we fire.
    const dispatch = () => {
      document.dispatchEvent(
        new CustomEvent('easytool-settings', { detail: { originalTitles: enabled } })
      );
    };
    if (enabled && !window.__easytoolInjected) {
      setTimeout(dispatch, 50);
    } else {
      dispatch();
    }
  }

  // ─── Settings handler ─────────────────────────────────────────────────────

  // Validates and sanitizes settings from storage before use.
  // Guards against corrupted storage or unexpected types.
  function validateSettings(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      gridEnabled:    Boolean(raw.gridEnabled),
      gridColumns:    Math.max(2, Math.min(8, parseInt(raw.gridColumns, 10) || 4)),
      hideShorts:     Boolean(raw.hideShorts),
      originalTitles: Boolean(raw.originalTitles),
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

    // Original Titles
    applyOriginalTitles(settings.originalTitles);
  }

  // ─── Initialization ───────────────────────────────────────────────────────

  // Load settings on page load
  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    handleSettings(result[STORAGE_KEY]);
  });

  // React immediately when the user changes settings in the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[STORAGE_KEY]) {
      handleSettings(changes[STORAGE_KEY].newValue);
    }
  });

  // Re-apply after YouTube's internal SPA navigation (Home → Video → Home, etc.)
  document.addEventListener('yt-navigate-finish', () => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      setTimeout(() => handleSettings(result[STORAGE_KEY]), 400);
    });
  });
}
