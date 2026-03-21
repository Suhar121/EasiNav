// background.js
chrome.commands.onCommand.addListener((command) => {
  if (command === "quick-save") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url) {
        // Save to local storage
        chrome.storage.local.get(['savedLinks'], (result) => {
          const links = result.savedLinks || [];
          links.push({
            id: Date.now().toString(),
            title: activeTab.title || 'Untitled',
            url: activeTab.url,
            createdAt: new Date().toISOString()
          });
          chrome.storage.local.set({ savedLinks: links }, () => {
            console.log('Tab saved automatically!');
            // Optional: send message to new tab if open to update UI
          });
        });
      }
    });
  }
});
