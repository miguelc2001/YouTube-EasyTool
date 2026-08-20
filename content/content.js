// YouTube EasyTool — Content Script
// Runs on youtube.com pages. Reads settings from storage and modifies
// the page by overriding YouTube's CSS/DOM.

if (window !== window.top) {
  // do nothing in iframes
} else {
  const STORAGE_KEY = 'settings';
  const GRID_STYLE_ID = 'easytool-grid-layout';

  // ─── Grid feature ─────────────────────────────────────────────────────────

  function getGridLayoutCSS(columns, responsive, autoMetadata, metadataScale) {
    // Determine effective metadata scaling factor
    let effectiveScale;
    if (autoMetadata) {
      // Smooth metadata scaling relative to the column density
      effectiveScale = Math.max(0.8, Math.min(1.25, 1 + (4 - columns) * 0.05));
    } else {
      effectiveScale = (metadataScale || 100) / 100;
    }

    const titleSize = (1.65 * effectiveScale).toFixed(2);
    const metaSize = (1.3 * effectiveScale).toFixed(2);
    const avatarSize = Math.round(38 * effectiveScale);

    // Exact percentage calculation per item taking 16px grid gap into account
    const pctWidth = `calc((100% - ${(columns - 1) * 16}px) / ${columns})`;

    let columnsTemplate = `repeat(${columns}, minmax(0, 1fr))`;
    let responsiveRules = '';

    if (responsive) {
      // Uses percentage width as the basis so all 8 columns fit on widescreen displays,
      // while stepping down proportionally on narrower viewports.
      columnsTemplate = `repeat(auto-fit, minmax(max(180px, ${pctWidth}), 1fr))`;

      responsiveRules = `
      @media (max-width: 1400px) {
        ytd-rich-grid-renderer #contents.ytd-rich-grid-renderer {
          grid-template-columns: repeat(${Math.min(columns, 5)}, minmax(0, 1fr)) !important;
        }
      }
      @media (max-width: 1100px) {
        ytd-rich-grid-renderer #contents.ytd-rich-grid-renderer {
          grid-template-columns: repeat(${Math.min(columns, 4)}, minmax(0, 1fr)) !important;
        }
      }
      @media (max-width: 850px) {
        ytd-rich-grid-renderer #contents.ytd-rich-grid-renderer {
          grid-template-columns: repeat(${Math.min(columns, 3)}, minmax(0, 1fr)) !important;
        }
      }
      @media (max-width: 600px) {
        ytd-rich-grid-renderer #contents.ytd-rich-grid-renderer {
          grid-template-columns: repeat(${Math.min(columns, 2)}, minmax(0, 1fr)) !important;
        }
      }
      @media (max-width: 450px) {
        ytd-rich-grid-renderer #contents.ytd-rich-grid-renderer {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    }

    return `
    /* Container overrides for YouTube home/subscriptions feed */
    ytd-rich-grid-renderer {
      width: 100% !important;
      max-width: 100% !important;
    }
    ytd-rich-grid-renderer #contents.ytd-rich-grid-renderer {
      display: grid !important;
      grid-template-columns: ${columnsTemplate} !important;
      gap: 16px !important;
      padding: 16px !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    ytd-rich-item-renderer.ytd-rich-grid-renderer {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      margin: 0 !important;
    }
    /* Fixed: Matched without unrecognised tag names to clear IDE warnings */
    #contents.ytd-rich-grid-renderer > *.ytd-rich-grid-renderer:not(ytd-rich-item-renderer),
    *[class*="ytd-rich-section-renderer"] {
      grid-column: 1 / -1 !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    /* Metadata scaling */
    .ytLockupViewModelMetadata,
    ytd-rich-item-renderer #details {
      zoom: ${effectiveScale.toFixed(2)};
    }
    ytd-rich-item-renderer #video-title,
    ytd-rich-item-renderer .ytLockupMetadataViewModelTitle {
      font-size: ${titleSize}rem !important;
      line-height: calc(${titleSize}rem * 1.35) !important;
    }
    ytd-rich-item-renderer #channel-name,
    ytd-rich-item-renderer #metadata-line,
    ytd-rich-item-renderer .ytLockupMetadataViewModelSubhead {
      font-size: ${metaSize}rem !important;
    }
    ytd-rich-item-renderer #avatar-container,
    ytd-rich-item-renderer .ytLockupMetadataViewModelAvatar {
      width: ${avatarSize}px !important;
      height: ${avatarSize}px !important;
    }
    ${responsiveRules}
  `;
  }

  function applyGridColumns(columns, responsive, autoMetadata, metadataScale) {
    let styleEl = document.getElementById(GRID_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = GRID_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = getGridLayoutCSS(columns, responsive, autoMetadata, metadataScale);
  }

  function clearGridOverride() {
    const styleEl = document.getElementById(GRID_STYLE_ID);
    if (styleEl) styleEl.remove();
  }

  // ─── Hide Shorts feature ──────────────────────────────────────────────────

  const SHORTS_STYLE_ID = 'easytool-hide-shorts';

  /* Fixed: Use standard attribute and wildcard selectors */
  const SHORTS_CSS = `
    * > *[is-shorts],
    *:has(> *[is-shorts]),
    *:has(> #rich-shelf-header-container),
    ytd-search ytd-reel-shelf-renderer { display: none !important; }
    ytd-rich-grid-renderer ytd-rich-item-renderer:has(ytd-reel-item-renderer) { display: none !important; }
    ytd-browse:not([page-subtype="history"]) ytd-grid-video-renderer:has(a[href*="/shorts/"]) { display: none !important; }
    ytd-search ytd-video-renderer:has(a[href*="/shorts/"]) { display: none !important; }
    ytd-search grid-shelf-view-model { display: none !important; }
  `;

  function hideShortsFallback() {
    document.querySelectorAll('*[is-shorts]').forEach((shelf) => {
      const section = shelf.closest('#contents > *') || shelf.parentElement;
      if (section) section.style.setProperty('display', 'none', 'important');
    });
  }

  let shortsObserver = null;
  let shortsDebounceTimer = null;

  function applyShortsHiding() {
    if (!document.getElementById(SHORTS_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = SHORTS_STYLE_ID;
      style.textContent = SHORTS_CSS;
      document.head.appendChild(style);
    }
    hideShortsFallback();
    if (!shortsObserver) {
      shortsObserver = new MutationObserver(() => {
        clearTimeout(shortsDebounceTimer);
        shortsDebounceTimer = setTimeout(hideShortsFallback, 50);
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
    document.querySelectorAll('#contents > *[style*="display"]').forEach((el) => {
      el.style.removeProperty('display');
    });
  }

  // ─── Sidebar thumbnail size feature ───────────────────────────────────────

  const THUMBNAIL_STYLE_ID = 'easytool-sidebar-thumbnails';

  function getSidebarThumbnailCSS(size) {
    const widthPct = (65 * size / 100).toFixed(1);
    return `
    ytd-watch-next-secondary-results-renderer yt-lockup-view-model a.ytLockupViewModelContentImage {
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
      styleEl.id = GRID_STYLE_ID;
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
    try { localStorage.setItem('easytool-original-titles', enabled ? 'true' : 'false'); } catch (_) {}
    document.dispatchEvent(
        new CustomEvent('easytool-settings', { detail: { originalTitles: enabled } })
    );
  }

  // ─── Remove border radius feature ─────────────────────────────────────────

  const BORDER_RADIUS_STYLE_ID = 'easytool-player-border-radius';

  const BORDER_RADIUS_CSS = `
    ytd-watch-flexy[rounded-player] #ytd-player.ytd-watch-flexy {
      border-radius: 0px !important;
    }
  `;

  function applyBorderRadiusRemoval() {
    let styleEl = document.getElementById(BORDER_RADIUS_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = BORDER_RADIUS_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = BORDER_RADIUS_CSS;
  }

  function clearBorderRadiusOverride() {
    const styleEl = document.getElementById(BORDER_RADIUS_STYLE_ID);
    if (styleEl) styleEl.remove();
  }

  // ─── Settings handler ─────────────────────────────────────────────────────

  function validateSettings(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      gridEnabled:           Boolean(raw.gridEnabled),
      gridColumns:           Math.max(2, Math.min(8, parseInt(raw.gridColumns, 10) || 4)),
      responsiveGrid:        raw.responsiveGrid !== false,
      autoMetadata:          raw.autoMetadata !== false,
      metadataScale:         Math.max(60, Math.min(140, parseInt(raw.metadataScale, 10) || 100)),
      hideShorts:            Boolean(raw.hideShorts),
      originalTitles:        Boolean(raw.originalTitles),
      sidebarThumbnailSize:  Math.max(50, Math.min(130, parseInt(raw.sidebarThumbnailSize, 10) || 100)),
      removeBorderRadius:    Boolean(raw.removeBorderRadius),
    };
  }

  function handleSettings(raw) {
    const settings = validateSettings(raw);
    if (!settings) return;

    // Grid Layout & Scaling
    if (settings.gridEnabled && settings.gridColumns) {
      applyGridColumns(
          settings.gridColumns,
          settings.responsiveGrid,
          settings.autoMetadata,
          settings.metadataScale
      );
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

    // Remove Player Border Radius
    if (settings.removeBorderRadius) {
      applyBorderRadiusRemoval();
    } else {
      clearBorderRadiusOverride();
    }
  }

  // ─── Initialization ───────────────────────────────────────────────────────

  let cachedSettings = null;

  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    cachedSettings = result[STORAGE_KEY];
    handleSettings(cachedSettings);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[STORAGE_KEY]) {
      cachedSettings = changes[STORAGE_KEY].newValue;
      handleSettings(cachedSettings);
    }
  });

  document.addEventListener('yt-navigate-finish', () => {
    const settings = validateSettings(cachedSettings);
    if (settings) applyOriginalTitles(settings.originalTitles);
    setTimeout(() => handleSettings(cachedSettings), 400);
  });
}