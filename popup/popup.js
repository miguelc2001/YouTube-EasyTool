// YouTube EasyTool — Popup Script

(function scaleToMonitor() {
  const physW = window.screen.width * (window.devicePixelRatio || 1);
  const scale = physW >= 3840 ? 1.33 : physW >= 2560 ? 1.15 : 1;
  if (scale > 1) document.documentElement.style.zoom = String(scale);
}());

const STORAGE_KEY = 'settings';

const DEFAULT_SETTINGS = {
  gridEnabled: true,
  gridColumns: 4,
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

// DOM refs — Grid
const gridToggle = document.getElementById('grid-toggle');
const columnSlider = document.getElementById('column-slider');
const columnValue = document.getElementById('column-value');
const sliderSection = document.getElementById('slider-section');

// DOM refs — Sidebar thumbnails
const thumbnailSliderSection = document.getElementById('thumbnail-slider-section');
const thumbnailSlider = document.getElementById('thumbnail-slider');
const thumbnailValue = document.getElementById('thumbnail-value');

// DOM refs — Features
const shortsToggle = document.getElementById('shorts-toggle');
const titlesToggle = document.getElementById('titles-toggle');
const radiusToggle = document.getElementById('radius-toggle');

// ── Helpers ───────────────────────────────────────────────────────────────

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
  // Grid
  gridToggle.checked = settings.gridEnabled;
  columnSlider.value = settings.gridColumns;
  columnValue.textContent = settings.gridColumns;
  updateSliderFill(columnSlider);
  sliderSection.classList.toggle('disabled', !settings.gridEnabled);
  columnSlider.disabled = !settings.gridEnabled;

  // Sidebar thumbnails
  const displaySize = settings.savedThumbnailSize ?? settings.sidebarThumbnailSize;
  thumbnailSlider.value = displaySize;
  thumbnailValue.textContent = displaySize + '%';
  updateSliderFill(thumbnailSlider);
  thumbnailSliderSection.classList.toggle('disabled', !settings.gridEnabled);
  thumbnailSlider.disabled = !settings.gridEnabled;

  // Toggles
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
    return;
  }
  currentSettings = Object.assign({}, DEFAULT_SETTINGS, result[STORAGE_KEY]);
  applyUIState(currentSettings);
});

// ── Event listeners ───────────────────────────────────────────────────────

gridToggle.addEventListener('change', () => {
  currentSettings.gridEnabled = gridToggle.checked;
  if (!currentSettings.gridEnabled) {
    currentSettings.savedThumbnailSize = currentSettings.sidebarThumbnailSize;
    currentSettings.sidebarThumbnailSize = 100;
  } else {
    currentSettings.sidebarThumbnailSize = currentSettings.savedThumbnailSize;
  }
  saveSettings(currentSettings);
  applyUIState(currentSettings);
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