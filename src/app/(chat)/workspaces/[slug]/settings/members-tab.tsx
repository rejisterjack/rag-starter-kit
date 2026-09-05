'use client';

import { Loader2, Mail, Trash2, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface Member {
  id: string;
  userId: string;
  role: MemberRole;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  };
}

const roleBadgeVariant: Record<MemberRole, 'default' | 'secondary' | 'outline'> = {
  OWNER: 'default',
  ADMIN: 'secondary',
  MEMBER: 'outline',
  VIEWER: 'outline',
};

export function WorkspaceMembersTab({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members?limit=100`);
      if (!response.ok) throw new Error('Failed to load members');
      const json = await response.json();
      setMembers(json?.data?.members ?? []);
    } catch {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (email === '' || !email.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    setInviting(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || 'Failed to invite member');
      }
      toast.success(`Invitation sent to ${email}`);
      setInviteEmail('');
      await fetchMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: Member, role: MemberRole) => {
    if (member.role === 'OWNER') return;
    setBusyMemberId(member.id);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Failed to update role');
      toast.success('Role updated');
      await fetchMembers();
    } catch {
      toast.error('Failed to update role');
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemove = async (member: Member) => {
    if (member.role === 'OWNER') return;
    if (!confirm(`Remove ${member.user.name ?? member.user.email} from this workspace?`)) return;
    setBusyMemberId(member.id);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${member.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove member');
      toast.success('Member removed');
      await fetchMembers();
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setBusyMemberId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>Manage workspace members and their roles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite form */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-email">Invite by email</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  className="pl-9"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInvite();
                    }
                  }}
                />
              </div>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as typeof inviteRole)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Invite
              </Button>
            </div>
          </div>
        </div>

        {/* Members table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No members found
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.user.name ?? 'Unnamed'}</p>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.role === 'OWNER' ? (
                        <Badge variant={roleBadgeVariant[member.role]}>Owner</Badge>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(role) => handleRoleChange(member, role as MemberRole)}
                          disabled={busyMemberId === member.id}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="MEMBER">Member</SelectItem>
                            <SelectItem value="VIEWER">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.role !== 'OWNER' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remove member"
                          disabled={busyMemberId === member.id}
                          onClick={() => handleRemove(member)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default WorkspaceMembersTab;
