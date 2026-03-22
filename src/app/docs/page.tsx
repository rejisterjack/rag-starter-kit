import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'API Documentation',
  description: 'RAG Starter Kit API Reference',
};

interface Endpoint {
  method: string;
  path: string;
  summary: string;
  description?: string;
}

const endpoints: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/chat',
    summary: 'Send a chat message',
    description: 'Process a chat message with RAG context and return streaming or non-streaming response',
  },
  {
    method: 'GET',
    path: '/api/chat',
    summary: 'Get chat history',
    description: 'Retrieve message history for a conversation',
  },
  {
    method: 'DELETE',
    path: '/api/chat',
    summary: 'Delete a chat',
    description: 'Delete a chat and all its messages',
  },
  {
    method: 'POST',
    path: '/api/ingest',
    summary: 'Upload a document',
    description: 'Upload and queue a document for processing with magic byte validation',
  },
  {
    method: 'GET',
    path: '/api/ingest',
    summary: 'Check document status',
    description: 'Get processing status for an uploaded document',
  },
  {
    method: 'DELETE',
    path: '/api/ingest',
    summary: 'Delete/cancel document',
    description: 'Cancel processing or delete a document',
  },
  {
    method: 'GET',
    path: '/api/health',
    summary: 'Health check',
    description: 'Check API and dependency health status (database, vector extension, AI services, storage)',
  },
  {
    method: 'GET',
    path: '/api/workspaces',
    summary: 'List workspaces',
    description: 'Get all workspaces for the authenticated user',
  },
  {
    method: 'POST',
    path: '/api/workspaces',
    summary: 'Create workspace',
    description: 'Create a new workspace with settings',
  },
  {
    method: 'GET',
    path: '/api/workspaces/{id}',
    summary: 'Get workspace',
    description: 'Get workspace details by ID',
  },
  {
    method: 'PATCH',
    path: '/api/workspaces/{id}',
    summary: 'Update workspace',
    description: 'Update workspace settings with strict schema validation',
  },
  {
    method: 'DELETE',
    path: '/api/workspaces/{id}',
    summary: 'Delete workspace',
    description: 'Delete a workspace and all associated data',
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function DocsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
        <p className="text-muted-foreground">
          RAG Starter Kit REST API reference. All endpoints require authentication via JWT or API key.
        </p>
      </div>

      <div className="grid gap-4 mb-8">
        <div className="flex gap-4">
          <Link
            href="/api/docs"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            OpenAPI JSON Spec
          </Link>
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Health Check
          </a>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Endpoints</h2>
        {endpoints.map((endpoint) => (
          <div
            key={`${endpoint.method}-${endpoint.path}`}
            className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${methodColors[endpoint.method]}`}
              >
                {endpoint.method}
              </span>
              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{endpoint.path}</code>
            </div>
            <div className="mt-2 ml-16">
              <h3 className="font-medium">{endpoint.summary}</h3>
              {endpoint.description && (
                <p className="text-sm text-muted-foreground mt-1">{endpoint.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold">Authentication</h2>
        <div className="prose dark:prose-invert max-w-none">
          <p>The API supports two authentication methods:</p>
          <ul>
            <li>
              <strong>JWT Token (Recommended for browser clients):</strong> Include the session cookie
              from NextAuth.js authentication.
            </li>
            <li>
              <strong>API Key:</strong> Include the <code>X-API-Key</code> header with your API key.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Response Format</h2>
        <div className="prose dark:prose-invert max-w-none">
          <p>All API responses follow a consistent format:</p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
            <code>{`{
  "success": true,
  "data": { ... },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}`}</code>
          </pre>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Security Features</h2>
        <div className="prose dark:prose-invert max-w-none">
          <ul>
            <li>
              <strong>Magic Byte Validation:</strong> Uploaded files are validated against their
              content to prevent renamed file attacks.
            </li>
            <li>
              <strong>Rate Limiting:</strong> All endpoints have rate limits based on user ID or IP
              address.
            </li>
            <li>
              <strong>CSRF Protection:</strong> State-changing requests require a valid CSRF token.
            </li>
            <li>
              <strong>CSP Nonces:</strong> Content Security Policy uses per-request nonces for
              script execution.
            </li>
            <li>
              <strong>Audit Logging:</strong> All security-relevant actions are logged with user
              context.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> For the complete OpenAPI specification, visit{' '}
          <a href="/api/docs" className="text-primary hover:underline">
            /api/docs
          </a>
          . To enhance this documentation with Swagger UI, install the optional dependencies:{' '}
          <code>swagger-ui-react</code> and <code>next-swagger-doc</code>.
        </p>
      </div>
    </div>
  );
}
