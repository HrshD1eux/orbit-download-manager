// Orbit Download Manager — Intelligent Media Stream & Authenticated Session Engine
const ORBIT_LOCAL_URL = 'http://127.0.0.1:41718';

// Tab media registry: tabId -> array of media items
const tabMediaStore = new Map();

// Map of captured request headers per URL / Domain to defeat 403 Forbidden
const streamHeadersMap = new Map();

// Ignore noise patterns: UI audio, PWA webmanifests, tracking pixels
const IGNORE_PATTERNS = [
  '.webmanifest',
  'manifest.json',
  'browserconfig.xml',
  'favicon',
  'analytics',
  'gtag',
  'pixel',
  'sound_effect',
  'click.mp3',
  'beep.mp3',
  'ding.mp3',
  'pop.mp3',
  'open.mp3',
  'close.mp3',
  'success.mp3',
  'failure.mp3',
  'no_input.mp3',
  'error.mp3',
function isSegmentChunk(url) {
  if (!url) return false;
  const lower = url.toLowerCase();

  // Byte-range and sub-chunk stream fragments
  if (lower.includes('&range=') || lower.includes('&sq=') || lower.includes('&byterange=')) {
    return true;
  }

  // HLS / DASH / Web media segment chunks
  if (
    /(?:segment|seg|chunk|frag|piece|part|slice)[-_]?\d+\.(?:ts|m4s|mp4)/i.test(lower) ||
    /\/\d+\.(?:ts|m4s)(?:\?|$)/i.test(lower) ||
    /-\d+x\d+-\d+\.ts/i.test(lower) ||
    /_(?:[0-9]{3,})\.(?:ts|m4s)/i.test(lower) ||
    /\.ts\?.*(?:segment|frag|chunk)/i.test(lower) ||
    /\.(?:ts|m4s)$/i.test(lower.split('?')[0])
  ) {
    return true;
  }

  return false;
}

function isNoise(url, contentLength = 0) {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase();

  // Filter out segment chunks (prevents 150+ chunk spam on refresh)
  if (isSegmentChunk(url)) return true;

  // Filter out known UI and non-media patterns
  if (IGNORE_PATTERNS.some((p) => lower.includes(p))) return true;

  // Filter tiny audio files (< 100 KB) that are UI sounds
  if (contentLength > 0 && contentLength < 100 * 1024) {
    if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.aac')) {
      return true;
    }
  }

  return false;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return 'Stream';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Accurate Quality and Resolution Detector with Word Boundaries
function detectQuality(url, customQuality = null) {
  if (customQuality && typeof customQuality === 'string' && customQuality.trim()) {
    return customQuality;
  }

  const lower = url.toLowerCase();

  // 1. Stream quality tags and itags
  if (/[?&]itag=(?:313|401|2160)(?:&|$)/.test(url)) return '2160p 4K Ultra HD';
  if (/[?&]itag=(?:271|400|1440)(?:&|$)/.test(url)) return '1440p 2K QHD';
  if (/[?&]itag=(?:137|248|399|299)(?:&|$)/.test(url)) return '1080p Full HD';
  if (/[?&]itag=(?:22|136|247|298|398)(?:&|$)/.test(url)) return '720p HD';
  if (/[?&]itag=(?:135|244|397)(?:&|$)/.test(url)) return '480p SD';
  if (/[?&]itag=(?:18|134|243|396)(?:&|$)/.test(url)) return '360p SD';
  if (/[?&]itag=(?:133|242)(?:&|$)/.test(url)) return '240p';
  if (/[?&]itag=(?:160|278)(?:&|$)/.test(url)) return '144p';
  if (/[?&]itag=(?:140|251|250|249)(?:&|$)/.test(url)) return 'Audio Track (128 kbps)';

  // 2. Exact Resolution Boundaries in URL
  if (/(?:^|\D)(2160p|4k|3840x2160)(?:\D|$)/i.test(url)) return '2160p 4K Ultra HD';
  if (/(?:^|\D)(1440p|2k|2560x1440)(?:\D|$)/i.test(url)) return '1440p 2K QHD';
  if (/(?:^|\D)(1080p|1080|1920x1080)(?:\D|$)/i.test(url)) return '1080p Full HD';
  if (/(?:^|\D)(720p|720|1280x720)(?:\D|$)/i.test(url)) return '720p HD';
  if (/(?:^|\D)(480p|480|854x480|848x480)(?:\D|$)/i.test(url)) return '480p SD';
  if (/(?:^|\D)(360p|640x360)(?:\D|$)/i.test(url)) return '360p SD';
  if (/(?:^|\D)(240p|426x240)(?:\D|$)/i.test(url)) return '240p';

  // 3. Formats & Protocols
  if (lower.includes('.m3u8')) return 'HLS Master Stream (.m3u8)';
  if (lower.includes('.mpd')) return 'DASH Master Stream (.mpd)';
  if (lower.includes('.vtt') || lower.includes('.srt') || lower.includes('.ass')) return 'Subtitle Track';
  if (lower.includes('.mp3') || lower.includes('.m4a') || lower.includes('.aac') || lower.includes('.flac') || lower.includes('.ogg')) return 'Audio Track';
  if (lower.includes('.ts')) return 'Video TS Stream';
  if (lower.includes('.m4s')) return 'Video Segment';

  return 'Video Stream';
}

function sanitizeFilename(name, ext) {
  let clean = (name || 'video_stream')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length > 90) clean = clean.substring(0, 90);
  if (!clean.toLowerCase().endsWith(`.${ext}`)) {
    clean = `${clean}.${ext}`;
  }
  return clean;
}

