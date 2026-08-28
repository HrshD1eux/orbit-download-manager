// Orbit Download Manager — On-Screen Media Grabber Controller (Neat Style)
(() => {
  let mediaItems = [];
  let currentFilter = 'all';
  let container = null;
  let pillBtn = null;
  let panel = null;
  let badgeEl = null;
  let listEl = null;

  // 1. Inject in-page interceptor script into Main World
  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (_) {}
  }

  // 2. Listen to postMessages from in-page interceptor
  window.addEventListener('message', (event) => {
    if (event.data && event.data.source === 'orbit-injected-sniffer') {
      chrome.runtime.sendMessage({
        action: 'report_media_from_page',
        url: event.data.url,
        type: event.data.type,
        quality: event.data.quality,
        title: event.data.title || document.title
      });
    }
  });

  // 3. Scan DOM for media elements
  function scanMediaElements() {
    const elements = document.querySelectorAll('video, audio, source');
    elements.forEach((el) => {
      const src = el.src || el.getAttribute('src');
      if (src && src.startsWith('http')) {
        chrome.runtime.sendMessage({
          action: 'report_media_from_page',
          url: src,
          type: el.tagName.toLowerCase(),
          title: document.title
        });
      }
    });
  }

  // 4. Build & Inject On-Screen UI
  function initOnScreenUI() {
    if (window !== window.top) return;
    if (document.getElementById('orbit-onscreen-container')) return;

    container = document.createElement('div');
    container.id = 'orbit-onscreen-container';
    container.style.display = 'none';

    container.innerHTML = `
      <div id="orbit-expanded-panel">
        <div class="orbit-panel-header">
          <div class="orbit-header-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1677ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Orbit Media Grabber</span>
          </div>
          <button class="orbit-panel-close" id="orbit-panel-close-btn">&times;</button>
        </div>
        <div class="orbit-panel-tabs">
          <button class="orbit-tab-item active" data-filter="all" id="orbit-tab-all">All (0)</button>
          <button class="orbit-tab-item" data-filter="video" id="orbit-tab-video">Videos (0)</button>
          <button class="orbit-tab-item" data-filter="audio" id="orbit-tab-audio">Audio (0)</button>
          <button class="orbit-tab-item" data-filter="subtitle" id="orbit-tab-subtitle">Subtitles (0)</button>
        </div>
        <div class="orbit-panel-body" id="orbit-panel-list"></div>
      </div>
      <button id="orbit-pill-button">
        <svg class="orbit-pill-icon" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
        </svg>
        <span id="orbit-pill-text">Media Files</span>
        <span class="orbit-pill-badge" id="orbit-pill-count">0</span>
        <span class="orbit-pill-arrow">▾</span>
      </button>
    `;

    document.documentElement.appendChild(container);

    pillBtn = document.getElementById('orbit-pill-button');
    panel = document.getElementById('orbit-expanded-panel');
    badgeEl = document.getElementById('orbit-pill-count');
    listEl = document.getElementById('orbit-panel-list');

    pillBtn.onclick = () => {
      panel.classList.toggle('orbit-visible');
    };

    document.getElementById('orbit-panel-close-btn').onclick = (e) => {
      e.stopPropagation();
      panel.classList.remove('orbit-visible');
    };

    // Category Tabs Filtering
    const tabs = container.querySelectorAll('.orbit-tab-item');
    tabs.forEach((tab) => {
      tab.onclick = () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.getAttribute('data-filter') || 'all';
        renderMediaRows();
      };
    });

    // Close when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (container && !container.contains(e.target)) {
        panel.classList.remove('orbit-visible');
      }
    });
  }

  // 5. Render Stream Rows
  function renderMediaRows() {
    if (!listEl) return;

    // Update tab counts
    const videoCount = mediaItems.filter((m) => m.category === 'video').length;
    const audioCount = mediaItems.filter((m) => m.category === 'audio').length;
    const subCount = mediaItems.filter((m) => m.category === 'subtitle').length;

    const tabAll = document.getElementById('orbit-tab-all');
    const tabVideo = document.getElementById('orbit-tab-video');
    const tabAudio = document.getElementById('orbit-tab-audio');
    const tabSub = document.getElementById('orbit-tab-subtitle');

    if (tabAll) tabAll.textContent = `All (${mediaItems.length})`;
    if (tabVideo) tabVideo.textContent = `Videos (${videoCount})`;
    if (tabAudio) tabAudio.textContent = `Audio (${audioCount})`;
    if (tabSub) tabSub.textContent = `Subtitles (${subCount})`;

    const filtered = mediaItems.filter((item) => {
      if (currentFilter === 'all') return true;
      return item.category === currentFilter;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="text-align:center;color:#6c7784;padding:24px 8px;font-size:11px;">No ${currentFilter} streams found.</div>`;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'orbit-media-card';

      card.innerHTML = `
        <div class="orbit-media-info">
          <div class="orbit-media-name" title="${item.filename}">${item.filename}</div>
          <div class="orbit-media-sub">
            <span class="orbit-media-tag">${item.quality || item.typeName}</span>
            <span class="orbit-media-size">${item.sizeFormatted}</span>
          </div>
        </div>
      `;

      const dlBtn = document.createElement('button');
      dlBtn.className = 'orbit-download-trigger';
      dlBtn.textContent = 'Download';
      dlBtn.onclick = () => {
        dlBtn.textContent = 'Sending to Orbit...';
        chrome.runtime.sendMessage(
          {
            action: 'send_to_orbit',
            url: item.url,
            filename: item.filename
          },
          (res) => {
            if (res && res.success) {
              dlBtn.textContent = 'Sent to Orbit!';
              dlBtn.classList.add('orbit-success');
              dlBtn.disabled = true;
            } else {
              dlBtn.textContent = 'Launch Orbit Desktop';
              dlBtn.classList.add('orbit-error');
              setTimeout(() => {
                dlBtn.textContent = 'Download';
                dlBtn.classList.remove('orbit-error');
              }, 3000);
            }
          }
        );
      };

      card.appendChild(dlBtn);
      listEl.appendChild(card);
    });
  }

  // 6. Update UI on New Media
  function updateUI(newList) {
    mediaItems = newList;
    if (!container) initOnScreenUI();
    if (!badgeEl) return;

    badgeEl.textContent = mediaItems.length.toString();
    const pillText = document.getElementById('orbit-pill-text');
    if (pillText) {
      pillText.textContent = `${mediaItems.length} File${mediaItems.length === 1 ? '' : 's'} Found`;
    }

    renderMediaRows();
    container.style.display = mediaItems.length > 0 ? 'block' : 'none';
  }

  // Listen to background updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'orbit_media_list_updated') {
      updateUI(msg.mediaList);
    }
  });

  // Initialization
  injectMainWorldScript();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initOnScreenUI();
      scanMediaElements();
    });
  } else {
    initOnScreenUI();
    scanMediaElements();
  }

  // Watch for dynamic video player insertions
  const observer = new MutationObserver(() => scanMediaElements());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Initial fetch
  chrome.runtime.sendMessage({ action: 'get_tab_media' }, (res) => {
    if (res && res.media && res.media.length > 0) {
      updateUI(res.media);
    }
  });
})();
