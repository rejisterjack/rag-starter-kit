// Side Panel Controller — RAG Knowledge Assistant

(function () {
  'use strict';

  var chatArea = document.getElementById('chat-area');
  var emptyState = document.getElementById('empty-state');
  var queryInput = document.getElementById('query-input');
  var sendBtn = document.getElementById('send-btn');

  var DEFAULT_API_URL = 'http://localhost:7392';
  var apiUrl = DEFAULT_API_URL;
  var apiKey = '';
  var conversationHistory = [];

  async function init() {
    var data = await chrome.storage.local.get(['apiUrl', 'apiKey']);
    apiUrl = (data.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
    apiKey = data.apiKey || '';

    chrome.runtime.onMessage.addListener(function (request) {
      if (request.action === 'setQuery') {
        setQuery(request.query);
      }
    });
  }

  function setQuery(text) {
    queryInput.value = text;
    queryInput.focus();
  }

  function addMessage(text, role) {
    if (emptyState) {
      emptyState.remove();
      emptyState = null;
    }

    var div = document.createElement('div');
    div.className = 'message message--' + role;
    div.textContent = text;
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
    return div;
  }

  function setLoading(loading) {
    sendBtn.disabled = loading;
    sendBtn.textContent = loading ? 'Sending...' : 'Send';
  }

  async function sendQuery() {
    var query = queryInput.value.trim();
    if (!query) return;

    if (!apiKey) {
      addMessage('Configure your API key in extension options.', 'system');
      return;
    }

    queryInput.value = '';
    addMessage(query, 'user');
    setLoading(true);

    var assistantEl = addMessage('', 'assistant');
    var fullText = '';

    try {
      var response = await fetch(apiUrl + '/api/public/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          question: query,
          history: conversationHistory,
        }),
      });

      if (!response.ok) {
        var errBody = await response.text();
        throw new Error('Server returned ' + response.status + ': ' + errBody.slice(0, 120));
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });
        var parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (var i = 0; i < parts.length; i++) {
          var line = parts[i]
            .split('\n')
            .map(function (l) {
              return l.trim();
            })
            .find(function (l) {
              return l.indexOf('data: ') === 0;
            });
          if (!line) continue;

          try {
            var data = JSON.parse(line.slice(6));
            if (data.type === 'content' && data.content) {
              fullText += data.content;
              assistantEl.textContent = fullText;
              chatArea.scrollTop = chatArea.scrollHeight;
            } else if (data.type === 'error') {
              throw new Error(data.message || 'Stream error');
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Stream error') {
              // skip malformed SSE frames
            } else {
              throw parseErr;
            }
          }
        }
      }

      conversationHistory.push({ role: 'user', content: query });
      conversationHistory.push({ role: 'assistant', content: fullText || '(no response)' });
    } catch (err) {
      assistantEl.textContent = 'Error: ' + err.message;
      assistantEl.className = 'message message--system';
    } finally {
      setLoading(false);
      queryInput.focus();
    }
  }

  sendBtn.addEventListener('click', sendQuery);

  queryInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  });

  init();
})();
