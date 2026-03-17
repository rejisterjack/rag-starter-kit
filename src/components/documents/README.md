# Document Components

Components for managing and displaying documents in the RAG chatbot.

## Features

- **Document Upload**: Drag-and-drop and file picker support
- **Processing Status**: Visual indicators for document processing states
- **Search & Filter**: Find documents by name and filter by status
- **Preview**: View document chunks with highlighting
- **Actions**: Delete, re-ingest, and preview documents

## Components

### `DocumentList`
Main document list with search, filter, and upload functionality.

```tsx
import { DocumentList } from "@/components/documents";

<DocumentList
  documents={documents}
  onUpload={handleUpload}
  onDelete={handleDelete}
  onReingest={handleReingest}
  onPreview={handlePreview}
  isLoading={isLoading}
/>
```

### `DocumentCard`
Individual document item with status indicators and actions.

```tsx
import { DocumentCard, type Document } from "@/components/documents";

const document: Document = {
  id: "1",
  name: "document.pdf",
  type: "application/pdf",
  size: 1024000,
  status: "completed",
  chunkCount: 42,
  createdAt: new Date(),
};

<DocumentCard
  document={document}
  onDelete={handleDelete}
  onReingest={handleReingest}
  isSelected={false}
/>
```

### `DocumentPreview`
Modal/panel for viewing document chunks with highlighting.

```tsx
import { DocumentPreview } from "@/components/documents";

<DocumentPreview
  document={document}
  isOpen={isOpen}
  onClose={handleClose}
  chunks={chunks}
  highlightedChunkId="chunk-1"
/>
```

## Types

```tsx
import type { Document, DocumentStatus } from "@/components/documents";

// Document status
 type DocumentStatus = "pending" | "processing" | "completed" | "error";

// Document object
interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status: DocumentStatus;
  progress?: number;
  chunkCount?: number;
  createdAt: Date;
  errorMessage?: string;
}
```

## File Icons

Documents display icons based on MIME type:
- PDF, TXT, MD → `FileText`
- XLSX, CSV → `FileSpreadsheet`
- Images → `FileImage`
- HTML, JSON → `FileCode`
- Other → `File`

## Status Badges

- **Ready** (green): Document processed successfully
- **Processing** (blue): Document is being indexed
- **Pending** (gray): Document queued for processing
- **Error** (red): Processing failed with error message
