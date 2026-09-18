// Background Service Worker — RAG Knowledge Assistant (Manifest V3)

const DEFAULT_API_URL = 'http://localhost:7392';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rag-ask',
    title: 'Ask RAG about this',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'rag-save-page',
    title: 'Save page to knowledge base',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'rag-summarize',
    title: 'Summarize with RAG',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'rag-ask':
      openSidePanelWithQuery(info.selectionText);
      break;
    case 'rag-save-page':
      if (tab?.url && tab.title) savePageToRAG(tab.url, tab.title);
      break;
    case 'rag-summarize':
      if (tab?.url && tab.title) summarizePage(tab.url, tab.title);
      break;
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open_side_panel') {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  } else if (command === 'quick_ask') {
    getSelectedText().then((text) => {
      if (text) openSidePanelWithQuery(text);
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'openSidePanel':
      chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      sendResponse({ ok: true });
      break;

    case 'savePage':
      savePageToRAG(request.url, request.title)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'askSelection':
      openSidePanelWithQuery(request.text);
      sendResponse({ ok: true });
      break;

    case 'summarize':
      summarizePage(request.url, request.title);
      sendResponse({ ok: true });
      break;

    case 'getPageContent':
      if (sender.tab?.id) {
        getPageContent(sender.tab.id).then(sendResponse);
        return true;
      }
      break;
  }
});

async function getConfig() {
  const result = await chrome.storage.local.get(['apiUrl', 'apiKey']);
  return {
    apiUrl: (result.apiUrl || DEFAULT_API_URL).replace(/\/+$/, ''),
    apiKey: result.apiKey || '',
  };
}

async function openSidePanelWithQuery(query) {
  await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'setQuery', query });
  }, 200);
}

async function getSelectedText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection()?.toString() ?? '',
  });

  return results[0]?.result;
}

async function savePageToRAG(url, title) {
  const { apiUrl, apiKey } = await getConfig();

  if (!apiKey) {
    showNotification('API key required', 'Set your API key in extension options.');
    throw new Error('API key not configured');
  }

  const response = await fetch(`${apiUrl}/api/public/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      metadata: { title, source: 'chrome-extension' },
    }),
  });

  if (response.ok) {
    showNotification('Page saved', `Saved "${title}" to your knowledge base.`);
  } else {
    const body = await response.text().catch(() => '');
    showNotification('Save failed', `Could not save "${title}" (${response.status}).`);
    throw new Error(body || `HTTP ${response.status}`);
  }
}

function summarizePage(url, title) {
  openSidePanelWithQuery(`Summarize this page: ${url}\n\nTitle: ${title}`);
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  });
}

async function getPageContent(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      title: document.title,
      url: window.location.href,
      content: document.body.innerText.slice(0, 50000),
    }),
  });

  return results[0]?.result;
}

console.log('RAG Knowledge Assistant — background service worker loaded');
