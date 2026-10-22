// Orbit Media Stream Deep Extractor (Runs in Main Page World)
(() => {
  const STREAM_EXTENSIONS = ['.m3u8', '.mpd', '.mp4', '.m4s', '.ts', '.webm', '.mkv', '.flv', '.m4a', '.mp3', '.aac', '.ogg', '.opus', '.vtt', '.srt', '.ass'];
  const IGNORE_PATTERNS = ['.webmanifest', 'manifest.json', 'browserconfig.xml', 'analytics', 'gtag', 'pixel', 'favicon', 'sound_effect', 'click.mp3', 'beep.mp3', 'notification.mp3'];

  function isIgnored(url) {
    if (!url || typeof url !== 'string') return true;
    const lower = url.toLowerCase();
    return IGNORE_PATTERNS.some((p) => lower.includes(p));
  }

  function getCleanPageTitle() {
    let title = document.title || '';
    // Strip common trailing website branding cleanly without hardcoding third-party trademarks
    title = title.replace(/\s*[-–|•]\s*[^|–•-]+$/i, '').trim();
    if (!title) {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) title = ogTitle.trim();
    }
    if (!title) {
      const h1 = document.querySelector('h1')?.innerText;
      if (h1 && h1.length < 80) title = h1.trim();
    }
    return title || 'Media_Stream';
  }

  function reportMedia(url, type, qualityHint = null, customTitle = null) {
    if (!url || typeof url !== 'string' || !url.startsWith('http') || isIgnored(url)) return;
    
    window.postMessage(
      {
        source: 'orbit-injected-sniffer',
        url,
        type: type || 'stream',
        quality: qualityHint,
        title: customTitle || getCleanPageTitle()
      },
      '*'
    );
  }

  // 1. Generic HTML5 & Web Player Data Extractor
  function extractPlayerConfigStreams() {
    try {
      // Generic JSON State Containers (Next.js, Nuxt, Redux, React state)
      const stateObj = window.__INITIAL_STATE__ || window.__NEXT_DATA__ || window.__NUXT__;
      if (stateObj) {
        const jsonStr = JSON.stringify(stateObj);
        const m3u8Matches = jsonStr.match(/https?:\/\/[^"'\s\\]+?\.(?:m3u8|mpd|mp4)[^"'\s\\]*/gi);
        if (m3u8Matches) {
          m3u8Matches.forEach((mUrl) => {
            const cleanUrl = mUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
            reportMedia(cleanUrl, 'video', null, getCleanPageTitle());
          });
        }
      }

      // Check standard web player frameworks (Video.js, Hls.js, Dash.js, Plyr)
      if (window.hls && window.hls.url) {
        reportMedia(window.hls.url, 'video', 'HLS Master Stream', `${getCleanPageTitle()} - HLS Master`);
      }
      if (window.player && typeof window.player.currentSrc === 'function') {
        const pSrc = window.player.currentSrc();
        if (pSrc && typeof pSrc === 'string' && pSrc.startsWith('http')) {
          reportMedia(pSrc, 'video', null, getCleanPageTitle());
        }
      }
    } catch (_) {}
  }

  // 3. Hook Fetch API
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (url && typeof url === 'string') {
        const lower = url.toLowerCase();
        if (STREAM_EXTENSIONS.some((ext) => lower.includes(ext)) || lower.includes('/video/') || lower.includes('/audio/')) {
          reportMedia(url, 'fetch');
        }
      }
    } catch (_) {}
    return originalFetch.apply(this, args);
  };

  // 4. Hook XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      if (typeof url === 'string') {
        const lower = url.toLowerCase();
        if (STREAM_EXTENSIONS.some((ext) => lower.includes(ext)) || lower.includes('/video/') || lower.includes('/audio/')) {
          reportMedia(url, 'xhr');
        }
      }
    } catch (_) {}
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  // 5. Hook HTMLMediaElement (Video, Audio, Track subtitles)
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    try {
      const src = this.src || this.currentSrc;
      if (src && src.startsWith('http')) {
        reportMedia(src, this.tagName.toLowerCase());
      }
      // Scan subtitle tracks
      if (this.querySelectorAll) {
        this.querySelectorAll('track').forEach((t) => {
          if (t.src && t.src.startsWith('http')) {
            reportMedia(t.src, 'subtitle', `Subtitle (${t.label || t.srclang || 'VTT'})`, `${getCleanPageTitle()} - ${t.label || 'Subtitles'}`);
          }
        });
      }
    } catch (_) {}
    return originalPlay.apply(this, arguments);
  };

  // 6. Hook SPA Dynamic Route Changes
  function notifyNavigation() {
    window.postMessage({ source: 'orbit-injected-sniffer', action: 'page_navigated', title: document.title }, '*');
    setTimeout(scanPage, 500);
    setTimeout(scanPage, 1500);
  }

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    notifyNavigation();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    notifyNavigation();
  };

  window.addEventListener('popstate', notifyNavigation);

  // 7. Periodic & Event Scraper
  function scanPage() {
    extractPlayerConfigStreams();

    // Check all video / audio elements in DOM
    document.querySelectorAll('video, audio').forEach((el) => {
      const src = el.src || el.currentSrc || el.getAttribute('src');
      if (src && src.startsWith('http')) {
        reportMedia(src, el.tagName.toLowerCase());
      }
      el.querySelectorAll('source').forEach((s) => {
        const sSrc = s.src || s.getAttribute('src');
        if (sSrc && sSrc.startsWith('http')) {
          reportMedia(sSrc, 'source');
        }
      });
      el.querySelectorAll('track').forEach((t) => {
        const tSrc = t.src || t.getAttribute('src');
        if (tSrc && tSrc.startsWith('http')) {
          reportMedia(tSrc, 'subtitle', `Subtitle (${t.label || t.srclang || 'VTT'})`, `${getCleanPageTitle()} - ${t.label || 'Subtitles'}`);
        }
      });
    });
  }

  // Run scans immediately on page load
  window.addEventListener('load', scanPage);
  document.addEventListener('DOMContentLoaded', scanPage);
  setInterval(scanPage, 2000);
})();
