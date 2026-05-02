'use client';

import { AlertTriangle, Check, Copy, Key } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PermissionsSelector } from './permissions-selector';

interface CreateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    description?: string;
    permissions: string[];
    expiresIn?: number;
  }) => Promise<{ key: string; keyId: string }>;
}

const EXPIRATION_OPTIONS = [
  { value: 'never', label: 'Never', days: undefined },
  { value: '30days', label: '30 days', days: 30 },
  { value: '90days', label: '90 days', days: 90 },
  { value: '1year', label: '1 year', days: 365 },
];

export function CreateKeyDialog({ open, onOpenChange, onCreate }: CreateKeyDialogProps) {
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'chat:read',
    'chat:write',
  ]);
  const [expiration, setExpiration] = useState('never');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<{ key: string; keyId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }

    setIsSubmitting(true);
    try {
      const expiresIn = EXPIRATION_OPTIONS.find((o) => o.value === expiration)?.days;
      const result = await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: selectedPermissions,
        expiresIn,
      });
      setCreatedKey(result);
      setStep('result');
      toast.success('API key created successfully');
    } catch (_error: unknown) {
      toast.error('Failed to create API key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('API key copied to clipboard');
  };

  const handleClose = () => {
    if (step === 'result') {
      // Reset form
      setStep('form');
      setName('');
      setDescription('');
      setSelectedPermissions(['chat:read', 'chat:write']);
      setExpiration('never');
      setCreatedKey(null);
      setCopied(false);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Create a new API key to access the RAG API programmatically.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production API Key"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What is this key for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Expiration</Label>
                <Select value={expiration} onValueChange={setExpiration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <PermissionsSelector
                  selected={selectedPermissions}
                  onChange={setSelectedPermissions}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? 'Creating...' : 'Create Key'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Key Created
              </DialogTitle>
              <DialogDescription>
                Copy your API key now. You won&apos;t be able to see it again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Store this key securely. For security reasons, we cannot show it again.
                </AlertDescription>
              </Alert>

              <div className="relative">
                <code className="block w-full rounded-lg bg-muted p-4 text-sm break-all">
                  {createdKey?.key}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute right-2 top-2"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>I&apos;ve copied my key</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CreateKeyDialog;
