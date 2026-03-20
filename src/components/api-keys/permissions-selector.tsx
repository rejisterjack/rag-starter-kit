'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Permission {
  id: string;
  label: string;
  description: string;
  category: 'chat' | 'documents' | 'workspaces' | 'admin';
}

const PERMISSIONS: Permission[] = [
  // Chat
  {
    id: 'chat:read',
    label: 'Read Chats',
    description: 'View conversation history',
    category: 'chat',
  },
  {
    id: 'chat:write',
    label: 'Send Messages',
    description: 'Send messages and create chats',
    category: 'chat',
  },
  {
    id: 'chat:delete',
    label: 'Delete Chats',
    description: 'Delete conversations',
    category: 'chat',
  },

  // Documents
  {
    id: 'documents:read',
    label: 'Read Documents',
    description: 'View uploaded documents',
    category: 'documents',
  },
  {
    id: 'documents:write',
    label: 'Upload Documents',
    description: 'Upload new documents',
    category: 'documents',
  },
  {
    id: 'documents:delete',
    label: 'Delete Documents',
    description: 'Remove documents',
    category: 'documents',
  },

  // Workspaces
  {
    id: 'workspaces:read',
    label: 'Read Workspaces',
    description: 'View workspace information',
    category: 'workspaces',
  },
  {
    id: 'workspaces:write',
    label: 'Manage Workspaces',
    description: 'Create and modify workspaces',
    category: 'workspaces',
  },

  // Admin
  {
    id: 'admin:users',
    label: 'Manage Users',
    description: 'Add/remove workspace members',
    category: 'admin',
  },
  {
    id: 'admin:analytics',
    label: 'View Analytics',
    description: 'Access analytics and usage data',
    category: 'admin',
  },
];

interface PermissionsSelectorProps {
  selected: string[];
  onChange: (permissions: string[]) => void;
  className?: string;
}

export function PermissionsSelector({ selected, onChange, className }: PermissionsSelectorProps) {
  const togglePermission = (permissionId: string) => {
    onChange(
      selected.includes(permissionId)
        ? selected.filter((p) => p !== permissionId)
        : [...selected, permissionId]
    );
  };

  const selectAll = () => {
    onChange(PERMISSIONS.map((p) => p.id));
  };

  const selectNone = () => {
    onChange([]);
  };

  const categories = Array.from(new Set(PERMISSIONS.map((p) => p.category)));

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={selectAll} type="button">
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={selectNone} type="button">
          Select None
        </Button>
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category} className="space-y-2">
            <h4 className="text-sm font-medium capitalize">{category}</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {PERMISSIONS.filter((p) => p.category === category).map((permission) => (
                <div
                  key={permission.id}
                  className="flex items-start space-x-2 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    id={permission.id}
                    checked={selected.includes(permission.id)}
                    onCheckedChange={() => togglePermission(permission.id)}
                  />
                  <div className="grid gap-0.5">
                    <Label htmlFor={permission.id} className="text-sm font-medium cursor-pointer">
                      {permission.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{permission.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PermissionsSelector;