// Clean stream URLs (removes range=... chunks from CDN streams to download full video)
function cleanStreamUrl(rawUrl) {
  let url = rawUrl;
  if (url.includes('videoplayback') || url.includes('range=')) {
    url = url.replace(/([?&])range=\d+-\d+(&|$)/, '$1').replace(/[?&]$/, '');
  }
  return url;
}

// Forward authorized media request headers to preserve session continuity
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const url = details.url;
    if (url && (url.includes('.m3u8') || url.includes('.mpd') || url.includes('.ts') || url.includes('.m4s') || url.includes('.mp4') || url.includes('videoplayback'))) {
      const headers = {};
      if (details.requestHeaders) {
        for (const h of details.requestHeaders) {
          const nameLower = h.name.toLowerCase();
          if (
            nameLower === 'cookie' ||
            nameLower === 'authorization' ||
            nameLower === 'referer' ||
            nameLower === 'origin' ||
            nameLower === 'user-agent' ||
            nameLower.startsWith('sec-ch-ua') ||
            nameLower.startsWith('x-')
          ) {
            headers[h.name] = h.value;
          }
        }
      }

      if (Object.keys(headers).length > 0) {
        streamHeadersMap.set(url, headers);
        // Also save for domain key
        try {
          const domain = new URL(url).hostname;
          streamHeadersMap.set(domain, headers);
        } catch (_) {}
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', 'extraHeaders']
);

// Parse HLS (.m3u8) Playlists to extract 1080p, 720p, 480p resolution streams
async function parseHlsStreams(tabId, m3u8Url, pageTitle = '') {
  try {
    const customHeaders = streamHeadersMap.get(m3u8Url) || {};
    const resp = await fetch(m3u8Url, {
      headers: customHeaders
    });
    if (!resp.ok) return;
    const text = await resp.text();
    if (!text.includes('#EXTM3U')) return;

    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        let resolutionLabel = '';
        let bandwidthLabel = '';

        const resMatch = line.match(/RESOLUTION=(\d+x\d+)/i);
        if (resMatch && resMatch[1]) {
          const height = resMatch[1].split('x')[1];
          resolutionLabel = `${height}p`;
        }
        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
        if (bwMatch && bwMatch[1]) {
          bandwidthLabel = `${Math.round(parseInt(bwMatch[1], 10) / 1000)} kbps`;
        }

        // Next line is sub-playlist URL
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && !nextLine.startsWith('#')) {
            let subUrl = nextLine;
            if (!subUrl.startsWith('http')) {
              const base = new URL(m3u8Url);
              subUrl = new URL(subUrl, base).toString();
            }

            // Copy auth headers for subUrl
            if (Object.keys(customHeaders).length > 0) {
              streamHeadersMap.set(subUrl, customHeaders);
            }

            const qualityText = resolutionLabel ? `${resolutionLabel} HD (HLS)` : `HLS Stream (${bandwidthLabel})`;
            const title = pageTitle ? `${pageTitle} - ${qualityText}` : `Video - ${qualityText}`;
            registerMedia(tabId, subUrl, 0, '', title, qualityText);
          }
        }
      } else if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO') || line.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES')) {
        const isSub = line.includes('TYPE=SUBTITLES');
        const uriMatch = line.match(/URI=["']([^"']+)["']/i);
        const nameMatch = line.match(/NAME=["']([^"']+)["']/i);
        const label = nameMatch ? nameMatch[1] : isSub ? 'Subtitles' : 'Audio Track';

        if (uriMatch && uriMatch[1]) {
          let mediaUri = uriMatch[1];
          if (!mediaUri.startsWith('http')) {
            const base = new URL(m3u8Url);
            mediaUri = new URL(mediaUri, base).toString();
          }

          if (Object.keys(customHeaders).length > 0) {
            streamHeadersMap.set(mediaUri, customHeaders);
          }

          const qualityText = isSub ? `Subtitle (${label})` : `Audio (${label})`;
          const title = pageTitle ? `${pageTitle} - ${label}` : label;
          registerMedia(tabId, mediaUri, 0, '', title, qualityText);
        }
      }
    }
  } catch (_) {}
}

