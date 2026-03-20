'use client';

import { Crown, MoreHorizontal, Shield, User, UserX } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Member {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface MemberListProps {
  members: Member[];
  workspaceId: string;
  currentUserId: string;
  currentUserRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  onUpdate?: () => void;
}

const roleIcons = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
  VIEWER: User,
};

const roleLabels = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

const roleColors = {
  OWNER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  MEMBER: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export function MemberList({
  members,
  workspaceId,
  currentUserId,
  currentUserRole,
  onUpdate,
}: MemberListProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const canManageMembers = ['OWNER', 'ADMIN'].includes(currentUserRole);
  const isOwner = currentUserRole === 'OWNER';

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setIsLoading(memberId);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      onUpdate?.();
    } catch (_error) {
    } finally {
      setIsLoading(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    setIsLoading(memberId);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      onUpdate?.();
    } catch (_error) {
    } finally {
      setIsLoading(null);
    }
  };

  const sortedMembers = [...members].sort((a, b) => {
    // Sort by role priority: OWNER > ADMIN > MEMBER > VIEWER
    const roleOrder = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    const aIndex = roleOrder.indexOf(a.role);
    const bIndex = roleOrder.indexOf(b.role);
    if (aIndex !== bIndex) return aIndex - bIndex;

    // Then by name
    return (a.user.name || a.user.email).localeCompare(b.user.name || b.user.email);
  });

  return (
    <div className="space-y-4">
      {sortedMembers.map((member) => {
        const isCurrentUser = member.userId === currentUserId;
        const RoleIcon = roleIcons[member.role];
        const canEdit = canManageMembers && !isCurrentUser && member.role !== 'OWNER';
        const canRemove =
          (isOwner || (canManageMembers && member.role === 'VIEWER')) &&
          !isCurrentUser &&
          member.role !== 'OWNER';

        return (
          <div key={member.id} className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.user.image || undefined} />
                <AvatarFallback>
                  {member.user.name?.charAt(0).toUpperCase() ||
                    member.user.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{member.user.name || member.user.email}</p>
                  {isCurrentUser && (
                    <Badge variant="secondary" className="text-xs">
                      You
                    </Badge>
                  )}
                  {member.status === 'PENDING' && (
                    <Badge variant="outline" className="text-xs">
                      Pending
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{member.user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {canEdit ? (
                <Select
                  value={member.role}
                  onValueChange={(value) => handleRoleChange(member.id, value)}
                  disabled={isLoading === member.id}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge
                  variant="secondary"
                  className={`flex items-center gap-1 ${roleColors[member.role]}`}
                >
                  <RoleIcon className="h-3 w-3" />
                  {roleLabels[member.role]}
                </Badge>
              )}

              {(canEdit || canRemove) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isLoading === member.id}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canRemove && (
                      <DropdownMenuItem
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-destructive"
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Remove member
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
