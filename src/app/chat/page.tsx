'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChatContainer } from '@/components/chat/chat-container';
import type { Source } from '@/components/chat/citations';
import { DocumentList } from '@/components/documents/document-list';
import { DocumentPreview } from '@/components/documents/document-preview';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useChat } from '@/hooks/use-chat';
import { useCreateChat, useSendFeedback } from '@/hooks/use-chat-operations';
import {
  useDeleteDocument,
  useDocumentPreview,
  useDocuments,
  useReingestDocument,
  useUploadDocument,
  useUploadUrl,
} from '@/hooks/use-documents';

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
  const [selectedModel, setSelectedModel] = useState('arcee-ai/trinity-large-preview:free');
  const [chatTitle, setChatTitle] = useState('New Chat');

  // TanStack Query hooks
  const documentsQuery = useDocuments();
  const uploadMutation = useUploadDocument();
  const uploadUrlMutation = useUploadUrl();
  const deleteMutation = useDeleteDocument();
  const reingestMutation = useReingestDocument();
  const previewQuery = useDocumentPreview(previewDocumentId);
  const createChatMutation = useCreateChat();
  const feedbackMutation = useSendFeedback();

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
    model: selectedModel,
  });

  // On mount: load chat if we have a chatId from URL
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    const chatId = getUrlChatId();
    if (chatId) {
      setCurrentChatId(chatId);
      loadMessages(chatId);
    }
  }, []);

  const effectiveSources = chatSources.length > 0 ? chatSources : sources;

  const handleUpload = useCallback(
    async (files: File[]) => {
      await uploadMutation.mutateAsync(files);
      setIsUploadOpen(false);
    },
    [uploadMutation]
  );

  const handleNewChat = useCallback(async () => {
    const newChatId = await createChatMutation.mutateAsync({
      title: 'New Chat',
      model: selectedModel,
    });
    if (newChatId) {
      clearMessages();
      setCurrentChatId(newChatId);
      setChatTitle('New Chat');
      setSources([]);
      window.history.replaceState(null, '', `/chat?chatId=${newChatId}`);
    }
  }, [createChatMutation, clearMessages, selectedModel]);

  const handleSendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if (files && files.length > 0) {
        await handleUpload(files);
      }

      let chatId = currentChatId;

      if (!chatId) {
        const newChatId = await createChatMutation.mutateAsync({
          title: 'New Chat',
          model: selectedModel,
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
    },
    [sendMessage, handleUpload, currentChatId, createChatMutation, clearMessages, selectedModel]
  );

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
    <DocumentList
      documents={documents}
      isLoading={documentsQuery.isLoading}
      onUpload={() => setIsUploadOpen(true)}
      onDelete={(id) => deleteMutation.mutate(id)}
      onReingest={(id) => reingestMutation.mutate(id)}
      onPreview={handlePreview}
      selectedDocumentId={previewDocumentId ?? undefined}
    />
  );

  return (
    <div className="h-full w-full overflow-hidden">
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
        onFeedback={(messageId, rating) => feedbackMutation.mutate({ messageId, rating })}
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
              await uploadUrlMutation.mutateAsync(url);
              setIsUploadOpen(false);
            }}
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
