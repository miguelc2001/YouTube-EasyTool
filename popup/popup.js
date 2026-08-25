// YouTube EasyTool Popup Script

const STORAGE_KEY = 'settings';
const BASE_WIDTH = 280;        // must match the html/body width in popup.css
const POPUP_MAX_HEIGHT = 600;  // Chrome's hard cap for extension popups
const SAVE_DELAY = 250;        // ms, keeps slider drags under the sync write quota

const DEFAULT_SETTINGS = {
  gridEnabled: true,
  gridColumns: 4,
  responsiveGrid: true,
  autoMetadata: true,
  metadataScale: 100,
  hideShorts: false,
  originalTitles: false,
  sidebarThumbnailSize: 100,
  savedThumbnailSize: 100,
  removeBorderRadius: false,
};

// Must match the min/max on the matching range inputs in popup.html.
const LIMITS = {
  gridColumns: [2, 8],
  metadataScale: [60, 140],
  sidebarThumbnailSize: [50, 130],
  savedThumbnailSize: [50, 130],
};

const $ = (id) => document.getElementById(id);

const ui = {
  version: $('version'),
  gridToggle: $('grid-toggle'),
  gridControls: $('grid-controls-group'),
  columnSlider: $('column-slider'),
  columnValue: $('column-value'),
  responsiveGridToggle: $('responsive-grid-toggle'),
  autoMetadataToggle: $('auto-metadata-toggle'),
  metadataSection: $('metadata-slider-section'),
  metadataSlider: $('metadata-slider'),
  metadataValue: $('metadata-value'),
  thumbnailSlider: $('thumbnail-slider'),
  thumbnailValue: $('thumbnail-value'),
  shortsToggle: $('shorts-toggle'),
  titlesToggle: $('titles-toggle'),
  radiusToggle: $('radius-toggle'),
};

let settings = { ...DEFAULT_SETTINGS };

// ── Storage ───────────────────────────────────────────────────────────────

let saveTimer = null;

function writeNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
    if (chrome.runtime.lastError) {
      console.error('[EasyTool] Storage write failed:', chrome.runtime.lastError.message);
    }
  });
}

// Dragging a slider fires `input` on every step. Writing each one blows past
// chrome.storage.sync's per-minute write quota, so coalesce them.
function save({ immediate = false } = {}) {
  if (immediate) {
    writeNow();
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, SAVE_DELAY);
}

// The popup can be dismissed mid-drag, so flush anything still pending.
window.addEventListener('pagehide', () => {
  if (saveTimer !== null) writeNow();
});

function sanitize(raw) {
  const clean = { ...DEFAULT_SETTINGS, ...raw };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const n = Number(clean[key]);
    clean[key] = Number.isFinite(n)
            ? Math.min(max, Math.max(min, n))
            : DEFAULT_SETTINGS[key];
  }
  return clean;
}

// ── Popup sizing ──────────────────────────────────────────────────────────

// screen.width is already in CSS pixels. Multiplying it by devicePixelRatio
// double-counts and drops HiDPI laptops onto the 4K branch, so use it as is.
const baseScale = (() => {
  const w = window.screen.width;
  return w >= 3840 ? 1.33 : w >= 2560 ? 1.15 : 1;
})();

// Zoom the body, never the root element: a zoomed root does not report its
// scaled size back to the browser, so the popup window keeps the unscaled
// height and crops the bottom. Zooming a child grows the root normally.
function fitPopup() {
  const contentHeight = document.body.scrollHeight;
  const scale = Math.min(baseScale, POPUP_MAX_HEIGHT / contentHeight);
  const width = Math.ceil(BASE_WIDTH * scale) + 'px';

  document.body.style.zoom = String(scale);
  document.documentElement.style.width = width;
}

// ── Rendering ─────────────────────────────────────────────────────────────

function setSlider(slider, valueNode, value, text) {
  slider.value = value;
  valueNode.textContent = text;
  const pct = ((value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty('--fill', `${pct}%`);
}

function render() {
  ui.gridToggle.checked = settings.gridEnabled;
  ui.gridControls.classList.toggle('hidden', !settings.gridEnabled);

  setSlider(ui.columnSlider, ui.columnValue, settings.gridColumns, String(settings.gridColumns));

  ui.responsiveGridToggle.checked = settings.responsiveGrid;
  ui.autoMetadataToggle.checked = settings.autoMetadata;

  setSlider(ui.metadataSlider, ui.metadataValue, settings.metadataScale, settings.metadataScale + '%');
  ui.metadataSection.classList.toggle('disabled', settings.autoMetadata);
  ui.metadataSlider.disabled = settings.autoMetadata;

  // savedThumbnailSize is the user's real choice; sidebarThumbnailSize is what
  // the content script applies and is parked at 100 while the grid is off.
  setSlider(ui.thumbnailSlider, ui.thumbnailValue,
          settings.savedThumbnailSize, settings.savedThumbnailSize + '%');

  ui.shortsToggle.checked = settings.hideShorts;
  ui.titlesToggle.checked = settings.originalTitles;
  ui.radiusToggle.checked = settings.removeBorderRadius;

  fitPopup();
}

// ── Wiring ────────────────────────────────────────────────────────────────

function bindToggle(node, key, onChange) {
  node.addEventListener('change', () => {
    settings[key] = node.checked;
    if (onChange) onChange();
    save({ immediate: true });
  });
}

function bindSlider(node, valueNode, key, format, onChange) {
  const update = (immediate) => {
    const value = Number(node.value);
    settings[key] = value;
    valueNode.textContent = format(value);
    setSlider(node, valueNode, value, format(value));
    if (onChange) onChange(value);
    save({ immediate });
  };

  node.addEventListener('input', () => update(false));
  node.addEventListener('change', () => update(true)); // fires on release
}

bindToggle(ui.gridToggle, 'gridEnabled', () => {
  if (settings.gridEnabled) {
    settings.sidebarThumbnailSize = settings.savedThumbnailSize;
  } else {
    settings.savedThumbnailSize = settings.sidebarThumbnailSize;
    settings.sidebarThumbnailSize = 100; // 100 means "leave thumbnails alone"
  }
  render();
});

bindToggle(ui.responsiveGridToggle, 'responsiveGrid');
bindToggle(ui.autoMetadataToggle, 'autoMetadata', render);
bindToggle(ui.shortsToggle, 'hideShorts');
bindToggle(ui.titlesToggle, 'originalTitles');
bindToggle(ui.radiusToggle, 'removeBorderRadius');

bindSlider(ui.columnSlider, ui.columnValue, 'gridColumns', String);
bindSlider(ui.metadataSlider, ui.metadataValue, 'metadataScale', (v) => v + '%');
bindSlider(ui.thumbnailSlider, ui.thumbnailValue, 'sidebarThumbnailSize', (v) => v + '%', (v) => {
  settings.savedThumbnailSize = v;
});

// ── Initialization ────────────────────────────────────────────────────────

ui.version.textContent = 'v' + chrome.runtime.getManifest().version;

chrome.storage.sync.get(STORAGE_KEY, (result) => {
  if (chrome.runtime.lastError) {
    console.error('[EasyTool] Storage read failed:', chrome.runtime.lastError.message);
  }
  settings = sanitize(result && result[STORAGE_KEY]);
  render();

  // Transitions stay off until the stored state is painted, so the toggles
  // do not visibly slide into position on open.
  requestAnimationFrame(() => document.body.classList.add('interactive'));
});
