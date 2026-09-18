// Popup Controller — RAG Knowledge Assistant

(function () {
  'use strict';

  // --- Elements ---
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const statusUrl = document.getElementById('status-url');
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastMessage = document.getElementById('toast-message');
  const btnNewChat = document.getElementById('btn-new-chat');
  const btnSavePage = document.getElementById('btn-save-page');
  const btnAskSelection = document.getElementById('btn-ask-selection');
  const btnSummarize = document.getElementById('btn-summarize');
  const btnOpenApp = document.getElementById('btn-open-app');
  const btnSettings = document.getElementById('btn-settings');
  const toggleSidepanel = document.getElementById('toggle-sidepanel');
  const toggleAutosave = document.getElementById('toggle-autosave');
  const versionLabel = document.getElementById('version-label');

  // --- Config ---
  const DEFAULT_API_URL = 'https://rag-starter-kit.vercel.app';
  let apiUrl = DEFAULT_API_URL;

  // --- Init ---
  async function init() {
    // Load saved settings
    const data = await chrome.storage.local.get(['apiUrl', 'sidepanelEnabled', 'autosaveEnabled']);

    apiUrl = data.apiUrl || DEFAULT_API_URL;
    toggleSidepanel.checked = !!data.sidepanelEnabled;
    toggleAutosave.checked = !!data.autosaveEnabled;
    statusUrl.textContent = new URL(apiUrl).host;

    // Show version from manifest
    const manifest = chrome.runtime.getManifest();
    versionLabel.textContent = `v${manifest.version}`;

    // Check backend connection
    checkConnection();
  }

  // --- Connection Check ---
  async function checkConnection() {
    statusDot.className = 'status-dot checking';
    statusText.textContent = 'Checking connection...';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${apiUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected';
      } else {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = `Error ${response.status}`;
      }
    } catch (err) {
      statusDot.className = 'status-dot disconnected';
      if (err.name === 'AbortError') {
        statusText.textContent = 'Connection timed out';
      } else {
        statusText.textContent = 'Unable to connect';
      }
    }
  }

  // --- Toast Notifications ---
  let toastTimer = null;

  function showToast(message, type = 'success') {
    toast.className = `toast ${type} visible`;
    toastIcon.textContent = type === 'success' ? '✅' : '❌';
    toastMessage.textContent = message;

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }

  // --- Button Handlers ---

  // New Chat: open the side panel
  btnNewChat.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'openSidePanel' });
      window.close();
    } catch {
      showToast('Could not open side panel', 'error');
    }
  });

  // Save this page
  btnSavePage.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

    btnSavePage.disabled = true;
    btnSavePage.querySelector('.action-label').textContent = 'Saving...';

    try {
      await chrome.runtime.sendMessage({
        action: 'savePage',
        url: tab.url,
        title: tab.title,
      });
      showToast(`Saved "${tab.title}"`, 'success');
    } catch {
      showToast('Failed to save page', 'error');
    } finally {
      btnSavePage.disabled = false;
      btnSavePage.querySelector('.action-label').textContent = 'Save this page';
    }
  });

  // Ask about selection
  btnAskSelection.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString(),
      });
      const selectedText = results[0]?.result?.trim();
      if (selectedText) {
        await chrome.runtime.sendMessage({
          action: 'askSelection',
          text: selectedText,
        });
        window.close();
      } else {
        showToast('Select text on the page first', 'error');
      }
    } catch {
      showToast('Could not read selection', 'error');
    }
  });

  // Summarize page
  btnSummarize.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

    try {
      await chrome.runtime.sendMessage({
        action: 'summarize',
        url: tab.url,
        title: tab.title,
      });
      window.close();
    } catch {
      showToast('Could not summarize page', 'error');
    }
  });

  // Open full app
  btnOpenApp.addEventListener('click', () => {
    chrome.tabs.create({ url: apiUrl });
    window.close();
  });

  // Settings (open options page or a new tab with settings)
  btnSettings.addEventListener('click', () => {
    // For now open the backend settings page; can be replaced with an options_ui page
    chrome.tabs.create({ url: `${apiUrl}/settings` });
    window.close();
  });

  // --- Toggle Handlers ---

  toggleSidepanel.addEventListener('change', () => {
    chrome.storage.local.set({ sidepanelEnabled: toggleSidepanel.checked });
  });

  toggleAutosave.addEventListener('change', () => {
    chrome.storage.local.set({ autosaveEnabled: toggleAutosave.checked });
  });

  // --- Start ---
  init();
})();
