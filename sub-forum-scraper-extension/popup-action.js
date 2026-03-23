chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSidebar' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Content script not available, injecting...');
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }, () => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSidebar' });
        });
      }
    });
  }
  window.close();
});
