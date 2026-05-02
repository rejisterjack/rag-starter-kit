import React from 'react';
import { createRoot } from 'react-dom/client';
import { RAGChatWidget } from './chat-widget';

function init() {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) {
    return;
  }

  const apiKey = script.dataset?.apiKey || '';
  const apiBaseUrl = script.dataset?.apiBaseUrl || window.location.origin;
  const theme = (script.dataset?.theme as 'light' | 'dark' | 'auto') || 'auto';
  const title = script.dataset?.title || 'AI Assistant';
  const placeholder = script.dataset?.placeholder || 'Ask a question...';
  const welcomeMessage = script.dataset?.welcomeMessage || 'Hello! How can I help you today?';

  if (!apiKey) {
    return;
  }

  // Create container element
  const container = document.createElement('div');
  container.id = 'rag-chat-widget-root';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);

  // Render the widget
  const root = createRoot(container);
  root.render(
    React.createElement(RAGChatWidget, {
      apiKey,
      apiBaseUrl,
      theme,
      title,
      placeholder,
      welcomeMessage,
    })
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
