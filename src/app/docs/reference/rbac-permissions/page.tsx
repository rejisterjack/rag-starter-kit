export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'RBAC Permissions',
  description:
    'The 18-permission role-based access control system for workspace authorization in the RAG Starter Kit.',
};

const roles = [
  {
    name: 'OWNER',
    description: 'Full control over the workspace including member management.',
    permissions: 'All permissions',
  },
  {
    name: 'ADMIN',
    description: 'Manage members and workspace settings, but cannot delete the workspace.',
    permissions: 'All except workspace deletion',
  },
  {
    name: 'EDITOR',
    description: 'Upload documents, manage conversations, and use chat features.',
    permissions: 'Documents (CRUD), Chat, Sources',
  },
  {
    name: 'VIEWER',
    description: 'Read-only access to documents and chat history.',
    permissions: 'Documents (read), Chat (read)',
  },
];

const permissions = [
  {
    resource: 'workspace',
    actions: ['view', 'update', 'delete', 'manage_members', 'manage_settings'],
  },
  { resource: 'documents', actions: ['view', 'create', 'update', 'delete', 'manage_ingestion'] },
  { resource: 'chat', actions: ['view', 'create', 'manage_conversations'] },
  { resource: 'sources', actions: ['view', 'export'] },
  { resource: 'api_keys', actions: ['view', 'create', 'revoke'] },
  { resource: 'audit_logs', actions: ['view'] },
];

export default function RbacPermissionsPage() {
  return (
    <DocsShell
      path="/docs/reference/rbac-permissions"
      title="RBAC Permissions"
      description="Role-based access control reference: roles, permissions, and inheritance."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">RBAC Permissions</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The RAG Starter Kit implements role-based access control (RBAC) with 18 distinct
          permissions across 6 resource types. Permissions are enforced at the API route level and
          checked against the user&apos;s role in the workspace.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Roles</h2>
            <div className="space-y-3">
              {roles.map((role) => (
                <div key={role.name} className="p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono font-bold">
                      {role.name}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Permissions:</strong> {role.permissions}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Permission Matrix</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-semibold">Resource</th>
                    <th className="px-4 py-2 font-semibold">Action</th>
                    <th className="px-4 py-2 font-semibold text-center">OWNER</th>
                    <th className="px-4 py-2 font-semibold text-center">ADMIN</th>
                    <th className="px-4 py-2 font-semibold text-center">EDITOR</th>
                    <th className="px-4 py-2 font-semibold text-center">VIEWER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {permissions.map((p) =>
                    p.actions.map((action, i) => (
                      <tr key={`${p.resource}-${action}`}>
                        {i === 0 && (
                          <td
                            className="px-4 py-1.5 font-mono text-xs text-primary align-top"
                            rowSpan={p.actions.length}
                          >
                            {p.resource}
                          </td>
                        )}
                        <td className="px-4 py-1.5 font-mono text-xs text-muted-foreground">
                          {action}
                        </td>
                        <td className="px-4 py-1.5 text-center text-green-600">&#10003;</td>
                        <td className="px-4 py-1.5 text-center text-green-600">&#10003;</td>
                        <td className="px-4 py-1.5 text-center">
                          {(p.resource === 'workspace' && action !== 'view') ||
                          p.resource === 'audit_logs' ? (
                            <span className="text-red-400">&#10007;</span>
                          ) : (
                            <span className="text-green-600">&#10003;</span>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          {action === 'view' ? (
                            <span className="text-green-600">&#10003;</span>
                          ) : (
                            <span className="text-red-400">&#10007;</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">How It Works</h2>
            <p className="text-muted-foreground mb-3">
              Permission checks are implemented in{' '}
              <code className="bg-muted px-1 rounded text-sm">
                src/lib/workspace/permissions.ts
              </code>
              . Every API route that accesses workspace resources calls{' '}
              <code className="bg-muted px-1 rounded text-sm">checkPermission()</code>
              which verifies the user&apos;s role in the workspace against the required permission.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm">
              <p className="text-muted-foreground">
                <strong>Example:</strong> To upload a document, the user must have{' '}
                <code className="bg-card px-1 rounded">documents:create</code> permission. An EDITOR
                can upload, but a VIEWER receives a 403 Forbidden response.
              </p>
            </div>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/reference/database-schema"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Database Schema
            </Link>
            <Link href="/docs" className="text-sm text-primary hover:underline">
              Docs Home &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