function registerMedia(tabId, url, contentLength = 0, contentDisposition = '', customTitle = '', customQuality = '') {
  if (!tabId || tabId < 0 || !url || !url.startsWith('http')) return null;
  if (isNoise(url, contentLength)) return null;

  if (!tabMediaStore.has(tabId)) {
    tabMediaStore.set(tabId, []);
  }

  const mediaList = tabMediaStore.get(tabId);
  const fullUrl = cleanStreamUrl(url.split('#')[0]);

  // Avoid duplicate stream registrations
  const exists = mediaList.some((m) => m.url === fullUrl);
  if (exists) return null;

  const urlLower = fullUrl.toLowerCase();
  let category = 'video';
  let typeName = 'Video';
  let ext = 'mp4';

  if (urlLower.includes('.vtt') || urlLower.includes('.srt') || urlLower.includes('.ass') || (customQuality && customQuality.toLowerCase().includes('subtitle'))) {
    category = 'subtitle';
    typeName = 'Subtitle';
    ext = 'vtt';
  } else if (
    urlLower.includes('.mp3') ||
    urlLower.includes('.m4a') ||
    urlLower.includes('.aac') ||
    urlLower.includes('.flac') ||
    urlLower.includes('.ogg') ||
    urlLower.includes('.opus') ||
    urlLower.includes('itag=140') ||
    urlLower.includes('itag=251') ||
    (customQuality && customQuality.toLowerCase().includes('audio'))
  ) {
    category = 'audio';
    typeName = 'Audio Track';
    ext = 'mp3';
  } else if (urlLower.includes('.ts')) {
    typeName = 'TS Stream';
    ext = 'ts';
  } else if (urlLower.includes('.m3u8')) {
    typeName = 'HLS Master Stream';
    ext = 'mp4';
    // Async parse sub-streams
    parseHlsStreams(tabId, fullUrl, customTitle);
  } else if (urlLower.includes('.mpd')) {
    typeName = 'DASH Master Stream';
    ext = 'mp4';
  }

  const quality = detectQuality(fullUrl, customQuality);
  const rawTitle = customTitle || typeName;
  const filename = sanitizeFilename(rawTitle, ext);

  const mediaItem = {
    id: Math.random().toString(36).substring(7),
    url: fullUrl,
    filename,
    category,
    typeName,
    quality,
    sizeFormatted: formatBytes(contentLength),
    sizeBytes: contentLength,
    timestamp: Date.now()
  };

  mediaList.push(mediaItem);

  // Update extension toolbar badge
  chrome.action.setBadgeText({
    text: mediaList.length.toString(),
    tabId
  });
  chrome.action.setBadgeBackgroundColor({
    color: '#0067c0',
    tabId
  });

  // Notify on-screen widget in tab instantly
  chrome.tabs.sendMessage(tabId, {
    action: 'orbit_media_list_updated',
    mediaList,
    totalCount: mediaList.length
  }).catch(() => {});

  return mediaItem;
}

