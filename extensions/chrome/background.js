// Background Service Worker

const API_BASE_URL = 'https://rag-starter-kit.vercel.app'; // Configurable

// Context menu for selected text
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rag-ask',
    title: 'Ask RAG about this',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'rag-save-page',
    title: 'Save page to RAG',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'rag-summarize',
    title: 'Summarize with RAG',
    contexts: ['page'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'rag-ask':
      openSidePanelWithQuery(info.selectionText);
      break;
    case 'rag-save-page':
      savePageToRAG(tab.url, tab.title);
      break;
    case 'rag-summarize':
      summarizePage(tab.url, tab.title);
      break;
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open_side_panel') {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  } else if (command === 'quick_ask') {
    getSelectedText().then((text) => {
      if (text) {
        openSidePanelWithQuery(text);
      }
    });
  }
});

// Open side panel with query
async function openSidePanelWithQuery(query) {
  await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  
  // Send message to side panel
  setTimeout(() => {
    chrome.runtime.sendMessage({
      action: 'setQuery',
      query: query,
    });
  }, 100);
}

// Get selected text from active tab
async function getSelectedText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection().toString(),
  });

  return results[0]?.result;
}

// Save page to RAG
async function savePageToRAG(url, title) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify({
        type: 'url',
        url: url,
        metadata: {
          title: title,
          source: 'chrome-extension',
        },
      }),
    });

    if (response.ok) {
      showNotification('Page saved', `Saved "${title}" to your knowledge base`);
    } else {
      showNotification('Error', 'Failed to save page');
    }
  } catch (error) {
    console.error('Failed to save page:', error);
    showNotification('Error', 'Failed to save page');
  }
}

// Summarize page
async function summarizePage(url, title) {
  openSidePanelWithQuery(`Summarize this page: ${url}`);
}

// Get auth token from storage
async function getAuthToken() {
  const result = await chrome.storage.local.get(['authToken']);
  return result.authToken;
}

// Show notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
  });
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    getPageContent(sender.tab.id).then(sendResponse);
    return true;
  }
});

// Get full page content
async function getPageContent(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      return {
        title: document.title,
        url: window.location.href,
        content: document.body.innerText.slice(0, 50000), // Limit content
      };
    },
  });

  return results[0]?.result;
}

console.log('RAG Extension background script loaded');
