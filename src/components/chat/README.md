# Chat Components

A comprehensive set of React components for building a modern, responsive RAG (Retrieval-Augmented Generation) chat interface.

## Features

- **Modern UI/UX**: Clean, ChatGPT/Claude-inspired design with dark mode support
- **Accessibility**: Full ARIA labels, keyboard navigation, and screen reader support
- **Responsive**: Mobile-friendly layout with collapsible sidebars
- **Performance**: Optimized rendering with virtualized lists and efficient state management
- **Streaming Support**: Real-time token streaming with cancellation support
- **Source Citations**: Inline citation links with hover previews and source panel

## Components

### Main Components

#### `ChatContainer`
The main chat layout component that orchestrates the entire chat interface.

```tsx
import { ChatContainer } from "@/components/chat";

<ChatContainer
  messages={messages}
  sources={sources}
  isStreaming={isStreaming}
  streamingContent={streamingContent}
  onSendMessage={handleSend}
  onCancelStreaming={handleCancel}
  sidebar={<DocumentList />}
/>
```

#### `MessageList`
Displays a scrollable list of messages with auto-scroll and load-more functionality.

```tsx
import { MessageList } from "@/components/chat";

<MessageList
  messages={messages}
  isStreaming={isStreaming}
  streamingContent={streamingContent}
  onLoadMore={loadMore}
/>
```

#### `MessageItem`
Individual message component with support for user/assistant styling, markdown rendering, and actions.

```tsx
import { MessageItem, type Message } from "@/components/chat";

const message: Message = {
  id: "1",
  role: "assistant",
  content: "Hello! How can I help?",
  createdAt: new Date(),
  sources: [...]
};

<MessageItem
  message={message}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

#### `MessageInput`
Auto-resizing input area with file attachment support.

```tsx
import { MessageInput } from "@/components/chat";

<MessageInput
  onSend={handleSend}
  placeholder="Type your message..."
  isLoading={isLoading}
/>
```

#### `StreamingMessage`
Displays streaming content with animated typing indicator.

```tsx
import { StreamingMessage } from "@/components/chat";

<StreamingMessage
  content={streamingContent}
  onCancel={handleCancel}
/>
```

#### `EmptyState`
Welcome screen with suggested questions and upload zone.

```tsx
import { EmptyState } from "@/components/chat";

<EmptyState
  onSuggestionClick={handleSuggestion}
  onUploadClick={handleUpload}
/>
```

### Source & Citation Components

#### `SourcesPanel` / `InlineSourcesPanel`
Display retrieved sources in a slide-out panel or inline sidebar.

```tsx
import { SourcesPanel, InlineSourcesPanel } from "@/components/chat";

// Slide-out panel
<SourcesPanel
  sources={sources}
  isOpen={isOpen}
  onClose={handleClose}
/>

// Inline sidebar
<InlineSourcesPanel
  sources={sources}
  isCollapsed={isCollapsed}
  onToggle={handleToggle}
/>
```

#### `CitationLink`, `CitationList`, `CitationCard`
Components for displaying inline citations and source cards.

```tsx
import { CitationLink, CitationList, CitationCard } from "@/components/chat";

// Inline citation
<CitationLink index={1} onClick={handleClick} />

// List of sources
<CitationList sources={sources} />

// Individual source card
<CitationCard source={source} onClick={handleClick} />
```

### Markdown & Code Components

#### `Markdown`
Renders markdown content with syntax highlighting and citation support.

```tsx
import { Markdown } from "@/components/chat";

<Markdown
  content="# Hello\n\nThis is **bold** and `code`."
  onCitationClick={handleCitation}
/>
```

#### `CodeBlock`
Syntax-highlighted code blocks with copy button.

```tsx
import { CodeBlock } from "@/components/chat";

<CodeBlock language="typescript">
  const greeting = "Hello World";
</CodeBlock>
```

## Hooks

### `useChat`
Manages chat state, message history, and streaming.

```tsx
import { useChat } from "@/hooks/use-chat";

const {
  messages,
  input,
  setInput,
  isLoading,
  isStreaming,
  streamingContent,
  sendMessage,
  stop,
  reload,
} = useChat({
  conversationId: "conv-123",
  onError: (error) => console.error(error),
  onFinish: (message) => console.log("Done:", message),
});
```

### `useStreaming`
Low-level hook for handling streaming responses.

```tsx
import { useStreaming, createStreamingRequest } from "@/hooks/use-streaming";

const { content, isStreaming, startStream, stopStream } = useStreaming({
  onToken: (token) => console.log(token),
  onSources: (sources) => console.log(sources),
});

const response = await createStreamingRequest("/api/chat", { message });
await startStream(response);
```

## Types

```tsx
import type { Message, Source, Document } from "@/components/chat";

// Message from user or assistant
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  sources?: Source[];
  model?: string;
}

// Retrieved source for citations
interface Source {
  id: string;
  index: number;
  documentName: string;
  documentType: string;
  chunkText: string;
  pageNumber?: number;
  relevanceScore: number;
}
```

## Styling

Components use Tailwind CSS classes and support dark mode via the `dark` class. Customize styles using CSS variables defined in `globals.css`.

## Keyboard Shortcuts

- `Enter`: Send message
- `Shift + Enter`: New line in message
- `Escape`: Cancel streaming / Close panels

## Accessibility

- Full keyboard navigation support
- ARIA labels on all interactive elements
- Screen reader announcements for new messages
- Focus management for modal dialogs
