'use client';

import { Calendar, Check, Copy, Globe, Link2, Lock, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface ShareDialogProps {
  chatId: string;
  chatTitle: string;
  className?: string;
}

interface ShareSettings {
  isPublic: boolean;
  allowComments: boolean;
  expiresAt: string | null;
}

export function ShareDialog({ chatId, chatTitle, className }: ShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [settings, setSettings] = useState<ShareSettings>({
    isPublic: false,
    allowComments: false,
    expiresAt: null,
  });
  const [copied, setCopied] = useState(false);

  const fetchShareSettings = async () => {
    try {
      const response = await fetch(`/api/chat/${chatId}/share`);
      const data = await response.json();

      if (data.success && data.data.isShared) {
        setIsShared(true);
        setShareUrl(data.data.shareUrl);
        setSettings({
          isPublic: data.data.isPublic,
          allowComments: data.data.allowComments,
          expiresAt: data.data.expiresAt,
        });
      } else {
        setIsShared(false);
        setShareUrl('');
      }
    } catch (_error: unknown) {}
  };

  const handleOpen = async () => {
    setIsOpen(true);
    await fetchShareSettings();
  };

  const handleShare = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/${chatId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        setIsShared(true);
        setShareUrl(data.data.shareUrl);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnshare = async () => {
    setIsLoading(true);
    try {
      await fetch(`/api/chat/${chatId}/share`, { method: 'DELETE' });
      setIsShared(false);
      setShareUrl('');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_error: unknown) {}
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'rounded-full h-8 w-8 hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors',
            className
          )}
          onClick={handleOpen}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Chat
          </DialogTitle>
          <DialogDescription>
            {chatTitle || 'Share this conversation with others'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!isShared ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="isPublic" className="font-medium">
                    Make public
                  </Label>
                </div>
                <Switch
                  id="isPublic"
                  checked={settings.isPublic}
                  onCheckedChange={(checked) => setSettings((s) => ({ ...s, isPublic: checked }))}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Anyone with the link can view this chat
              </p>

              <div className="flex items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="allowComments" className="font-medium">
                    Allow comments
                  </Label>
                </div>
                <Switch
                  id="allowComments"
                  checked={settings.allowComments}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({ ...s, allowComments: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="expiresAt" className="font-medium">
                    Expires (optional)
                  </Label>
                </div>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={settings.expiresAt || ''}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, expiresAt: e.target.value || null }))
                  }
                  className="w-full"
                />
              </div>

              <Button onClick={handleShare} disabled={isLoading} className="w-full">
                {isLoading ? 'Creating...' : 'Create Share Link'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {settings.isPublic ? (
                    <Globe className="h-4 w-4 text-green-500" />
                  ) : (
                    <Lock className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="font-medium">{settings.isPublic ? 'Public' : 'Private'}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnshare}
                  disabled={isLoading}
                  className="text-destructive hover:text-destructive"
                >
                  Disable sharing
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="flex-1 font-mono text-sm" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                {settings.expiresAt && (
                  <p>Expires: {new Date(settings.expiresAt).toLocaleString()}</p>
                )}
                {settings.allowComments && <p>Comments enabled</p>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
