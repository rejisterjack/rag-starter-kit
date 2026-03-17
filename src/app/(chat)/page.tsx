"use client";

import { useState, useCallback } from "react";
import { ChatContainer } from "@/components/chat/chat-container";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentPreview } from "@/components/documents/document-preview";
import { useChat } from "@/hooks/use-chat";
import { type Source } from "@/components/chat/citations";
import { type Document } from "@/components/documents/document-card";

// Demo documents for initial state
const DEMO_DOCUMENTS: Document[] = [
  {
    id: "1",
    name: "Getting Started Guide.pdf",
    type: "application/pdf",
    size: 1024 * 1024 * 2.5,
    status: "completed",
    chunkCount: 42,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: "2",
    name: "API Documentation.md",
    type: "text/markdown",
    size: 1024 * 45,
    status: "completed",
    chunkCount: 12,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "3",
    name: "Project Requirements.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 1024 * 512,
    status: "processing",
    progress: 65,
    createdAt: new Date(),
  },
];

// Demo sources for initial state
const DEMO_SOURCES: Source[] = [
  {
    id: "s1",
    index: 1,
    documentName: "Getting Started Guide.pdf",
    documentType: "application/pdf",
    chunkText:
      "To get started with the RAG chatbot, you need to upload documents that will be indexed and used for answering your questions...",
    pageNumber: 5,
    relevanceScore: 0.95,
  },
  {
    id: "s2",
    index: 2,
    documentName: "API Documentation.md",
    documentType: "text/markdown",
    chunkText:
      "The API supports streaming responses for real-time chat experiences. Use the /api/chat endpoint with a POST request...",
    relevanceScore: 0.87,
  },
  {
    id: "s3",
    index: 3,
    documentName: "Getting Started Guide.pdf",
    documentType: "application/pdf",
    chunkText:
      "Supported file formats include PDF, Word documents (.docx), Markdown files (.md), and plain text files (.txt)...",
    pageNumber: 3,
    relevanceScore: 0.82,
  },
];

export default function ChatPage(): React.JSX.Element {
  const [documents, setDocuments] = useState<Document[]>(DEMO_DOCUMENTS);
  const [sources, setSources] = useState<Source[]>(DEMO_SOURCES);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onFinish: (message) => {
      // Update sources when message finishes
      if (message.sources) {
        setSources(message.sources);
      }
    },
  });

  const handleUpload = useCallback(() => {
    // In a real implementation, this would open a file picker
    // and handle file upload via API
    console.log("Upload clicked");
  }, []);

  const handleDeleteDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const handleReingest = useCallback((id: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? { ...doc, status: "processing" as const, progress: 0 }
          : doc
      )
    );
  }, []);

  const handlePreview = useCallback((document: Document) => {
    setPreviewDocument(document);
    setIsPreviewOpen(true);
  }, []);

  const handleNewChat = useCallback(() => {
    // Reset chat state
    window.location.reload();
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, files?: File[]) => {
      // If files are provided, upload them first
      if (files && files.length > 0) {
        // Add new documents to the list
        const newDocs: Document[] = files.map((file, index) => ({
          id: `new-${Date.now()}-${index}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          status: "pending",
          createdAt: new Date(),
        }));
        setDocuments((prev) => [...newDocs, ...prev]);
      }

      await sendMessage(content, files);
    },
    [sendMessage]
  );

  const sidebar = (
    <DocumentList
      documents={documents}
      onUpload={handleUpload}
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
        onSendMessage={handleSendMessage}
        onCancelStreaming={stop}
        onLoadMore={loadMore}
        onEditMessage={editMessage}
        onDeleteMessage={deleteMessage}
        onNewChat={handleNewChat}
        hasMore={hasMore}
        isLoading={isLoading}
        sidebar={sidebar}
      />

      <DocumentPreview
        document={previewDocument}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewDocument(null);
        }}
        chunks={[
          {
            id: "c1",
            index: 0,
            text: "This is a preview of how document chunks will appear. Each chunk represents a segment of the document that has been indexed for retrieval.",
          },
          {
            id: "c2",
            index: 1,
            text: "The RAG system breaks down documents into smaller chunks to enable more precise retrieval of relevant information when answering questions.",
          },
        ]}
      />
    </>
  );
}
