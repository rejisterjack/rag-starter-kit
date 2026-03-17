# Document Ingestion Pipeline

A production-ready document ingestion pipeline for the RAG chatbot that handles parsing, chunking, embedding, and storage of various document types.

## Overview

The ingestion pipeline processes documents through the following stages:

1. **Validate** - Check file size, type, virus scan placeholder
2. **Parse** - Extract text based on document type
3. **Chunk** - Apply chunking strategy (semantic/hierarchical)
4. **Embed** - Generate embeddings for each chunk
5. **Store** - Save to database with vector insertion

## Supported Document Types

| Type | Extensions | Parser | Features |
|------|-----------|--------|----------|
| PDF | `.pdf` | pdf-parse | Text extraction, page mapping, metadata, OCR placeholder |
| Word | `.docx` | mammoth | Paragraph structure, headers/footers, outline extraction |
| Text | `.txt`, `.md` | Native | Encoding detection, line mapping, streaming for large files |
| HTML | `.html`, `.htm` | cheerio | Content extraction, link/image extraction |
| URL | Web URLs | Playwright | JavaScript rendering, robots.txt respect, pagination |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Ingestion Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ Validate │ → │  Parse   │ → │  Chunk   │ → │  Embed   │ →   │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │Size/Type │   │ Text/    │   │ Semantic │   │ OpenAI   │     │
│  │ Duplicate│   │ Metadata │   │ Hierarchy│   │ Embedding│     │
│  │  Check   │   │ Extract  │   │  Split   │   │ Generate │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│                                                      │          │
│                                                      ▼          │
│                                                ┌──────────┐     │
│                                                │  Store   │     │
│                                                │ pgvector │     │
│                                                └──────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Inngest Queue   │
                    │  Background Jobs │
                    └──────────────────┘
```

## Quick Start

### Basic Document Upload

```typescript
import { UploadDropzone, useUpload } from '@/components/documents/upload-dropzone';

function DocumentUpload() {
  const { files, addFiles, removeFile, retryFile, submitUrl } = useUpload({
    workspaceId: 'workspace-123',
    onUploadComplete: (file, response) => {
      console.log('Upload complete:', response);
    },
    onUploadError: (file, error) => {
      console.error('Upload failed:', error);
    },
  });

  return (
    <UploadDropzone
      files={files}
      onFilesSelected={addFiles}
      onFileRemove={removeFile}
      onRetry={retryFile}
      onUrlSubmit={submitUrl}
      allowUrl={true}
    />
  );
}
```

### Programmatic Document Processing

```typescript
import { processDocument, processURL } from '@/lib/rag/ingestion';

// Process a file
const result = await processDocument({
  file: myFile,
  type: 'PDF',
  workspaceId: 'workspace-123',
  metadata: { source: 'user-upload' },
}, {
  onProgress: ({ stage, progress, message }) => {
    console.log(`${stage}: ${progress}% - ${message}`);
  },
});

// Process a URL
const result = await processURL('https://example.com/article', 'workspace-123');
```

### Background Job Processing

Documents are processed asynchronously via Inngest:

```typescript
// Queue a document for processing
import { queueDocumentForProcessing } from '@/lib/rag/ingestion';

await queueDocumentForProcessing(documentId, userId);

// Check status
import { getIngestionStatus } from '@/lib/rag/ingestion';

const status = await getIngestionStatus(documentId);
// { status: 'processing', progress: 45, chunkCount: 12, ... }
```

## API Routes

### POST /api/ingest

Upload a document or URL for processing.

**Request (multipart/form-data):**
```
file: <binary file data>
workspaceId: <optional workspace ID>
```

**Or for URLs:**
```
url: https://example.com/article
workspaceId: <optional workspace ID>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "document": {
      "id": "doc_123",
      "name": "document.pdf",
      "type": "PDF",
      "size": 1024000,
      "status": "pending",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "message": "Document uploaded and queued for processing",
    "processingTimeMs": 245
  }
}
```

### GET /api/ingest?id={documentId}

Check document processing status.

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "doc_123",
    "name": "document.pdf",
    "type": "PDF",
    "status": "processing",
    "progress": 65,
    "chunkCount": 12,
    "error": null,
    "metadata": {
      "size": 1024000,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:30Z",
      "processedAt": null
    }
  }
}
```

