'use client';

import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Calendar, Clock, Eye, Globe, Lock, MessageSquare, User } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Markdown } from '@/components/chat/markdown';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SharedMessage {
  id: string;
  content: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  sources?: Array<{
    title: string;
    content: string;
    index: number;
  }>;
  createdAt: string;
}

interface SharedChat {
  id: string;
  title: string;
  createdAt: string;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  messages: SharedMessage[];
  messageCount: number;
}

interface ShareData {
  share: {
    id: string;
    isPublic: boolean;
    allowComments: boolean;
    expiresAt: string | null;
    viewCount: number;
    createdAt: string;
  };
  chat: SharedChat;
}

export default function SharedChatPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedChat() {
      try {
        const response = await fetch(`/api/share/${token}`);
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to load shared chat');
          return;
        }

        setData(result.data);
      } catch (_error: unknown) {
        setError('Failed to load shared chat');
      } finally {
        setLoading(false);
      }
    }

    fetchSharedChat();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const { share, chat } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold">{chat.title}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={chat.owner.image || undefined} />
                    <AvatarFallback className="text-xs">
                      {chat.owner.name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span>{chat.owner.name || 'Anonymous'}</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(chat.createdAt))} ago</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant={share.isPublic ? 'default' : 'secondary'} className="gap-1">
                {share.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {share.isPublic ? 'Public' : 'Private'}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                {share.viewCount}
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/">Create your own</a>
              </Button>
            </div>
          </div>

          {/* Share metadata */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {chat.messageCount} messages
            </div>
            {share.expiresAt && (
              <div className="flex items-center gap-1 text-yellow-600">
                <Calendar className="h-3 w-3" />
                Expires {formatDistanceToNow(new Date(share.expiresAt))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="space-y-6">
          {chat.messages.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>Shared via RAG Starter Kit</p>
          <p className="mt-1">
            <a href="/" className="text-primary hover:underline">
              Create your own AI-powered chat
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

function MessageCard({ message }: { message: SharedMessage }) {
  const isUser = message.role === 'USER';

  return (
    <Card className={cn('overflow-hidden', isUser ? 'bg-muted/50' : 'bg-card')}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
              isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'
            )}
          >
            {isUser ? <User className="h-3 w-3" /> : 'AI'}
          </div>
          <span className="font-medium text-sm">{isUser ? 'You' : 'Assistant'}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(message.createdAt))} ago
          </span>
        </div>
      </CardHeader>
      <CardContent className="py-3 px-4 pt-0">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Markdown content={message.content} />
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source) => (
                <Badge key={source.index} variant="outline" className="text-xs">
                  [{source.index}] {source.title}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
