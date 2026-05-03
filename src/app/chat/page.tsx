'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChatContainer } from '@/components/chat/chat-container';
import type { Source } from '@/components/chat/citations';
import type { Document } from '@/components/documents/document-card';
import { DocumentList } from '@/components/documents/document-list';
import { DocumentPreview } from '@/components/documents/document-preview';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useChat } from '@/hooks/use-chat';

interface ApiDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  chunkCount?: number;
  createdAt: string;
  errorMessage?: string;
}

interface DocumentChunk {
  id: string;
  index: number;
  text: string;
  start?: number;
  end?: number;
  page?: number;
  section?: string;
}

/**
 * Read chatId from the browser URL — safe for SSR (returns undefined)
 */
function getUrlChatId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  return params.get('chatId') || undefined;
}

export default function ChatPage(): React.ReactElement {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewChunks, setPreviewChunks] = useState<DocumentChunk[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [, setIsLoadingPreview] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
  const [agentMode, setAgentMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState('inclusionai/ling-2.6-1t:free');
  const [chatTitle, setChatTitle] = useState('New Chat');

  const {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    stop,
    reload,
    deleteMessage,
    editMessage,
    hasMore,
    loadMore,
    loadMessages,
    sources: chatSources,
    clearMessages,
  } = useChat({
    conversationId: currentChatId,
    agentMode,
    model: selectedModel,
  });

  // On mount: if we have a chatId from the URL, set it and load messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    const chatId = getUrlChatId();
    if (chatId) {
      setCurrentChatId(chatId);
      loadMessages(chatId);
    }
  }, []);

  // Merge sources
  const effectiveSources = chatSources.length > 0 ? chatSources : sources;

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      if (data.success) {
        const formattedDocs: Document[] = data.data.documents.map((doc: ApiDocument) => ({
          ...doc,
          createdAt: new Date(doc.createdAt),
        }));
        setDocuments(formattedDocs);
      }
    } catch {
      // Silent fail on document fetch
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll for document status updates
  useEffect(() => {
    const interval = setInterval(() => {
      const hasProcessingDocs = documents.some(
        (d) => d.status === 'processing' || d.status === 'pending'
      );
      if (hasProcessingDocs) {
        fetchDocuments();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const createChat = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat', model: selectedModel }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { chat?: { id?: string } };
        error?: string;
        details?: string;
      };
      if (!response.ok) {
        const msg = data.details || data.error || `Could not create chat (${response.status})`;
        toast.error(msg);
        return null;
      }
      if (data.success && data.data?.chat?.id) return data.data.chat.id;
      toast.error(data.error || 'Failed to create new chat');
      return null;
    } catch {
      toast.error('Failed to create new chat');
      return null;
    }
  }, [selectedModel]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      const uploadedDocs: Document[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const response = await fetch('/api/ingest', { method: 'POST', body: formData });
          if (!response.ok) {
            const error = await response.json();
            toast.error(
              `Failed to upload ${file.name}: ${error.error?.message || 'Unknown error'}`
            );
            continue;
          }
          const data = await response.json();
          if (data.success) {
            uploadedDocs.push({
              id: data.data.document.id,
              name: data.data.document.name,
              type: file.type || 'application/octet-stream',
              size: file.size,
              status: 'pending',
              createdAt: new Date(),
            });
            toast.success(`Uploading ${file.name}...`);
          }
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      if (uploadedDocs.length > 0) {
        setDocuments((prev) => [...uploadedDocs, ...prev]);
        setTimeout(fetchDocuments, 1000);
      }
      setIsUploadOpen(false);
    },
    [fetchDocuments]
  );

  const handleDeleteDocument = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  }, []);

  const handleReingest = useCallback(
    async (id: string) => {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id ? { ...doc, status: 'processing' as const, progress: 0 } : doc
        )
      );
      try {
        const response = await fetch('/api/ingest/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: id }),
        });
        if (!response.ok) throw new Error('Failed to re-ingest');
        toast.success('Re-ingestion started');
        setTimeout(fetchDocuments, 1000);
      } catch {
        toast.error('Failed to re-ingest document');
        fetchDocuments();
      }
    },
    [fetchDocuments]
  );

  const handlePreview = useCallback(async (document: Document) => {
    setPreviewDocument(document);
    setIsPreviewOpen(true);
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`/api/documents/${document.id}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (data.success) setPreviewChunks(data.data.chunks || []);
    } catch {
      toast.error('Failed to load document preview');
      setPreviewChunks([]);
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    const newChatId = await createChat();
    if (newChatId) {
      // Clear state FIRST so the effect won't race with stale messages
      clearMessages();
      setCurrentChatId(newChatId);
      setChatTitle('New Chat');
      setSources([]);
      window.history.replaceState(null, '', `/chat?chatId=${newChatId}`);
    }
  }, [createChat, clearMessages]);

  const handleSendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if (files && files.length > 0) {
        await handleUpload(files);
      }

      let chatId = currentChatId;

      // Auto-create a chat if none exists
      if (!chatId) {
        const newChatId = await createChat();
        if (newChatId) {
          chatId = newChatId;
          // Clear stale state before setting new ID, then set ID.
          // This order ensures the useChat effect runs and clears
          // BEFORE sendMessage adds the optimistic user message.
          clearMessages();
          setCurrentChatId(newChatId);
          window.history.replaceState(null, '', `/chat?chatId=${newChatId}`);
          // Yield to let React process the state updates and effects
          // before sendMessage adds the optimistic message
          await new Promise((resolve) => setTimeout(resolve, 0));
        } else {
          toast.error('Failed to start chat. Please try again.');
          return;
        }
      }

      // Pass chatId directly to avoid stale ref race condition
      await sendMessage(content, undefined, chatId);
    },
    [sendMessage, handleUpload, currentChatId, createChat, clearMessages]
  );

  const handleSelectConversation = useCallback(
    (chatId: string) => {
      clearMessages();
      setCurrentChatId(chatId);
      window.history.replaceState(null, '', `/chat?chatId=${chatId}`);
      // Direct call — no useEffect needed
      loadMessages(chatId);
    },
    [loadMessages, clearMessages]
  );

  const handleDeleteConversation = useCallback(
    (chatId: string) => {
      if (chatId === currentChatId) {
        clearMessages();
        setCurrentChatId(undefined);
        setChatTitle('New Chat');
        window.history.replaceState(null, '', '/chat');
      }
    },
    [currentChatId, clearMessages]
  );

  const handleFeedback = useCallback(async (messageId: string, rating: 'up' | 'down') => {
    try {
      await fetch(`/api/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
    } catch {
      // Non-critical
    }
  }, []);

  const sidebar = (
    <DocumentList
      documents={documents}
      isLoading={isLoadingDocs}
      onUpload={() => setIsUploadOpen(true)}
      onDelete={handleDeleteDocument}
      onReingest={handleReingest}
      onPreview={handlePreview}
      selectedDocumentId={previewDocument?.id}
    />
  );

  return (
    <>
      <ChatContainer
        messages={messages}
        sources={effectiveSources}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        agentMode={agentMode}
        selectedModel={selectedModel}
        chatId={currentChatId}
        chatTitle={chatTitle}
        onModelChange={setSelectedModel}
        onSendMessage={handleSendMessage}
        onCancelStreaming={stop}
        onLoadMore={loadMore}
        onEditMessage={editMessage}
        onDeleteMessage={deleteMessage}
        onNewChat={handleNewChat}
        onUploadClick={() => setIsUploadOpen(true)}
        onFilesDrop={handleUpload}
        onAgentModeToggle={setAgentMode}
        onRegenerate={reload}
        onFeedback={handleFeedback}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        hasMore={hasMore}
        isLoading={isLoading}
        sidebar={sidebar}
      />

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
          </DialogHeader>
          <UploadDropzone
            onFilesSelected={handleUpload}
            onUrlSubmit={async (url) => {
              try {
                const formData = new FormData();
                formData.append('url', url);
                const response = await fetch('/api/ingest', { method: 'POST', body: formData });
                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.error?.message || 'Failed to ingest URL');
                }
                toast.success('URL queued for processing');
                setTimeout(fetchDocuments, 1000);
                setIsUploadOpen(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to ingest URL');
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <DocumentPreview
        document={previewDocument}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewDocument(null);
          setPreviewChunks([]);
        }}
        chunks={previewChunks.map((chunk) => ({
          id: chunk.id,
          index: chunk.index,
          text: chunk.text,
        }))}
      />
    </>
  );
}
