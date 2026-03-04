// YouTube EasyTool — Page-context inject script
// Runs in the PAGE (main world) context via a <script src> tag injected by
// content.js. Must NOT use any chrome.* APIs — those are unavailable here.

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────

  // Read the persisted setting immediately so the fetch/XHR patches below are
  // active before YouTube fires its first API call (document_start timing).
  let originalTitlesEnabled = false;
  try { originalTitlesEnabled = localStorage.getItem('easytool-original-titles') === 'true'; } catch (_) {}

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

      if (obj && obj.context && obj.context.client) {
        const client = obj.context.client;
        if (typeof client.hl === 'string')              { delete client.hl;              modified = true; }
        if (typeof client.acceptLanguage === 'string')  { delete client.acceptLanguage;  modified = true; }
        if (typeof client.browserLanguage === 'string') { delete client.browserLanguage; modified = true; }
      }

      return modified ? JSON.stringify(obj) : bodyText;
    } catch (_) {
      // Not JSON or parse error — leave body untouched
      return bodyText;
    }
  }

  // Validate the URL belongs to youtube.com before checking the path pattern.
  function isYtApiUrl(url) {
    try {
      const u = new URL(typeof url === 'string' ? url : String(url));
      if (!u.hostname.endsWith('.youtube.com') && u.hostname !== 'youtube.com') return false;
      return YT_API_RE.test(u.pathname);
    } catch (_) {
      return false;
    }
  }

  // Strip `hl` from the URL query string (YouTube search passes it there too).
  function stripHlFromUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      if (!u.searchParams.has('hl')) return urlStr;
      u.searchParams.delete('hl');
      return u.toString();
    } catch (_) {
      return urlStr;
    }
  }

  // ── Patch fetch ───────────────────────────────────────────────────────────

  const _nativeFetch = window.fetch;

  window.fetch = function (input, init) {
    if (originalTitlesEnabled) {
      const rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
      if (isYtApiUrl(rawUrl)) {
        // Strip hl from URL query params
        const cleanUrl = stripHlFromUrl(rawUrl);
        if (cleanUrl !== rawUrl) {
          input = cleanUrl;
        }
        // Strip hl from request body
        if (init && typeof init.body === 'string') {
          const newBody = stripHlFromBody(init.body);
          if (newBody !== init.body) {
            init = Object.assign({}, init, { body: newBody });
          }
        }
      }
    }
    return _nativeFetch.apply(this, arguments.length > 1 ? [input, init] : [input]);
  };

  // ── Patch XHR ─────────────────────────────────────────────────────────────

  const _nativeOpen = XMLHttpRequest.prototype.open;
  const _nativeSend = XMLHttpRequest.prototype.send;

  // Use WeakMap to store the cleaned URL per XHR instance without polluting the object
  const xhrUrlMap = new WeakMap();

  XMLHttpRequest.prototype.open = function (method, url) {
    const cleanUrl = (originalTitlesEnabled && isYtApiUrl(url)) ? stripHlFromUrl(url) : url;
    xhrUrlMap.set(this, cleanUrl);
    return _nativeOpen.call(this, method, cleanUrl, ...Array.prototype.slice.call(arguments, 2));
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

  // ── oEmbed-based title fix ─────────────────────────────────────────────────
  //
  // YouTube translates titles server-side using the HTTP Accept-Language header,
  // which JavaScript cannot override. As a fallback, we query YouTube's public
  // oEmbed endpoint for each video container element, which always returns the
  // canonical original-language title, and replace the displayed text.
  //
  // Uses _nativeFetch so these calls bypass our own hl-stripping patch.

  const _oemCache   = new Map(); // videoId → original title string
  const _oemPending = new Set(); // video IDs currently being fetched

  // All video container element types used by YouTube's Polymer UI.
  // Different pages use different container types:
  //   Home page grid:      ytd-rich-item-renderer
  //   Search results:      ytd-video-renderer
  //   Sidebar / Up Next:   ytd-compact-video-renderer
  //   Channel grid:        ytd-grid-video-renderer
  //   Playlist view:       ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer
  //   New card UI:         yt-lockup-view-model
  const VIDEO_CONTAINER_TAGS = [
    'ytd-video-renderer',
    'ytd-rich-item-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-playlist-panel-video-renderer',
    'yt-lockup-view-model',
  ];

  const VIDEO_CONTAINER_SELECTOR = VIDEO_CONTAINER_TAGS.join(',');

  function _extractVideoId(container) {
    const a = container.querySelector('a[href*="watch?v="]') ||
              container.querySelector('a[href*="/shorts/"]');
    if (!a) return null;
    const href = a.href || '';
    let m = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // Find the title text element within a video container.
  // YouTube uses different elements across different container/UI types.
  function _findTitleEl(container) {
    return container.querySelector('#video-title') ||
           container.querySelector('yt-formatted-string#video-title') ||
           container.querySelector('a.yt-lockup-metadata-view-model__title') ||
           container.querySelector('.yt-lockup-metadata-view-model-wiz__title > .yt-core-attributed-string') ||
           container.querySelector('#video-title-link');
  }

  function _applyTitle(container, title) {
    const el = _findTitleEl(container);
    if (!el || !el.isConnected) return;

    // Use innerText for comparison — it reflects the visible rendered text
    const current = (el.innerText || el.textContent || '').trim();
    if (current === title) return;

    el.innerText = title;
    // Also update the title attribute (shown on hover) if it's already set
    if (el.hasAttribute('title')) el.setAttribute('title', title);

    // Update the separate link element's title attribute if present
    const link = container.querySelector('a#video-title-link');
    if (link && link.hasAttribute('title')) link.setAttribute('title', title);
  }

  function _fetchOembed(videoId) {
    if (_oemPending.has(videoId)) return;
    _oemPending.add(videoId);
    _nativeFetch(
      'https://www.youtube.com/oembed?url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + videoId) +
      '&format=json'
    )
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        _oemPending.delete(videoId);
        if (!d || typeof d.title !== 'string') return;
        _oemCache.set(videoId, d.title);
        // Apply to every visible container that shows this video
        document.querySelectorAll(VIDEO_CONTAINER_SELECTOR).forEach(function (c) {
          if (_extractVideoId(c) === videoId) _applyTitle(c, d.title);
        });
      })
      .catch(function () { _oemPending.delete(videoId); });
  }

  function _processContainer(container) {
    if (!originalTitlesEnabled) return;
    const vid = _extractVideoId(container);
    if (!vid) return;
    if (_oemCache.has(vid)) {
      _applyTitle(container, _oemCache.get(vid));
    } else {
      _fetchOembed(vid);
    }
  }

  // Scan all video containers currently in the DOM.
  function _rescanAll() {
    setTimeout(function () {
      document.querySelectorAll(VIDEO_CONTAINER_SELECTOR).forEach(_processContainer);
    }, 150);
  }

  let _rendererObs = null;

  function _startRendererObs() {
    if (!_rendererObs) {
      _rendererObs = new MutationObserver(function (mutations) {
        if (!originalTitlesEnabled) return;
        for (var i = 0; i < mutations.length; i++) {
          var added = mutations[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (node.nodeType !== 1) continue;
            if (VIDEO_CONTAINER_TAGS.indexOf(node.localName) !== -1) {
              // Delay slightly so Polymer can set the data property first
              (function (n) { setTimeout(function () { _processContainer(n); }, 50); }(node));
            } else if (typeof node.querySelectorAll === 'function') {
              var nested = node.querySelectorAll(VIDEO_CONTAINER_SELECTOR);
              for (var k = 0; k < nested.length; k++) {
                (function (n) { setTimeout(function () { _processContainer(n); }, 50); }(nested[k]));
              }
            }
          }
        }
      });
      // Observe document (not body) so this works at document_start before body exists
      _rendererObs.observe(document, { childList: true, subtree: true });
    }
    // Always rescan existing containers — needed on SPA navigation where the
    // observer may already be running but new content has been swapped in.
    _rescanAll();
  }

  function _stopRendererObs() {
    if (_rendererObs) {
      _rendererObs.disconnect();
      _rendererObs = null;
    }
  }

  // ── Settings listener ─────────────────────────────────────────────────────

  // content.js communicates via CustomEvent to toggle interception on/off.
  // Validates that the detail is a plain object with a boolean originalTitles field.
  document.addEventListener('easytool-settings', function (e) {
    if (!e || !e.detail || typeof e.detail !== 'object') return;
    if (typeof e.detail.originalTitles !== 'boolean') return;
    originalTitlesEnabled = e.detail.originalTitles;
    if (originalTitlesEnabled) {
      _startRendererObs();
    } else {
      _stopRendererObs();
    }
  });

  // Start the renderer observer immediately if the setting is already active
  // (persisted from the previous page load via localStorage).
  if (originalTitlesEnabled) {
    _startRendererObs();
  }

})();
