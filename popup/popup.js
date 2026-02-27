// YouTube EasyTool — Popup Script

// Scale the popup proportionally to the physical screen size so it feels
// the same on every monitor (1080p → 1×, 1440p → 1.15×, 4K → 1.33×).
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
};

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 8;

// DOM refs — Grid
const gridToggle = document.getElementById('grid-toggle');
const columnSlider = document.getElementById('column-slider');
const columnValue = document.getElementById('column-value');
const sliderSection = document.getElementById('slider-section');

// DOM refs — new features
const shortsToggle = document.getElementById('shorts-toggle');
const titlesToggle = document.getElementById('titles-toggle');

// ── Helpers ───────────────────────────────────────────────────────────────

function saveSettings(settings) {
  chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
    if (chrome.runtime.lastError) {
      console.error('[EasyTool] Storage write failed:', chrome.runtime.lastError.message);
    }
  });
}

// Update the slider's red-fill track via a CSS custom property
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

  // New features
  shortsToggle.checked = settings.hideShorts;
  titlesToggle.checked = settings.originalTitles;
}

// ── Initialization ────────────────────────────────────────────────────────

// Load stored settings (or defaults) when the popup opens
chrome.storage.sync.get(STORAGE_KEY, (result) => {
  if (chrome.runtime.lastError) {
    console.error('[EasyTool] Storage read failed:', chrome.runtime.lastError.message);
    applyUIState(DEFAULT_SETTINGS);
    return;
  }
  const settings = Object.assign({}, DEFAULT_SETTINGS, result[STORAGE_KEY]);
  applyUIState(settings);
});

// ── Event listeners ───────────────────────────────────────────────────────

// Grid toggle
gridToggle.addEventListener('change', () => {
  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    if (chrome.runtime.lastError) return;
    const settings = Object.assign({}, DEFAULT_SETTINGS, result[STORAGE_KEY]);
    settings.gridEnabled = gridToggle.checked;
    saveSettings(settings);
    applyUIState(settings);
  });
});

// Grid slider: live update as the user drags (real-time feedback on the page)
columnSlider.addEventListener('input', () => {
  let val = parseInt(columnSlider.value, 10);
  if (isNaN(val)) val = DEFAULT_SETTINGS.gridColumns;
  val = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, val));

  columnValue.textContent = val;
  updateSliderFill(columnSlider);

  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    if (chrome.runtime.lastError) return;
    const settings = Object.assign({}, DEFAULT_SETTINGS, result[STORAGE_KEY]);
    settings.gridColumns = val;
    saveSettings(settings);
  });
});

// Hide Shorts toggle
shortsToggle.addEventListener('change', () => {
  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    if (chrome.runtime.lastError) return;
    const settings = Object.assign({}, DEFAULT_SETTINGS, result[STORAGE_KEY]);
    settings.hideShorts = shortsToggle.checked;
    saveSettings(settings);
  });
});

// Original Titles toggle
titlesToggle.addEventListener('change', () => {
  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    if (chrome.runtime.lastError) return;
    const settings = Object.assign({}, DEFAULT_SETTINGS, result[STORAGE_KEY]);
    settings.originalTitles = titlesToggle.checked;
    saveSettings(settings);
  });
});
