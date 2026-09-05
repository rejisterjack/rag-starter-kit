# @rag-starter-kit/chat-widget

An embeddable chat widget for the [RAG Starter Kit](https://github.com/rejisterjack/rag-starter-kit). Drop it into any website or React application to add a floating chat bubble connected to your RAG-powered knowledge base.

## Features

- Floating chat bubble with smooth open/close animations
- Real-time streaming responses (SSE compatible)
- Source citations displayed under each response
- Shadow DOM isolation - styles never leak to the host page
- Fully responsive - works on mobile and desktop
- Customizable colors, position, labels, and greeting
- Zero dependencies for vanilla JS usage
- Optional React component wrapper

## Installation

```bash
# npm
npm install @rag-starter-kit/chat-widget

# yarn
yarn add @rag-starter-kit/chat-widget

# bun
bun add @rag-starter-kit/chat-widget
```

## Quick Start: Vanilla JS

Add the widget to any HTML page with a script tag:

```html
<script type="module">
  import { RAGChatWidget } from 'https://unpkg.com/@rag-starter-kit/chat-widget';

  RAGChatWidget.init({
    apiUrl: 'https://your-app.vercel.app',
    apiKey: 'your-api-key',
    title: 'Ask anything',
  });
</script>
```

Or import as an ES module in your JavaScript:

```ts
import { RAGChatWidget } from '@rag-starter-kit/chat-widget';

const widget = new RAGChatWidget({
  apiUrl: 'https://your-app.vercel.app',
  apiKey: 'your-api-key',
  title: 'Ask anything',
});

// Control the widget programmatically
widget.open();
widget.close();
widget.toggle();

// Listen for events
widget.on('message:received', (data) => {
  console.log('Got response:', data);
});

// Clean up when done
widget.destroy();
```

## Quick Start: React

```tsx
import { ChatWidget } from '@rag-starter-kit/chat-widget/react';

function App() {
  return (
    <div>
      <h1>My App</h1>
      <ChatWidget
        apiUrl="https://your-app.vercel.app"
        apiKey="your-api-key"
        title="Help Center"
        primaryColor="#2563eb"
      />
    </div>
  );
}
```

## Configuration Options

| Option         | Type                              | Default                           | Description                                                |
| -------------- | --------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| `apiUrl`       | `string`                          | _(required)_                      | Base URL of your RAG Starter Kit deployment                |
| `apiKey`       | `string`                          | `""`                              | API key for authenticating with the public chat endpoint   |
| `title`        | `string`                          | `"Chat"`                          | Title displayed in the widget header                       |
| `placeholder`  | `string`                          | `"Ask a question..."`             | Placeholder text for the input field                       |
| `primaryColor` | `string`                          | `"#7c3aed"`                       | Primary theme color (hex) for bubbles, header, and accents |
| `position`     | `"bottom-right" \| "bottom-left"` | `"bottom-right"`                  | Position of the floating bubble                            |
| `greeting`     | `string`                          | `"Hi! How can I help you today?"` | Initial greeting message                                   |
| `showSources`  | `boolean`                         | `true`                            | Whether to show source citations under responses           |

## Theming and Customization

The widget uses Shadow DOM for complete style isolation. The `primaryColor` option controls the entire color palette - all hover states, light variants, and accents are automatically derived.

### CSS Custom Properties (inside Shadow DOM)

For advanced customization, the widget sets CSS custom properties on the host element:

| Variable                | Purpose                          |
| ----------------------- | -------------------------------- |
| `--ragwk-primary`       | Primary accent color             |
| `--ragwk-primary-hover` | Hover state for primary elements |
| `--ragwk-primary-light` | Light background tint            |
| `--ragwk-bg`            | Panel background color           |
| `--ragwk-text`          | Primary text color               |
| `--ragwk-border`        | Border color                     |

### Responsive Behavior

- On screens wider than 480px: 400px wide floating panel
- On screens 480px or narrower: full-screen chat experience

## Widget API

### Methods

| Method                | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `open()`              | Open the chat panel                                    |
| `close()`             | Close the chat panel                                   |
| `toggle()`            | Toggle open/closed state                               |
| `destroy()`           | Remove the widget from the DOM and clean up            |
| `on(event, callback)` | Subscribe to an event. Returns an unsubscribe function |

### Events

| Event              | Data                                        | Description                 |
| ------------------ | ------------------------------------------- | --------------------------- |
| `open`             | -                                           | Widget panel opened         |
| `close`            | -                                           | Widget panel closed         |
| `message:sent`     | `{ content: string }`                       | User sent a message         |
| `message:received` | `{ content: string, sources?: Citation[] }` | Assistant response received |
| `error`            | `{ error: string }`                         | An error occurred           |
| `destroy`          | -                                           | Widget was destroyed        |

### Event listener example

```ts
const widget = RAGChatWidget.init({ apiUrl: 'https://your-app.vercel.app', apiKey: '...' });

// Track when users send messages
widget.on('message:sent', (data) => {
  console.log('User asked:', (data as { content: string }).content);
});

// Track responses
widget.on('message:received', (data) => {
  const { content, sources } = data as { content: string; sources?: unknown[] };
  console.log('AI responded:', content);
  console.log('Sources cited:', sources?.length ?? 0);
});

// Clean up listener
const unsubscribe = widget.on('error', (data) => {
  console.error('Widget error:', (data as { error: string }).error);
});
unsubscribe(); // removes the listener
```

## API Requirements

The widget communicates with the RAG Starter Kit backend through the public chat endpoint:

### `POST /api/public/chat`

**Authentication:** Bearer token via `Authorization` header or `X-API-Key` header.

**Request body:**

```json
{
  "question": "What is RAG?",
  "workspaceId": "optional-workspace-id",
  "history": [
    { "role": "user", "content": "Previous question" },
    { "role": "assistant", "content": "Previous answer" }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "answer": "RAG stands for Retrieval-Augmented Generation...",
    "citations": [
      {
        "id": 1,
        "documentId": "doc_123",
        "documentName": "AI Guide.pdf",
        "page": 5,
        "score": 0.92,
        "content": "Relevant snippet from the document..."
      }
    ],
    "metadata": {
      "tokensUsed": { "total": 450 },
      "latency": 1200,
      "sourceCount": 3
    }
  }
}
```

## Building from Source

```bash
cd packages/chat-widget
bun install
bun build
```

The build outputs:

- `dist/index.js` / `dist/index.mjs` - Vanilla JS entry (CJS + ESM)
- `dist/react.js` / `dist/react.mjs` - React component entry (CJS + ESM)
- `dist/index.d.ts` / `dist/react.d.ts` - TypeScript declarations

## License

MIT
