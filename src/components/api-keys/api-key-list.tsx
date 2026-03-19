'use client';

import { useState } from 'react';
import { Copy, Eye, EyeOff, RefreshCw, Trash2, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  status: 'active' | 'revoked' | 'expired';
  permissions: string[];
  requestCount: number;
}

interface ApiKeyListProps {
  apiKeys: ApiKey[];
  onCopy: (keyId: string) => void;
  onRevoke: (keyId: string) => void;
  onRegenerate: (keyId: string) => void;
  onViewUsage: (keyId: string) => void;
  className?: string;
}

export function ApiKeyList({
  apiKeys,
  onCopy,
  onRevoke,
  onRegenerate,
  onViewUsage,
  className,
}: ApiKeyListProps) {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const toggleReveal = (keyId: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: ApiKey['status']) => {
    const variants: Record<typeof status, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      revoked: 'destructive',
      expired: 'secondary',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const handleCopy = async (keyId: string) => {
    await onCopy(keyId);
    toast.success('API key copied to clipboard');
  };

  const handleRevoke = (keyId: string) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      onRevoke(keyId);
      toast.success('API key revoked');
    }
  };

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Requests</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                No API keys yet. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            apiKeys.map((apiKey) => (
              <TableRow key={apiKey.id}>
                <TableCell className="font-medium">{apiKey.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-sm">
                      {revealedKeys.has(apiKey.id)
                        ? apiKey.keyPreview
                        : `${apiKey.keyPreview.slice(0, 8)}...${apiKey.keyPreview.slice(-4)}`}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleReveal(apiKey.id)}
                    >
                      {revealedKeys.has(apiKey.id) ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(apiKey.status)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(apiKey.createdAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {apiKey.lastUsedAt
                    ? format(new Date(apiKey.lastUsedAt), 'MMM d, yyyy')
                    : 'Never'}
                </TableCell>
                <TableCell>{apiKey.requestCount.toLocaleString()}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleCopy(apiKey.id)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Key
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewUsage(apiKey.id)}>
                        View Usage
                      </DropdownMenuItem>
                      {apiKey.status === 'active' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onRegenerate(apiKey.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Regenerate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRevoke(apiKey.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Revoke
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default ApiKeyList;
