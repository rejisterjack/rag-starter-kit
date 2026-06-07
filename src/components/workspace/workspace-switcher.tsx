'use client';

import { Building2, Check, ChevronDown, Loader2, Plus, Settings } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  role: string;
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  currentWorkspaceId?: string;
}

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId,
}: WorkspaceSwitcherProps): React.ReactElement {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const otherWorkspaces = workspaces.filter((w) => w.id !== currentWorkspaceId);

  const handleSwitchWorkspace = useCallback(
    async (workspaceId: string) => {
      setSwitchingId(workspaceId);
      try {
        const response = await fetch('/api/auth/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId }),
        });

        if (response.ok) {
          toast.success('Workspace switched');
          router.refresh();
          setIsOpen(false);
        } else {
          toast.error('Failed to switch workspace');
        }
      } catch (_error: unknown) {
        toast.error('Failed to switch workspace');
      } finally {
        setSwitchingId(null);
      }
    },
    [router]
  );

  const handleCreateWorkspace = () => {
    router.push('/workspaces/new');
    setIsOpen(false);
  };

  const handleWorkspaceSettings = () => {
    if (currentWorkspace) {
      router.push(`/workspaces/${currentWorkspace.slug}/settings`);
      setIsOpen(false);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between gap-2 px-3"
          disabled={!!switchingId}
          aria-label="Switch workspace"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {switchingId ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : currentWorkspace?.avatar ? (
              <Image
                src={currentWorkspace.avatar}
                alt={`${currentWorkspace.name} logo`}
                width={20}
                height={20}
                className="h-5 w-5 rounded-md object-cover"
                unoptimized
              />
            ) : (
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{currentWorkspace?.name ?? 'Select Workspace'}</span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {currentWorkspace && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem className="flex items-center justify-between" disabled>
                <div className="flex items-center gap-2 overflow-hidden">
                  {currentWorkspace.avatar ? (
                    <Image
                      src={currentWorkspace.avatar}
                      alt={`${currentWorkspace.name} logo`}
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-md object-cover"
                      unoptimized
                    />
                  ) : (
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{currentWorkspace.name}</span>
                </div>
                <Check className="h-4 w-4 shrink-0 text-primary" />
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {otherWorkspaces.length > 0 && (
          <>
            <DropdownMenuGroup>
              {otherWorkspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  disabled={!!switchingId}
                  onClick={() => handleSwitchWorkspace(workspace.id)}
                  className="flex items-center gap-2"
                >
                  {switchingId === workspace.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : workspace.avatar ? (
                    <Image
                      src={workspace.avatar}
                      alt={`${workspace.name} logo`}
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-md object-cover"
                      unoptimized
                    />
                  ) : (
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{workspace.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={handleCreateWorkspace}>
          <Plus className="mr-2 h-4 w-4" />
          Create new workspace
        </DropdownMenuItem>

        {currentWorkspace && (
          <DropdownMenuItem onClick={handleWorkspaceSettings}>
            <Settings className="mr-2 h-4 w-4" />
            Workspace settings
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
