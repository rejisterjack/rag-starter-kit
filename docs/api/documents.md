# Documents API

The Documents API handles document upload, processing, and management for the RAG pipeline.

## Overview

- **Supported Formats**: PDF, DOCX, TXT, MD, HTML
- **Background Processing**: Async ingestion with progress tracking
- **OCR Support**: Text extraction from scanned PDFs
- **Version Control**: Document versioning and history

## Endpoints

### POST /api/ingest

Upload and process a new document.

#### Request

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Document file (PDF, DOCX, TXT, MD) |
| `workspaceId` | string | No | Target workspace (defaults to user's active) |
| `metadata` | JSON | No | Custom metadata object |

#### Example Request

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Cookie: next-auth.session-token=..." \
  -F "file=@document.pdf" \
  -F "metadata={\"category\":\"financial\",\"year\":2024}"
```

#### JavaScript Example

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('metadata', JSON.stringify({
  category: 'financial',
  tags: ['Q4', 'report']
}));

const response = await fetch('/api/ingest', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
```

#### Response

```json
{
  "success": true,
  "data": {
    "documentId": "doc_abc123",
    "status": "processing",
    "message": "Document queued for processing",
    "estimatedTime": "30-60 seconds"
  }
}
```

#### Processing Status Values

| Status | Description |
|--------|-------------|
| `pending` | Queued for processing |
| `processing` | Currently being ingested |
| `completed` | Ready for search |
| `failed` | Error during processing |

### GET /api/documents

List documents in a workspace.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `workspaceId` | string | - | Filter by workspace |
| `status` | string | - | Filter by status |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |
| `search` | string | - | Search in filename |
| `sortBy` | string | `createdAt` | Sort field |
| `sortOrder` | string | `desc` | `asc` or `desc` |

#### Response

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_abc123",
        "name": "Q4_Report_2024.pdf",
        "type": "application/pdf",
        "size": 2048576,
        "status": "completed",
        "chunkCount": 42,
        "metadata": {
          "category": "financial",
          "year": 2024
        },
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:31:00Z",
        "createdBy": {
          "id": "user_123",
          "name": "John Doe"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

### GET /api/documents/:id

Get detailed information about a specific document.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "doc_abc123",
    "name": "Q4_Report_2024.pdf",
    "type": "application/pdf",
    "size": 2048576,
    "status": "completed",
    "metadata": {
      "category": "financial",
      "year": 2024
    },
    "chunks": [
      {
        "id": "chunk_1",
        "index": 0,
        "content": "Quarterly revenue increased by...",
        "tokenCount": 256
      }
    ],
    "processingDetails": {
      "startedAt": "2024-01-15T10:30:00Z",
      "completedAt": "2024-01-15T10:31:00Z",
      "extractor": "pdf-parse",
      "chunkingStrategy": "recursive",
      "embeddingModel": "text-embedding-004"
    }
  }
}
```

### DELETE /api/documents/:id

Delete a document and all its associated data.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Document deleted successfully",
    "deletedChunks": 42,
    "deletedEmbeddings": 42
  }
}
```

### POST /api/documents/:id/reprocess

Reprocess a document (useful after updating chunking settings).

#### Request Body

```json
{
  "chunkSize": 1500,
  "chunkOverlap": 300,
  "embeddingModel": "text-embedding-004"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "documentId": "doc_abc123",
    "status": "processing",
    "message": "Document queued for reprocessing"
  }
}
```

## Background Processing

Documents are processed asynchronously using Inngest:

```
Upload → Queue → Extract Text → Chunk → Embed → Store
```

### Checking Processing Status

```javascript
// Poll for status
async function checkStatus(documentId) {
  const response = await fetch(`/api/documents/${documentId}`);
  const { data } = await response.json();
  
  if (data.status === 'completed') {
    console.log('Document ready!');
  } else if (data.status === 'failed') {
    console.error('Processing failed:', data.error);
  } else {
    setTimeout(() => checkStatus(documentId), 2000);
  }
}
```

### Webhook Notifications (Optional)

Configure webhooks to receive processing notifications:

```json
{
  "events": ["document.processed", "document.failed"],
  "url": "https://your-app.com/webhooks/documents"
}
```

## Supported File Types

| Extension | MIME Type | Processor | OCR |
|-----------|-----------|-----------|-----|
| .pdf | application/pdf | pdf-parse | Yes |
| .docx | application/vnd.openxmlformats | mammoth | No |
| .txt | text/plain | native | No |
| .md | text/markdown | native | No |
| .html | text/html | cheerio | No |

## File Size Limits

| Plan | Max File Size | Max Total Storage |
|------|---------------|-------------------|
| Free | 10 MB | 100 MB |
| Pro | 50 MB | 10 GB |
| Enterprise | 100 MB | Unlimited |

## Chunking Strategies

Documents are split into chunks for vector storage:

### Recursive Chunking (Default)

```typescript
{
  chunkSize: 1000,      // Characters per chunk
  chunkOverlap: 200,    // Overlap between chunks
  separators: ['\n\n', '\n', ' ', '']  // Priority order
}
```

### Semantic Chunking

Uses AI to split at semantic boundaries (slower, higher quality).

### Fixed-Size Chunking

Simple fixed character count (fastest).

## Metadata Schema

Custom metadata can be attached to documents:

```typescript
interface DocumentMetadata {
  // System fields (auto-generated)
  source?: string;           // Upload source
  uploadedAt?: string;       // ISO timestamp
  processedAt?: string;      // ISO timestamp
  
  // Custom fields (user-defined)
  [key: string]: unknown;
}
```

## Error Handling

### Upload Errors

| Code | HTTP | Description |
|------|------|-------------|
| `FILE_TOO_LARGE` | 413 | Exceeds size limit |
| `INVALID_FILE_TYPE` | 415 | Unsupported format |
| `VIRUS_DETECTED` | 400 | File failed virus scan |
| `PROCESSING_FAILED` | 500 | Ingestion error |

### Processing Errors

```json
{
  "success": false,
  "error": "PDF extraction failed",
  "code": "PROCESSING_FAILED",
  "details": {
    "stage": "text_extraction",
    "retryable": true
  }
}
```

## Batch Operations

### Upload Multiple Documents

```bash
curl -X POST http://localhost:3000/api/ingest/batch \
  -F "files[]=@doc1.pdf" \
  -F "files[]=@doc2.docx" \
  -F "metadata={\"batchId\":\"batch_123\"}"
```

### Delete Multiple Documents

```bash
DELETE /api/documents/batch
{
  "documentIds": ["doc_1", "doc_2", "doc_3"]
}
```

## Storage Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Document   │────>│   MinIO     │     │  PostgreSQL │
│   Upload    │     │    (S3)     │     │  (Metadata) │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                          │
      │     ┌─────────────┐     ┌─────────────┐  │
      └────>│   Inngest   │────>│ pgvector    │<─┘
            │  (Queue)    │     │(Embeddings) │
            └─────────────┘     └─────────────┘
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/ingest | 10 | 1 minute |
| GET /api/documents | 60 | 1 minute |
| DELETE /api/documents/:id | 20 | 1 minute |

## Best Practices

1. **Use appropriate chunk sizes**: Larger for code/docs, smaller for Q&A
2. **Add descriptive metadata**: Improves searchability
3. **Implement progress UI**: Show processing status
4. **Handle failures gracefully**: Allow retry for failed documents
5. **Clean up old versions**: Delete outdated document versions
