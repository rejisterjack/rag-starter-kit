# RAG Starter Kit — Chrome Extension

A Manifest V3 browser extension that gives you quick access to your RAG knowledge base from any page in Chrome.

## Features

| Feature | Shortcut | Description |
|---------|----------|-------------|
| **Popup** | `Ctrl+Shift+K` / `⌘⇧K` | Quick-access panel with recent chats and actions |
| **Side Panel** | `Ctrl+Shift+L` / `⌘⇧L` | Persistent RAG chat panel docked to the browser |
| **Quick Ask** | `Ctrl+Shift+A` / `⌘⇧A` | Ask your RAG about selected text on any page |
| **Context menu — Ask RAG** | Right-click on selection | Send selected text as a question to the RAG |
| **Context menu — Save page** | Right-click on page | Ingest the current page into your knowledge base |
| **Context menu — Summarize** | Right-click on page | Generate a RAG-powered summary of the current page |

## Installation (Development)

1. Clone the repo (if not already):

   ```bash
   git clone https://github.com/rejisterjack/rag-starter-kit.git
   ```

2. Open `chrome://extensions` in Chrome.

3. Enable **Developer mode** (top-right toggle).

4. Click **Load unpacked** and select the `extensions/chrome/` directory.

5. The extension icon appears in the toolbar. Pin it for easy access.

## Configuration

By default the extension points to `https://rag-starter-kit.vercel.app`. To point it at your own deployment:

1. Open `extensions/chrome/background.js`.
2. Change the `API_BASE_URL` constant at the top of the file:

   ```js
   const API_BASE_URL = 'https://your-deployment.vercel.app'; // or http://localhost:3000
   ```

3. Reload the extension in `chrome://extensions`.

> **Tip:** For local development set `API_BASE_URL = 'http://localhost:3000'`. The `host_permissions` in `manifest.json` includes `http://localhost:3000/*` so no changes are needed there.

## Permissions

| Permission | Why it's needed |
|------------|-----------------|
| `activeTab` | Read the URL and title of the current tab to save/summarize pages |
| `storage` | Persist user preferences (side-panel toggle, auto-save setting) |
| `contextMenus` | Add right-click menu items on selection and page contexts |
| `sidePanel` | Open the docked side panel via keyboard shortcut |

No browsing history is collected. The extension only communicates with the `API_BASE_URL` host you configure.

## File Structure

```
extensions/chrome/
├── manifest.json        # Extension manifest (MV3)
├── background.js        # Service worker — context menus, keyboard commands
├── popup.html           # Popup UI (toolbar icon click)
├── content.js           # Content script injected into all pages
├── content.css          # Styles for content script overlay
├── sidepanel.html       # Side panel HTML
├── styles/
│   └── popup.css        # Popup styles
└── icons/               # Extension icons (16×16 → 128×128)
```

## Publishing to the Chrome Web Store

1. Zip the `extensions/chrome/` directory:

   ```bash
   cd extensions && zip -r rag-starter-kit-extension.zip chrome/
   ```

2. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

3. Click **New item**, upload the zip, and complete the store listing.

4. Before submission:
   - Replace placeholder icons with production-quality versions.
   - Set `API_BASE_URL` to your production domain.
   - Review the required privacy disclosure (the extension sends selected text / page URLs to your RAG API).

## Known Limitations

- `sidepanel.html` and `content.js`/`content.css` are scaffolded but not yet fully implemented — contributions welcome.
- Icons referenced in `manifest.json` (`icons/icon16.png` etc.) must be created; the `public/icons/` folder in the web app contains larger versions that can be resized.
- The extension has not been submitted to the Chrome Web Store; it is currently development-only.
