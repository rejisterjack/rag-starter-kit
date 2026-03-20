'use client';

import { formatDistanceToNow } from 'date-fns';
import { Check, Loader2, MessageSquare, MoreHorizontal, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: Date;
  editedAt?: Date;
  mentions: string[];
}

interface CommentThreadProps {
  comments: Comment[];
  currentUserId: string;
  onAddComment: (content: string, mentions: string[]) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onResolve?: () => Promise<void>;
  isResolved?: boolean;
  className?: string;
}

export function CommentThread({
  comments,
  currentUserId,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onResolve,
  isResolved = false,
  className,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const mentions = extractMentions(newComment);
      await onAddComment(newComment, mentions);
      setNewComment('');
    } catch (_error) {
      toast.error('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      await onEditComment(commentId, editContent);
      setEditingId(null);
      setEditContent('');
    } catch (_error) {
      toast.error('Failed to edit comment');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await onDeleteComment(commentId);
    } catch (_error) {
      toast.error('Failed to delete comment');
    }
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([\w-]+)/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map((m) => m.slice(1)) : [];
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(@[\w-]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        return (
          <span key={idx} className="font-medium text-blue-500">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs">Start the discussion</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={cn('group flex gap-3 p-3 rounded-lg', isResolved && 'opacity-60')}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {comment.userName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{comment.userName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                  {comment.editedAt && (
                    <span className="text-xs text-muted-foreground">(edited)</span>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEdit(comment.id)}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditContent('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground">{renderContent(comment.content)}</p>
                )}
              </div>

              {editingId !== comment.id && comment.userId === currentUserId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditContent(comment.content);
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(comment.id)}
                      className="text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Comment */}
      {!isResolved && (
        <div className="flex gap-3 pt-2 border-t">
          <div className="flex-1">
            <Textarea
              placeholder="Add a comment... Use @ to mention"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-muted-foreground">
                Press Enter to submit, Shift+Enter for new line
              </p>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!newComment.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    Comment
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Button */}
      {onResolve && comments.length > 0 && !isResolved && (
        <Button variant="outline" size="sm" className="w-full" onClick={onResolve}>
          <Check className="h-4 w-4 mr-1" />
          Mark as Resolved
        </Button>
      )}
    </div>
  );
}

export default CommentThread;
