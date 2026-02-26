// YouTube EasyTool — Page-context inject script
// Runs in the PAGE (main world) context via a <script src> tag injected by
// content.js. Must NOT use any chrome.* APIs — those are unavailable here.

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────

  let originalTitlesEnabled = false;

  // YouTube internal API paths whose JSON bodies contain the hl (language) field
  const YT_API_RE = /\/youtubei\/v1\/(browse|search|next|player|guide|reel\/reel_watch_sequence)/;

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Strip the `hl` key from a YouTube API JSON request body.
  // Checks both the top-level object and context.client (where it often lives).
  function stripHlFromBody(bodyText) {
    try {
      const obj = JSON.parse(bodyText);
      let modified = false;

      if (typeof obj.hl === 'string') {
        delete obj.hl;
        modified = true;
      }

      if (obj && obj.context && obj.context.client && typeof obj.context.client.hl === 'string') {
        delete obj.context.client.hl;
        modified = true;
      }

      return modified ? JSON.stringify(obj) : bodyText;
    } catch (_) {
      // Not JSON or parse error — leave body untouched
      return bodyText;
    }
  }

  // Validate the URL belongs to youtube.com before checking the path pattern.
  // This prevents matching a path like /youtubei/v1/browse on any other origin.
  function isYtApiUrl(url) {
    try {
      const u = new URL(typeof url === 'string' ? url : String(url));
      if (!u.hostname.endsWith('.youtube.com') && u.hostname !== 'youtube.com') return false;
      return YT_API_RE.test(u.pathname);
    } catch (_) {
      return false;
    }
  }

  // ── Patch fetch ───────────────────────────────────────────────────────────

  const _nativeFetch = window.fetch;

  window.fetch = function (input, init) {
    if (originalTitlesEnabled && init && typeof init.body === 'string') {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (isYtApiUrl(url)) {
        const newBody = stripHlFromBody(init.body);
        if (newBody !== init.body) {
          // Rebuild init rather than mutating the caller's object
          init = Object.assign({}, init, { body: newBody });
        }
      }
    }
    return _nativeFetch.apply(this, arguments.length > 1 ? [input, init] : [input]);
  };

  // ── Patch XHR ─────────────────────────────────────────────────────────────

  const _nativeOpen = XMLHttpRequest.prototype.open;
  const _nativeSend = XMLHttpRequest.prototype.send;

  // Use WeakMap to store the URL per XHR instance without polluting the object
  const xhrUrlMap = new WeakMap();

  XMLHttpRequest.prototype.open = function (method, url) {
    xhrUrlMap.set(this, url);
    return _nativeOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (originalTitlesEnabled && typeof body === 'string') {
      const url = xhrUrlMap.get(this);
      if (url && isYtApiUrl(url)) {
        const newBody = stripHlFromBody(body);
        if (newBody !== body) {
          return _nativeSend.call(this, newBody);
        }
      }
    }
    return _nativeSend.apply(this, arguments);
  };

  // ── Settings listener ─────────────────────────────────────────────────────

  // content.js communicates via CustomEvent to toggle interception on/off.
  // Validates that the detail is a plain object with a boolean originalTitles field.
  document.addEventListener('easytool-settings', (e) => {
    if (!e || !e.detail || typeof e.detail !== 'object') return;
    if (typeof e.detail.originalTitles !== 'boolean') return;
    originalTitlesEnabled = e.detail.originalTitles;
  });

  // Flag so content.js can confirm the script has loaded
  window.__easytoolInjected = true;

})();
