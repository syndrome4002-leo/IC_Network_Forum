let sidebarOpen = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleSidebar') {
    if (!sidebarOpen) {
      injectSidebar();
      sidebarOpen = true;
    } else {
      removeSidebar();
      sidebarOpen = false;
    }
    sendResponse({ ok: true });
  }
});

const injectSidebar = () => {
  if (document.getElementById('icn-scraper-sidebar')) return;

  const sidebarHtml = `
    <div id="icn-scraper-sidebar" style="
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100vh;
      background: white;
      box-shadow: -2px 0 8px rgba(0,0,0,0.15);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      font-family: Arial, sans-serif;
    ">
      <div style="
        background: #2c3e50;
        color: white;
        padding: 12px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span>ICN Topics Scraper</span>
        <button id="icn-sidebar-close" style="
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
        ">✕</button>
      </div>
      <button id="icn-start-scrape" style="
        margin: 8px;
        padding: 8px;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      ">Start Scraping All Forums</button>
      <button id="icn-download" style="
        margin: 8px;
        padding: 8px;
        background: #27ae60;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      ">Download JSON</button>
      <div id="icn-stats" style="
        margin: 8px;
        font-size: 12px;
        color: #555;
      ">Ready</div>
      <div id="icn-log" style="
        flex: 1;
        overflow: auto;
        border: 1px solid #ddd;
        margin: 8px;
        padding: 6px;
        font-size: 11px;
        background: #f9f9f9;
        color: #333;
      "></div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', sidebarHtml);

  document.getElementById('icn-sidebar-close').addEventListener('click', () => {
    removeSidebar();
    sidebarOpen = false;
  });

  document.getElementById('icn-start-scrape').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startScrape' });
  });

  document.getElementById('icn-download').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'downloadFromStorage' });
  });

  // Listen for log messages from background
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'log') {
      const logEl = document.getElementById('icn-log');
      if (logEl) {
        logEl.textContent += request.message + '\n';
        logEl.scrollTop = logEl.scrollHeight;
      }
    }
    if (request.action === 'updateStats') {
      const statsEl = document.getElementById('icn-stats');
      if (statsEl) {
        statsEl.textContent = request.message;
      }
    }
  });

  // Request initial state
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response) {
      if (response.stats) {
        document.getElementById('icn-stats').textContent = response.stats;
      }
      if (response.logs) {
        document.getElementById('icn-log').textContent = response.logs;
      }
    }
  });
};

const removeSidebar = () => {
  const sidebar = document.getElementById('icn-scraper-sidebar');
  if (sidebar) sidebar.remove();
};
