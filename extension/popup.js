document.addEventListener('DOMContentLoaded', async () => {
  let allMedia = [];
  let currentTab = 'all';

  const statusBadge = document.getElementById('connectionStatus');
  const statusText = document.getElementById('statusText');
  const mediaListContainer = document.getElementById('mediaList');
  const tabButtons = document.querySelectorAll('.tab-btn');

  // Check Orbit Desktop Connection
  chrome.runtime.sendMessage({ action: 'check_orbit_connection' }, (res) => {
    if (res && res.online) {
      statusBadge.className = 'status-badge status-online';
      statusText.textContent = 'Orbit Connected';
    } else {
      statusBadge.className = 'status-badge status-offline';
      statusText.textContent = 'Orbit Offline';
    }
  });

  // Tab Filtering
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.getAttribute('data-tab') || 'all';
      renderMedia();
    });
  });

  // Fetch Media for Active Tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  chrome.runtime.sendMessage({ action: 'get_tab_media', tabId: tab.id }, (res) => {
    if (res && res.media) {
      allMedia = res.media;
      renderMedia();
    }
  });

  function renderMedia() {
    if (!mediaListContainer) return;

    const filtered = allMedia.filter((item) => {
      if (currentTab === 'all') return true;
      return item.category === currentTab;
    });

    if (filtered.length === 0) {
      mediaListContainer.innerHTML = `<div class="empty-state">No ${currentTab === 'all' ? 'media' : currentTab} streams detected on this tab.</div>`;
      return;
    }

    mediaListContainer.innerHTML = '';
    filtered.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'media-item';

      const meta = document.createElement('div');
      meta.className = 'media-meta';

      const title = document.createElement('div');
      title.className = 'media-title';
      title.textContent = item.filename;
      title.title = item.filename;

      const sub = document.createElement('div');
      sub.className = 'media-sub';

      const badge = document.createElement('span');
      badge.className = 'media-badge';
      badge.textContent = item.quality || item.typeName;

      const size = document.createElement('span');
      size.textContent = item.sizeFormatted;

      sub.appendChild(badge);
      sub.appendChild(size);

      meta.appendChild(title);
      meta.appendChild(sub);

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Download';
      btn.onclick = () => {
        btn.textContent = 'Sending...';
        chrome.runtime.sendMessage(
          {
            action: 'send_to_orbit',
            url: item.url,
            filename: item.filename
          },
          (response) => {
            if (response && response.success) {
              btn.textContent = 'Sent to Orbit!';
              btn.classList.add('sent');
              btn.disabled = true;
            } else {
              btn.textContent = 'Orbit Offline';
              setTimeout(() => {
                btn.textContent = 'Download';
              }, 2500);
            }
          }
        );
      };

      row.appendChild(meta);
      row.appendChild(btn);
      mediaListContainer.appendChild(row);
    });
  }
});
