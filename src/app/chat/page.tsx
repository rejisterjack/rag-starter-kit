'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChatContainer } from '@/components/chat/chat-container';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import type { Source } from '@/components/chat/citations';
import { DocumentPreview } from '@/components/documents/document-preview';
import { UploadDropzone, useUpload } from '@/components/documents/upload-dropzone';
import { ProductTour } from '@/components/onboarding/product-tour';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useChat } from '@/hooks/use-chat';
import { useCreateChat, useSendFeedback } from '@/hooks/use-chat-operations';
import {
  useDeleteDocument,
  useDocumentPreview,
  useDocuments,
  useReingestDocument,
} from '@/hooks/use-documents';
import { useFeatureLevel } from '@/hooks/use-feature-level';

// UUID v4 pattern for chatId validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Also accept cuid/nanoid-style IDs (alphanumeric, 20-30 chars)
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{10,50}$/;

function getUrlChatId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  const chatId = params.get('chatId');
  if (!chatId) return undefined;
  if (UUID_REGEX.test(chatId) || SAFE_ID_REGEX.test(chatId)) {
    return chatId;
  }
  return undefined;
}

export default function ChatPage(): React.ReactElement {
  const [sources, setSources] = useState<Source[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
  const [agentMode, setAgentMode] = useState(false);
  const [chatTitle, setChatTitle] = useState('New Chat');

  // TanStack Query hooks
  const documentsQuery = useDocuments();
  const deleteMutation = useDeleteDocument();
  const reingestMutation = useReingestDocument();
  const previewQuery = useDocumentPreview(previewDocumentId);
  const createChatMutation = useCreateChat();
  const feedbackMutation = useSendFeedback();
  const { recordMessage } = useFeatureLevel();

  // Upload state with progress tracking
  const uploadState = useUpload({
    onUploadComplete: () => {
      documentsQuery.refetch();
      setTimeout(() => documentsQuery.refetch(), 8000);
    },
  });

  const documents = documentsQuery.data || [];

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
  });

  // On mount: load chat if we have a chatId from URL
  useEffect(() => {
    const chatId = getUrlChatId();
    if (chatId) {
      setCurrentChatId(chatId);
      loadMessages(chatId);
    }
  }, [loadMessages]);

  const effectiveSources = chatSources.length > 0 ? chatSources : sources;

  const handleUpload = useCallback(
    (files: File[]) => {
      uploadState.addFiles(files);
    },
    [uploadState]
  );

  // Auto-close upload dialog when all files are done
  useEffect(() => {
    if (uploadState.files.length === 0) return undefined;
    const allDone = uploadState.files.every(
      (f) => f.status === 'completed' || f.status === 'error'
    );
    if (allDone) {
      const timer = setTimeout(() => {
        setIsUploadOpen(false);
        // Clear completed files after dialog closes
        for (const f of uploadState.files) {
          uploadState.removeFile(f.id);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [uploadState.files, uploadState]);

  const handleNewChat = useCallback(async () => {
    const newChatId = await createChatMutation.mutateAsync({
      title: 'New Chat',
    });
    if (newChatId) {
      clearMessages();
      setCurrentChatId(newChatId);
      setChatTitle('New Chat');
      setSources([]);
      window.history.replaceState(null, '', `/chat?chatId=${newChatId}`);
    }
  }, [createChatMutation, clearMessages]);

  const handleSendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if (files && files.length > 0) {
        await handleUpload(files);
      }

      let chatId = currentChatId;

      if (!chatId) {
        const newChatId = await createChatMutation.mutateAsync({
          title: 'New Chat',
        });
        if (newChatId) {
          chatId = newChatId;
          clearMessages();
          setCurrentChatId(newChatId);
          window.history.replaceState(null, '', `/chat?chatId=${newChatId}`);
        } else {
          return;
        }
      }

      await sendMessage(content, undefined, chatId);
      recordMessage();
    },
    [sendMessage, handleUpload, currentChatId, createChatMutation, clearMessages, recordMessage]
  );

  // Handle pre-filled query from onboarding (e.g. /chat?q=What+is+RAG?)
  const [initialQuerySent, setInitialQuerySent] = useState(false);
  useEffect(() => {
    if (initialQuerySent || messages === undefined) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q && messages.length === 0) {
      setInitialQuerySent(true);
      window.history.replaceState(null, '', '/chat');
      setTimeout(() => {
        handleSendMessage(q);
      }, 300);
    }
  }, [messages, initialQuerySent, handleSendMessage]);

  const handleSelectConversation = useCallback(
    (chatId: string) => {
      clearMessages();
      setCurrentChatId(chatId);
      window.history.replaceState(null, '', `/chat?chatId=${chatId}`);
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

  const handlePreview = useCallback((document: { id: string }) => {
    setPreviewDocumentId(document.id);
  }, []);

  const sidebar = (
    <ChatSidebar
      documentListProps={{
        documents,
        isLoading: documentsQuery.isLoading,
        mutatingDocumentId: deleteMutation.variables || reingestMutation.variables,
        onUpload: () => setIsUploadOpen(true),
        onDelete: (id: string) => deleteMutation.mutate(id),
        onReingest: (id: string) => reingestMutation.mutate(id),
        onPreview: handlePreview,
        selectedDocumentId: previewDocumentId ?? undefined,
      }}
      historyListProps={{
        currentChatId,
        onSelectConversation: handleSelectConversation,
        onDeleteConversation: handleDeleteConversation,
        onNewChat: handleNewChat,
      }}
    />
  );

  return (
    <div className="h-full w-full overflow-hidden">
      <ProductTour />
      <ChatContainer
        messages={messages}
        sources={effectiveSources}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        agentMode={agentMode}
        chatId={currentChatId}
        chatTitle={chatTitle}
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
        onFeedback={(messageId, rating) => feedbackMutation.mutate({ messageId, rating })}
        hasMore={hasMore}
        isLoading={isLoading}
        isNewChatLoading={createChatMutation.isPending}
        sidebar={sidebar}
      />

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-xl border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-gradient">Upload Documents</DialogTitle>
          </DialogHeader>
          <UploadDropzone
            files={uploadState.files}
            onFilesSelected={handleUpload}
            onFileRemove={uploadState.removeFile}
            onRetry={uploadState.retryFile}
            onUrlSubmit={uploadState.submitUrl}
          />
        </DialogContent>
      </Dialog>

      <DocumentPreview
        document={
          previewDocumentId ? (documents.find((d) => d.id === previewDocumentId) ?? null) : null
        }
        isOpen={!!previewDocumentId}
        onClose={() => setPreviewDocumentId(null)}
        chunks={
          previewQuery.data?.map((chunk) => ({
            id: chunk.id,
            index: chunk.index,
            text: chunk.text,
          })) || []
        }
      />
    </div>
  );
}
