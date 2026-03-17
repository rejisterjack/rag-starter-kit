/**
 * Document Fixtures
 * 
 * Sample documents for testing document processing, ingestion, and RAG pipeline.
 */

import type { Document, Chunk } from '@prisma/client';

/**
 * Sample PDF document metadata
 */
export const samplePDFDocument: Partial<Document> = {
  id: 'doc-001',
  name: 'annual-report-2024.pdf',
  type: 'application/pdf',
  size: 2_500_000, // 2.5MB
  status: 'processed',
  workspaceId: 'workspace-001',
  userId: 'user-001',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:30:00Z'),
  metadata: {
    pages: 45,
    author: 'Finance Department',
    title: 'Annual Financial Report 2024',
    language: 'en',
  },
};

/**
 * Sample Word document metadata
 */
export const sampleWordDocument: Partial<Document> = {
  id: 'doc-002',
  name: 'project-specs.docx',
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  size: 500_000,
  status: 'processed',
  workspaceId: 'workspace-001',
  userId: 'user-001',
  createdAt: new Date('2024-01-16T14:00:00Z'),
  updatedAt: new Date('2024-01-16T14:15:00Z'),
  metadata: {
    pages: 12,
    author: 'Engineering Team',
    title: 'Project Specifications',
    language: 'en',
  },
};

/**
 * Sample text document metadata
 */
export const sampleTextDocument: Partial<Document> = {
  id: 'doc-003',
  name: 'meeting-notes.txt',
  type: 'text/plain',
  size: 15_000,
  status: 'processed',
  workspaceId: 'workspace-002',
  userId: 'user-002',
  createdAt: new Date('2024-01-17T09:00:00Z'),
  updatedAt: new Date('2024-01-17T09:05:00Z'),
  metadata: {
    lines: 250,
    author: 'Product Team',
    language: 'en',
  },
};

/**
 * Sample document in processing state
 */
export const sampleProcessingDocument: Partial<Document> = {
  id: 'doc-004',
  name: 'large-file.pdf',
  type: 'application/pdf',
  size: 50_000_000,
  status: 'processing',
  workspaceId: 'workspace-001',
  userId: 'user-001',
  createdAt: new Date('2024-01-18T08:00:00Z'),
  updatedAt: new Date('2024-01-18T08:00:00Z'),
  metadata: {},
};

/**
 * Sample document with error state
 */
export const sampleErrorDocument: Partial<Document> = {
  id: 'doc-005',
  name: 'corrupted.pdf',
  type: 'application/pdf',
  size: 0,
  status: 'error',
  workspaceId: 'workspace-001',
  userId: 'user-001',
  createdAt: new Date('2024-01-19T11:00:00Z'),
  updatedAt: new Date('2024-01-19T11:05:00Z'),
  metadata: {
    error: 'Failed to parse PDF: Invalid file format',
  },
};

/**
 * Sample extracted text content (simulating PDF extraction result)
 */
export const sampleFinancialReportContent = `
Annual Financial Report 2024
Executive Summary

This report presents the financial performance of our company for fiscal year 2024.
Total revenue reached $150 million, representing a 25% increase from the previous year.
Net profit margin improved to 18%, up from 15% in 2023.

Revenue Breakdown

Q1 2024: $32 million
Q2 2024: $38 million
Q3 2024: $35 million
Q4 2024: $45 million

The strongest growth was observed in our enterprise segment, which grew by 40% year-over-year.
Our SaaS products contributed $90 million to total revenue, while professional services added $60 million.

Expenses

Total operating expenses were $123 million for the year.
Research and development investments increased to $25 million.
Sales and marketing expenses totaled $35 million.
General and administrative costs remained stable at $18 million.

Future Outlook

We project continued growth in 2025, with revenue targets set at $200 million.
Key focus areas include AI-powered features and international expansion.
`;

/**
 * Sample technical documentation content
 */
export const sampleTechnicalDocumentation = `
API Documentation v2.0
Authentication

All API requests require authentication using Bearer tokens.
Include the Authorization header with your API key.
Example: Authorization: Bearer sk_live_xxxxxxxxxx

Rate Limits

The API implements rate limiting based on your plan:
- Free tier: 100 requests per hour
- Pro tier: 10,000 requests per hour
- Enterprise: Unlimited requests

Rate limit headers are included in all responses:
- X-RateLimit-Limit: Maximum requests allowed
- X-RateLimit-Remaining: Requests remaining in current window
- X-RateLimit-Reset: Timestamp when limit resets

Endpoints

GET /api/v2/documents
List all documents in your workspace.
Query parameters:
- workspaceId (required): The workspace identifier
- limit (optional): Number of results (default: 20, max: 100)
- offset (optional): Pagination offset

POST /api/v2/chat
Send a message to the AI assistant.
Request body:
{
  "message": "What is the revenue for Q3?",
  "workspaceId": "ws_123",
  "context": {
    "documents": ["doc_1", "doc_2"]
  }
}
`;

/**
 * Collection of all sample documents
 */
export const sampleDocuments: Partial<Document>[] = [
  samplePDFDocument,
  sampleWordDocument,
  sampleTextDocument,
  sampleProcessingDocument,
  sampleErrorDocument,
];

/**
 * Mock File objects for testing file uploads
 */
export const createMockFile = (
  name: string,
  type: string,
  size: number
): File => {
  const blob = new Blob(['mock content'], { type });
  return new File([blob], name, { type });
};

export const mockPDFFile = createMockFile(
  'test-document.pdf',
  'application/pdf',
  1_000_000
);

export const mockWordFile = createMockFile(
  'test-document.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  500_000
);

export const mockTextFile = createMockFile(
  'test-document.txt',
  'text/plain',
  10_000
);

export const mockImageFile = createMockFile(
  'test-image.png',
  'image/png',
  2_000_000
);

/**
 * Invalid file for testing validation
 */
export const mockInvalidFile = createMockFile(
  'test.exe',
  'application/x-msdownload',
  5_000_000
);

/**
 * Oversized file for testing size limits
 */
export const mockOversizedFile = Object.defineProperty(
  createMockFile('large.pdf', 'application/pdf', 0),
  'size',
  { value: 100 * 1024 * 1024 } // 100MB
) as File;
