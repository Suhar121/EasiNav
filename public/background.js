// background.js
chrome.commands.onCommand.addListener((command) => {
  if (command === "quick-save") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url) {
        // Save to local storage
        chrome.storage.local.get(['savedLinks'], (result) => {
          if (chrome.runtime.lastError) {
            return;
          }

          const existing = Array.isArray(result.savedLinks) ? result.savedLinks : [];
          const nextItem = {
            id: Date.now().toString(),
            title: activeTab.title || 'Untitled',
            url: activeTab.url,
            createdAt: new Date().toISOString()
          };

          const deduped = [
            nextItem,
            ...existing.filter((link) => link && typeof link.url === 'string' && link.url !== nextItem.url)
          ].slice(0, 500);

          chrome.storage.local.set({ savedLinks: deduped }, () => {
            if (chrome.runtime.lastError) {
              return;
            }
            console.log('Tab saved automatically!');
            // Optional: send message to new tab if open to update UI
          });
        });
      }
    });
  }
});
