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

export default function ChatPage(): React.ReactElement {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewChunks, setPreviewChunks] = useState<DocumentChunk[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [, setIsLoadingPreview] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>();
  const [agentMode, setAgentMode] = useState(false);

  const {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    stop,
    deleteMessage,
    editMessage,
    hasMore,
    loadMore,
  } = useChat({
    conversationId: currentChatId,
    agentMode,
    onError: (error) => {
      toast.error(error.message || 'An error occurred');
    },
    onFinish: (message) => {
      // Update sources when message finishes
      if (message.sources) {
        setSources(message.sources);
      }
    },
  });

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      if (data.success) {
        // Convert API documents to component documents
        const formattedDocs: Document[] = data.data.documents.map((doc: ApiDocument) => ({
          ...doc,
          createdAt: new Date(doc.createdAt),
        }));
        setDocuments(formattedDocs);
      }
    } catch (_error: unknown) {
      toast.error('Failed to load documents');
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  // Fetch documents on mount
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

  const handleUpload = useCallback(
    async (files: File[]) => {
      const uploadedDocs: Document[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch('/api/ingest', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            toast.error(
              `Failed to upload ${file.name}: ${error.error?.message || 'Unknown error'}`
            );
            continue;
          }

          const data = await response.json();
          if (data.success) {
            const newDoc: Document = {
              id: data.data.document.id,
              name: data.data.document.name,
              type: file.type || 'application/octet-stream',
              size: file.size,
              status: 'pending',
              createdAt: new Date(),
            };
            uploadedDocs.push(newDoc);
            toast.success(`Uploading ${file.name}...`);
          }
        } catch (_error: unknown) {
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      if (uploadedDocs.length > 0) {
        setDocuments((prev) => [...uploadedDocs, ...prev]);
        // Start polling for status
        setTimeout(fetchDocuments, 1000);
      }

      setIsUploadOpen(false);
    },
    [fetchDocuments]
  );

  const handleDeleteDocument = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/documents?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      toast.success('Document deleted');
    } catch (_error: unknown) {
      toast.error('Failed to delete document');
    }
  }, []);

  const handleReingest = useCallback(
    async (id: string) => {
      // Update UI to show processing state
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id ? { ...doc, status: 'processing' as const, progress: 0 } : doc
        )
      );

      // Trigger re-ingestion via the ingest API
      try {
        const response = await fetch('/api/ingest/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: id }),
        });

        if (!response.ok) {
          throw new Error('Failed to re-ingest document');
        }

        toast.success('Re-ingestion started');
        setTimeout(fetchDocuments, 1000);
      } catch (_error: unknown) {
        toast.error('Failed to re-ingest document');
        // Revert status
        fetchDocuments();
      }
    },
    [
      // Revert status
      fetchDocuments,
    ]
  );

  const handlePreview = useCallback(async (document: Document) => {
    setPreviewDocument(document);
    setIsPreviewOpen(true);
    setIsLoadingPreview(true);

    try {
      const response = await fetch(`/api/documents/${document.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document details');
      }
      const data = await response.json();
      if (data.success) {
        setPreviewChunks(data.data.chunks || []);
      }
    } catch (_error: unknown) {
      toast.error('Failed to load document preview');
      setPreviewChunks([]);
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });

      if (!response.ok) {
        throw new Error('Failed to create chat');
      }

      const data = await response.json();
      if (data.success) {
        setCurrentChatId(data.data.chat.id);
        // Clear messages by reloading the page with new chat ID
        window.location.href = `/chat?chatId=${data.data.chat.id}`;
      }
    } catch (_error: unknown) {
      toast.error('Failed to create new chat');
    }
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, files?: File[]) => {
      // If files are provided, upload them first
      if (files && files.length > 0) {
        await handleUpload(files);
      }

      await sendMessage(content, files);
    },
    [sendMessage, handleUpload]
  );

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
        sources={sources}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        agentMode={agentMode}
        onSendMessage={handleSendMessage}
        onCancelStreaming={stop}
        onLoadMore={loadMore}
        onEditMessage={editMessage}
        onDeleteMessage={deleteMessage}
        onNewChat={handleNewChat}
        onAgentModeToggle={setAgentMode}
        hasMore={hasMore}
        isLoading={isLoading}
        sidebar={sidebar}
      />

      {/* Upload Dialog */}
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

                const response = await fetch('/api/ingest', {
                  method: 'POST',
                  body: formData,
                });

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

      {/* Document Preview Dialog */}
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
