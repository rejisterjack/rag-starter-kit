# RAG Knowledge Assistant -- Chrome Extension

A Manifest V3 Chrome extension that connects your browser to a RAG (Retrieval-Augmented Generation) knowledge base. Save any web page, ask questions about selected text, and get AI-powered summaries -- all without leaving your current tab.

## Features

| Feature                 | Shortcut                       | Description                                                   |
| ----------------------- | ------------------------------ | ------------------------------------------------------------- |
| **Popup Panel**         | `Ctrl+Shift+K` / `Cmd+Shift+K` | Quick-access panel with connection status and actions         |
| **Side Panel**          | `Ctrl+Shift+L` / `Cmd+Shift+L` | Persistent chat panel docked to the right side of the browser |
| **Quick Ask**           | `Ctrl+Shift+A` / `Cmd+Shift+A` | Send selected text as a question to the RAG assistant         |
| **Save Page**           | Right-click > Save page        | Ingest the current page into your knowledge base              |
| **Summarize**           | Right-click > Summarize        | Generate a RAG-powered summary of the current page            |
| **Ask about selection** | Right-click on text            | Send the selected text as a query to the RAG                  |

### Popup Panel

The popup (opened by clicking the extension icon or pressing `Ctrl+Shift+K`) provides:

- **Connection status** -- a live indicator showing whether the RAG backend is reachable
- **New Chat** -- opens the side panel to start a conversation
- **Save this page** -- one-click ingestion of the current tab into your knowledge base
- **Ask about selection** -- queries the RAG about whatever text is currently highlighted
- **Summarize page** -- generates a summary of the current page
- **Side Panel toggle** -- enable or disable the docked side panel
- **Auto-save toggle** -- automatically ingest every page you visit
- **Open Full App** -- opens the complete RAG web application in a new tab
- **Settings** -- opens the settings page

### Side Panel

The side panel docks to the right side of the browser and provides a persistent chat interface with the RAG assistant. It can be opened via the keyboard shortcut, the popup, or a right-click context menu action.

## Installation

### From Chrome Web Store (Recommended)

_Coming soon -- the extension will be published to the Chrome Web Store._

### Manual Installation (Development)

1. Clone the repository:

   ```bash
   git clone https://github.com/rejisterjack/rag-starter-kit.git
   cd rag-starter-kit/extensions/chrome
   ```

2. Open Chrome and navigate to `chrome://extensions`.

3. Enable **Developer mode** using the toggle in the top-right corner.

4. Click **Load unpacked** and select the `extensions/chrome/` directory.

5. The extension icon will appear in your toolbar. Pin it for easy access.

6. (Optional) Right-click the extension icon and select **Manage shortcut** to customize keyboard shortcuts.

## Configuration

### Backend URL

By default the extension connects to `https://rag-starter-kit.vercel.app`. To point it at your own deployment:

1. Open `extensions/chrome/background.js` and `extensions/chrome/popup.js`.
2. Find the `DEFAULT_API_URL` constant near the top of each file and update it:

   ```js
   const DEFAULT_API_URL = 'https://your-deployment.vercel.app';
   // or for local development:
   const DEFAULT_API_URL = 'http://localhost:7392';
   ```

3. Reload the extension in `chrome://extensions`.

The `host_permissions` field in `manifest.json` includes `http://localhost:7392/*` and `https://*.vercel.app/*`. If your backend is hosted elsewhere, add the appropriate pattern to `host_permissions`.

### Authentication

If your RAG backend requires authentication, the extension reads an `authToken` value from Chrome's local storage. You can set this programmatically via the browser console:

```js
chrome.storage.local.set({ authToken: 'your-jwt-token-here' });
```

## Keyboard Shortcuts

| Action                | Windows / Linux | macOS         |
| --------------------- | --------------- | ------------- |
| Open popup            | `Ctrl+Shift+K`  | `Cmd+Shift+K` |
| Open side panel       | `Ctrl+Shift+L`  | `Cmd+Shift+L` |
| Quick ask (selection) | `Ctrl+Shift+A`  | `Cmd+Shift+A` |

You can customize these shortcuts in Chrome at `chrome://extensions/shortcuts`.

## Permissions Explained

| Permission      | Justification                                                                            |
| --------------- | ---------------------------------------------------------------------------------------- |
| `activeTab`     | Read the URL and title of the active tab to save pages and generate summaries            |
| `storage`       | Persist user preferences (backend URL, side panel toggle, auto-save setting, auth token) |
| `contextMenus`  | Add right-click menu items for "Ask RAG about this", "Save page", and "Summarize"        |
| `sidePanel`     | Open the docked side panel via keyboard shortcut or popup button                         |
| `scripting`     | Execute content scripts to extract selected text and page content for RAG queries        |
| `notifications` | Show Chrome notifications when a page is saved or an error occurs                        |

**No browsing history is collected.** The extension only communicates with the backend URL you configure. No data is sent to any third-party services.

## File Structure

```
extensions/chrome/
├── manifest.json       # Extension manifest (Manifest V3)
├── background.js       # Service worker -- context menus, commands, message routing
├── popup.html          # Popup UI markup
├── popup.js            # Popup controller -- connection check, actions, toggles
├── content.js          # Content script -- page content extraction, selection handling
├── content.css         # Styles for content script notification overlays
├── sidepanel.html      # Side panel HTML
├── sidepanel.js        # Side panel controller -- chat interface
├── styles/
│   └── popup.css       # Popup styles
├── icons/
│   ├── icon16.png      # 16x16 toolbar icon
│   ├── icon32.png      # 32x32 toolbar icon (retina)
│   ├── icon48.png      # 48x48 extension management page
│   └── icon128.png     # 128x128 Chrome Web Store and installation
└── README.md           # This file
```

## Publishing to the Chrome Web Store

1. Verify `manifest.json` has the correct `version`, `name`, and `description`.

2. Set `API_BASE_URL` (in `background.js`) and `DEFAULT_API_URL` (in `popup.js` and `sidepanel.js`) to your production backend URL.

3. Replace placeholder icons with production-quality assets if needed.

4. Create a zip archive:

   ```bash
   cd extensions && zip -r rag-knowledge-assistant.zip chrome/
   ```

5. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

6. Click **New Item**, upload the zip, and fill in the store listing.

7. Prepare a privacy disclosure noting that the extension sends page URLs and selected text to your RAG API backend for processing.

## Troubleshooting

| Issue                               | Solution                                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| "Unable to connect" status          | Verify the backend URL is correct and the server is running. Check `host_permissions` in the manifest.               |
| Context menus not appearing         | Reload the extension in `chrome://extensions`. Menus are created on `onInstalled`.                                   |
| Side panel not opening              | Ensure the `sidePanel` permission is granted. Try reloading the extension.                                           |
| Selection-based actions not working | The page must have focus and text selected. Some pages (chrome:// URLs, PDF viewer) may not support content scripts. |

## License

This extension is part of the RAG Starter Kit project. See the root repository for license information.