### DELETE /api/ingest?id={documentId}

Cancel a pending or processing document.

## Parser Details

### PDF Parser (`pdf.ts`)

```typescript
import { parsePDF, isScannedPDF, extractPageRange, searchInPDF } from '@/lib/rag/ingestion';

const parsed = await parsePDF(buffer);

// Access structured data
console.log(parsed.text);           // Full text
console.log(parsed.pages);          // Array of pages with text
console.log(parsed.metadata);       // Title, author, page count, etc.

// Check if scanned (low text density)
if (isScannedPDF(parsed)) {
  console.log('PDF may require OCR');
}

// Extract specific pages
const pages1To5 = extractPageRange(parsed.pages, 1, 5);

// Search within PDF
const matches = searchInPDF(parsed.pages, 'search term');
```

### DOCX Parser (`docx.ts`)

```typescript
import { parseDOCX, extractOutline, extractBySection, convertToMarkdown } from '@/lib/rag/ingestion';

const parsed = await parseDOCX(buffer);

// Access structured content
console.log(parsed.text);           // Full text
console.log(parsed.paragraphs);     // Array with heading info
console.log(parsed.metadata);       // Document properties

// Extract document outline
const outline = extractOutline(parsed.paragraphs);

// Get content by section
const introContent = extractBySection(parsed.paragraphs, 'Introduction');

// Convert to Markdown
const markdown = convertToMarkdown(parsed);
```

### TXT Parser (`txt.ts`)

```typescript
import { parseText, extractByLineRange, searchInText, extractMarkdownHeadings } from '@/lib/rag/ingestion';

const parsed = parseText(buffer, { detectEncoding: true });

// Access line-by-line data
console.log(parsed.lines);          // Array of lines with numbers
console.log(parsed.encoding);       // Detected encoding

// Search within text
const matches = searchInText(parsed, 'search term');

// Extract code blocks (for markdown files)
const codeBlocks = extractCodeBlocks(parsed.text);
```

### HTML Parser (`html.ts`)

```typescript
import { parseHTML, extractArticle, isArticle } from '@/lib/rag/ingestion';

const parsed = parseHTML(buffer, {
  baseUrl: 'https://example.com',
  extractMainContent: true,
});

// Access extracted content
console.log(parsed.text);           // Clean text (no HTML)
console.log(parsed.metadata);       // Title, description, etc.
console.log(parsed.links);          // All links
console.log(parsed.images);         // All images

// Check if article
if (isArticle(html)) {
  const article = extractArticle(html);
}
```

### URL Scraper (`url.ts`)

```typescript
import { scrapeURL, scrapePaginated, batchScrapeURLs } from '@/lib/rag/ingestion';

// Scrape single URL
const page = await scrapeURL('https://example.com/article', {
  waitForNetworkIdle: true,
  scrollToBottom: true,
});

// Scrape paginated content
for await (const page of scrapePaginated(
  'https://example.com/blog',
  {},
  { enabled: true, maxPages: 5 }
)) {
  console.log(page.text);
}

// Batch scrape multiple URLs
const results = await batchScrapeURLs([
  'https://example.com/page1',
  'https://example.com/page2',
], {}, 3);
```

## Inngest Events

The pipeline emits events during processing:

| Event | Description | Data |
|-------|-------------|------|
| `document/ingest` | Trigger ingestion | `{ documentId, userId }` |
| `document/ingestion.started` | Processing started | `{ documentId, userId, jobId }` |
| `document/ingestion.progress` | Progress update | `{ documentId, stage, progress, message }` |
| `document/ingestion.completed` | Processing complete | `{ documentId, chunkCount, processingTimeMs }` |
| `document/ingestion.failed` | Processing failed | `{ documentId, error }` |
| `document/ingestion.retry` | Retry request | `{ documentId, userId }` |

