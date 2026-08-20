// YouTube EasyTool — Popup Script

// Monitor scaling using CSS scale variable rather than direct body zoom
// to allow the browser popup window to shrink dynamically on collapse.
(function scaleToMonitor() {
  const physW = window.screen.width * (window.devicePixelRatio || 1);
  const scale = physW >= 3840 ? 1.33 : physW >= 2560 ? 1.15 : 1;
  if (scale > 1) {
    document.documentElement.style.zoom = String(scale);
  }
}());

const STORAGE_KEY = 'settings';

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

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 8;
const MIN_THUMBNAIL = 50;
const MAX_THUMBNAIL = 130;
const MIN_METADATA = 60;
const MAX_METADATA = 140;

// DOM refs
const gridToggle = document.getElementById('grid-toggle');
const gridControlsGroup = document.getElementById('grid-controls-group');
const columnSlider = document.getElementById('column-slider');
const columnValue = document.getElementById('column-value');
const sliderSection = document.getElementById('slider-section');

const responsiveGridRow = document.getElementById('responsive-grid-row');
const responsiveGridToggle = document.getElementById('responsive-grid-toggle');
const autoMetadataRow = document.getElementById('auto-metadata-row');
const autoMetadataToggle = document.getElementById('auto-metadata-toggle');
const metadataSliderSection = document.getElementById('metadata-slider-section');
const metadataSlider = document.getElementById('metadata-slider');
const metadataValue = document.getElementById('metadata-value');

const thumbnailSliderSection = document.getElementById('thumbnail-slider-section');
const thumbnailSlider = document.getElementById('thumbnail-slider');
const thumbnailValue = document.getElementById('thumbnail-value');

const shortsToggle = document.getElementById('shorts-toggle');
const titlesToggle = document.getElementById('titles-toggle');
const radiusToggle = document.getElementById('radius-toggle');

let currentSettings = null;

function saveSettings(settings) {
  chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
    if (chrome.runtime.lastError) {
      console.error('[EasyTool] Storage write failed:', chrome.runtime.lastError.message);
    }
  });
}

function updateSliderFill(slider) {
  const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty('--fill', `${pct}%`);
}

function applyUIState(settings) {
  // Main Grid switch & instant show/hide
  gridToggle.checked = settings.gridEnabled;
  if (gridControlsGroup) {
    gridControlsGroup.classList.toggle('hidden', !settings.gridEnabled);
  }

  // Sliders and sub-toggles
  columnSlider.value = settings.gridColumns;
  columnValue.textContent = settings.gridColumns;
  updateSliderFill(columnSlider);

  // Responsive Grid
  responsiveGridToggle.checked = settings.responsiveGrid;

  // Auto Metadata
  autoMetadataToggle.checked = settings.autoMetadata;

  // Manual Metadata Slider
  metadataSlider.value = settings.metadataScale;
  metadataValue.textContent = settings.metadataScale + '%';
  updateSliderFill(metadataSlider);
  metadataSliderSection.classList.toggle('disabled', settings.autoMetadata);
  metadataSlider.disabled = settings.autoMetadata;

  // Sidebar thumbnails
  const displaySize = settings.savedThumbnailSize ?? settings.sidebarThumbnailSize;
  thumbnailSlider.value = displaySize;
  thumbnailValue.textContent = displaySize + '%';
  updateSliderFill(thumbnailSlider);

  // Other Toggles
  shortsToggle.checked = settings.hideShorts;
  titlesToggle.checked = settings.originalTitles;
  radiusToggle.checked = settings.removeBorderRadius;
}

// ── Initialization ────────────────────────────────────────────────────────

chrome.storage.sync.get(STORAGE_KEY, (result) => {
  if (chrome.runtime.lastError) {
    console.error('[EasyTool] Storage read failed:', chrome.runtime.lastError.message);
    currentSettings = { ...DEFAULT_SETTINGS };
    applyUIState(currentSettings);
  } else {
    currentSettings = Object.assign({}, DEFAULT_SETTINGS, result[STORAGE_KEY]);
    applyUIState(currentSettings);
  }

  // Force synchronous reflow so checkboxes render in place instantly
  void document.body.offsetHeight;

  // Enable transitions on user interactions from this point forward
  requestAnimationFrame(() => {
    document.body.classList.add('interactive');
  });
});

// ── Event listeners (Grid Toggle update) ──────────────────────────────────

gridToggle.addEventListener('change', () => {
  currentSettings.gridEnabled = gridToggle.checked;
  if (!currentSettings.gridEnabled) {
    currentSettings.savedThumbnailSize = currentSettings.sidebarThumbnailSize;
    currentSettings.sidebarThumbnailSize = 100;
  } else {
    currentSettings.sidebarThumbnailSize = currentSettings.savedThumbnailSize;
  }
  saveSettings(currentSettings);
  applyUIState(currentSettings, false); // pass false so the animation plays
});

columnSlider.addEventListener('input', () => {
  let val = parseInt(columnSlider.value, 10);
  if (isNaN(val)) val = DEFAULT_SETTINGS.gridColumns;
  val = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, val));

  currentSettings.gridColumns = val;
  columnValue.textContent = val;
  updateSliderFill(columnSlider);
  saveSettings(currentSettings);
});

responsiveGridToggle.addEventListener('change', () => {
  currentSettings.responsiveGrid = responsiveGridToggle.checked;
  saveSettings(currentSettings);
});

autoMetadataToggle.addEventListener('change', () => {
  currentSettings.autoMetadata = autoMetadataToggle.checked;
  saveSettings(currentSettings);
  applyUIState(currentSettings);
});

metadataSlider.addEventListener('input', () => {
  let val = parseInt(metadataSlider.value, 10);
  if (isNaN(val)) val = DEFAULT_SETTINGS.metadataScale;
  val = Math.max(MIN_METADATA, Math.min(MAX_METADATA, val));

  currentSettings.metadataScale = val;
  metadataValue.textContent = val + '%';
  updateSliderFill(metadataSlider);
  saveSettings(currentSettings);
});

thumbnailSlider.addEventListener('input', () => {
  let val = parseInt(thumbnailSlider.value, 10);
  if (isNaN(val)) val = DEFAULT_SETTINGS.sidebarThumbnailSize;
  val = Math.max(MIN_THUMBNAIL, Math.min(MAX_THUMBNAIL, val));

  currentSettings.sidebarThumbnailSize = val;
  currentSettings.savedThumbnailSize = val;
  thumbnailValue.textContent = val + '%';
  updateSliderFill(thumbnailSlider);
  saveSettings(currentSettings);
});

shortsToggle.addEventListener('change', () => {
  currentSettings.hideShorts = shortsToggle.checked;
  saveSettings(currentSettings);
});

titlesToggle.addEventListener('change', () => {
  currentSettings.originalTitles = titlesToggle.checked;
  saveSettings(currentSettings);
});

radiusToggle.addEventListener('change', () => {
  currentSettings.removeBorderRadius = radiusToggle.checked;
  saveSettings(currentSettings);
});