// 1. WebRequest Network Sniffer
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const tabId = details.tabId;
    if (!tabId || tabId < 0) return;

    let contentType = '';
    let contentLength = 0;
    let contentDisposition = '';

    if (details.responseHeaders) {
      for (const h of details.responseHeaders) {
        const name = h.name.toLowerCase();
        if (name === 'content-type') contentType = (h.value || '').toLowerCase();
        if (name === 'content-length') contentLength = parseInt(h.value || '0', 10);
        if (name === 'content-disposition') contentDisposition = h.value || '';
      }
    }

    const urlLower = details.url.toLowerCase();

    // Check if noise first
    if (isNoise(details.url, contentLength)) return;

    const isTargetMedia =
      contentType.startsWith('video/') ||
      contentType.startsWith('audio/') ||
      contentType.includes('mpegurl') ||
      contentType.includes('dash+xml') ||
      contentType.includes('text/vtt') ||
      contentType.includes('mp2t') ||
      urlLower.includes('.m3u8') ||
      urlLower.includes('.mpd') ||
      urlLower.includes('.mp4') ||
      urlLower.includes('.m4s') ||
      urlLower.includes('.ts') ||
      urlLower.includes('.webm') ||
      urlLower.includes('.mkv') ||
      urlLower.includes('videoplayback');

    if (isTargetMedia) {
      registerMedia(tabId, details.url, contentLength, contentDisposition);
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// 2. Intercept browser direct file downloads (software/archives only - not video stream chunks)
chrome.downloads.onCreated.addListener((downloadItem) => {
  const directDownloadExts = ['.iso', '.zip', '.rar', '.7z', '.tar.gz', '.exe', '.msi', '.dmg', '.pkg'];
  const urlLower = downloadItem.url.toLowerCase();
  const fileLower = (downloadItem.filename || '').toLowerCase();

  // Never auto-intercept segment chunks or blob streams
  if (isSegmentChunk(downloadItem.url) || urlLower.startsWith('blob:') || urlLower.startsWith('data:')) {
    return;
  }

  const isDirectFile = directDownloadExts.some((ext) => urlLower.includes(ext) || fileLower.endsWith(ext));

  if (isDirectFile) {
    chrome.downloads.cancel(downloadItem.id, () => {
      sendToOrbit(downloadItem.url, downloadItem.filename || '');
    });
  }
});

// 3. Message Routing & SPA Page Navigation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = request.tabId || sender.tab?.id;

  if (request.action === 'page_navigated') {
    // When switching media on SPA dynamic route navigation, reset media for new video
    if (tabId) {
      tabMediaStore.set(tabId, []);
      chrome.action.setBadgeText({ text: '', tabId });
      chrome.tabs.sendMessage(tabId, { action: 'orbit_media_list_updated', mediaList: [], totalCount: 0 }).catch(() => {});
    }
    sendResponse({ success: true });
  } else if (request.action === 'report_media_from_page') {
    if (tabId) {
      registerMedia(tabId, request.url, 0, '', request.title, request.quality);
    }
    sendResponse({ success: true });
  } else if (request.action === 'get_tab_media') {
    const media = tabMediaStore.get(tabId) || [];
    sendResponse({ media, totalCount: media.length });
  } else if (request.action === 'send_to_orbit') {
    const referer = sender.tab?.url || '';
    sendToOrbit(request.url, request.filename, referer)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.toString() }));
    return true; // async response
  } else if (request.action === 'check_orbit_connection') {
    fetch(`${ORBIT_LOCAL_URL}/ping`)
      .then((r) => r.json())
      .then((data) => sendResponse({ online: true, data }))
      .catch(() => sendResponse({ online: false }));
    return true; // async response
  }
  return true;
});

// 4. Send directly to Orbit Desktop daemon with authenticated session headers & cookies
async function sendToOrbit(url, filename, referer = '') {
  try {
    // 1. Gather captured request headers
    let headers = streamHeadersMap.get(url) || {};

    if (Object.keys(headers).length === 0) {
      try {
        const domain = new URL(url).hostname;
        headers = streamHeadersMap.get(domain) || {};
      } catch (_) {}
    }

    // 2. If Cookie header is not captured, fetch live cookies for the domain
    if (!headers['Cookie'] && !headers['cookie']) {
      try {
        const targetCookies = await chrome.cookies.getAll({ url });
        if (targetCookies && targetCookies.length > 0) {
          const cookieStr = targetCookies.map((c) => `${c.name}=${c.value}`).join('; ');
          headers['Cookie'] = cookieStr;
        } else if (referer) {
          const refererCookies = await chrome.cookies.getAll({ url: referer });
          if (refererCookies && refererCookies.length > 0) {
            const cookieStr = refererCookies.map((c) => `${c.name}=${c.value}`).join('; ');
            headers['Cookie'] = cookieStr;
          }
        }
      } catch (_) {}
    }

    if (referer && !headers['Referer'] && !headers['referer']) {
      headers['Referer'] = referer;
    }

    if (!headers['User-Agent'] && !headers['user-agent']) {
      headers['User-Agent'] = navigator.userAgent;
    }

    const response = await fetch(`${ORBIT_LOCAL_URL}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Orbit-Client': 'orbit-web-extension'
      },
      body: JSON.stringify({
        url: cleanStreamUrl(url),
        filename: filename || undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined
      })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
    return { success: false, error: 'Orbit returned an error' };
  } catch (err) {
    return { success: false, error: 'Orbit desktop is offline. Please launch Orbit Download Manager.' };
  }
}

// Cleanup closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaStore.delete(tabId);
});