## Configuration

### Pipeline Options

```typescript
const pipeline = new IngestionPipeline({
  chunkSize: 1000,              // Characters per chunk
  chunkOverlap: 200,            // Overlap between chunks
  maxFileSize: 50 * 1024 * 1024, // 50MB limit
  allowedTypes: ['PDF', 'DOCX', 'TXT', 'MD', 'HTML'],
  enableVirusScan: false,       // Placeholder
  retryAttempts: 3,             // Retry failed operations
  retryDelay: 1000,             // Initial retry delay (ms)
  onProgress: ({ stage, progress, message }) => {
    // Track progress
  },
});
```

### Environment Variables

```bash
# Inngest (required for background processing)
INNGEST_EVENT_KEY="local"
INNGEST_SIGNING_KEY="signkey-test-123456789"

# OpenAI (required for embeddings)
OPENAI_API_KEY="sk-..."

# Optional: Playwright (for URL scraping)
# Install: npm install playwright && npx playwright install
```

## Error Handling

The pipeline implements retry logic with exponential backoff for recoverable errors:

```typescript
try {
  await pipeline.process(input);
} catch (error) {
  if (error.stage === 'parse') {
    // Parsing errors are not recoverable
    console.error('Document parsing failed:', error.message);
  } else if (error.recoverable) {
    // Can retry with retryFailedIngestion()
    await retryFailedIngestion(documentId);
  }
}
```

### Dead Letter Queue

Failed documents that are not recoverable are added to a dead letter queue:

```typescript
const failed = pipeline.getDeadLetterQueue();
for (const { input, error } of failed) {
  console.log('Failed:', input.file?.name, error.message);
}
```

## Idempotency

Duplicate document detection is based on content hash:

```typescript
// Uploading the same content twice will return an error
const result = await fetch('/api/ingest', {
  method: 'POST',
  body: formData, // Same file
});

// Second upload returns:
// { error: { code: 'DUPLICATE_CONTENT', ... } }
```

## Bulk Processing

Process multiple documents:

```typescript
import { bulkProcessDocuments } from '@/lib/rag/ingestion';

const results = await bulkProcessDocuments([
  { file: file1, type: 'PDF', workspaceId: 'ws-1' },
  { file: file2, type: 'DOCX', workspaceId: 'ws-1' },
  { url: 'https://example.com', type: 'URL', workspaceId: 'ws-1' },
], {
  concurrency: 3,
  onProgress: (completed, total, current) => {
    console.log(`${completed}/${total}: ${current}`);
  },
});
```

Or queue via Inngest:

```typescript
await inngest.send({
  name: 'document/bulk-ingest',
  data: {
    documentIds: ['doc-1', 'doc-2', 'doc-3'],
    userId: 'user-123',
  },
});
```

## Development

### Running Inngest Dev Server

```bash
pnpm inngest:dev
```

### Database Migrations

After schema changes:

```bash
pnpm db:migrate
pnpm db:generate
```

### Testing Parsers

```typescript
// Test individual parsers
import { parsePDF } from '@/lib/rag/ingestion/parsers/pdf';

const fs = require('fs');
const buffer = fs.readFileSync('test.pdf');
const parsed = await parsePDF(buffer);
console.log(parsed.text);
```

## Performance Considerations

1. **File Size**: Large files are processed in chunks to avoid memory issues
2. **Embeddings**: Generated in batches (20 chunks at a time)
3. **Storage**: Chunks inserted in batches (50 at a time)
4. **URL Scraping**: Respects robots.txt with configurable crawl delay
5. **Concurrency**: Inngest functions limited to 5 concurrent document processes

## Security

- File type validation by MIME type and extension
- File size limits (configurable, default 50MB)
- Virus scan placeholder (integrate with ClamAV or similar)
- User authentication via NextAuth
- Workspace access control
- Robots.txt compliance for web scraping
