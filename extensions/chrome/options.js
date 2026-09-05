const DEFAULT_API_URL = 'http://localhost:7392';

async function loadSettings() {
  const data = await chrome.storage.local.get(['apiUrl', 'apiKey']);
  document.getElementById('apiUrl').value = data.apiUrl || DEFAULT_API_URL;
  document.getElementById('apiKey').value = data.apiKey || '';
}

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const apiUrl = document.getElementById('apiUrl').value.replace(/\/+$/, '');
  const apiKey = document.getElementById('apiKey').value.trim();

  await chrome.storage.local.set({ apiUrl, apiKey });

  const status = document.getElementById('status');
  status.hidden = false;
  setTimeout(() => {
    status.hidden = true;
  }, 2000);
});

loadSettings();
