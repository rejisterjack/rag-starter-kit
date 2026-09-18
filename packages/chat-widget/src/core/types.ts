/**
 * Configuration for the RAG Chat Widget
 */
export interface WidgetConfig {
  /** Base URL of the RAG Starter Kit backend (e.g., "https://your-app.vercel.app") */
  apiUrl: string;
  /** API key for authentication with the public chat endpoint */
  apiKey?: string;
  /** Target workspace ID (uses the key's default workspace if omitted) */
  workspaceId?: string;
  /** Widget title displayed in the header (default: "Chat") */
  title?: string;
  /** Input field placeholder text */
  placeholder?: string;
  /** Primary theme color as a hex string (default: "#7c3aed") */
  primaryColor?: string;
  /** Position of the widget bubble on the page */
  position?: 'bottom-right' | 'bottom-left';
  /** Greeting message shown when the widget first opens */
  greeting?: string;
  /** Whether to display source citations under responses (default: true) */
  showSources?: boolean;
}

/** Resolved config with defaults applied */
export interface ResolvedConfig extends Required<WidgetConfig> {}

/**
 * A single chat message in the conversation
 */
export interface ChatMessage {
  /** Unique ID for this message */
  id: string;
  /** Sender role */
  role: 'user' | 'assistant';
  /** Message text content */
  content: string;
  /** Source citations (only present on assistant messages when showSources is true) */
  sources?: Citation[];
  /** Whether this message is currently being streamed */
  isStreaming?: boolean;
}

/**
 * A source citation attached to an assistant response
 */
export interface Citation {
  /** Citation index */
  id: number;
  /** Document ID in the database */
  documentId?: string;
  /** Human-readable document name */
  documentName: string;
  /** Page number within the document, if applicable */
  page?: number;
  /** Similarity/relevance score */
  score: number;
  /** Snippet of the matching content */
  content: string;
}

/**
 * API response from the public chat endpoint
 */
export interface ChatApiResponse {
  success: boolean;
  data?: {
    answer: string;
    citations: Citation[];
    metadata: {
      tokensUsed?: {
        prompt?: number;
        completion?: number;
        total?: number;
      };
      latency: number;
      sourceCount: number;
      workspaceId: string;
    };
  };
  error?: string;
  code?: string;
}

/**
 * Widget event types that consumers can listen to
 */
export type WidgetEventType =
  'open' | 'close' | 'message:sent' | 'message:received' | 'error' | 'destroy';

/**
 * Event callback signature
 */
export type WidgetEventCallback = (data?: unknown) => void;

/**
 * Event map for typed event listening
 */
export interface WidgetEventMap {
  open: void;
  close: void;
  'message:sent': { content: string };
  'message:received': { content: string; sources?: Citation[] };
  error: { error: string };
  destroy: void;
}
