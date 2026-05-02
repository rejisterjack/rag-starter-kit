'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building2,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  MessageSquare,
  Settings,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

const workspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
});

type WorkspaceFormData = z.infer<typeof workspaceSchema>;

interface OnboardingWizardProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export function OnboardingWizard({ user: _user }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState(false);
  const [chunkingStrategy, setChunkingStrategy] = useState<'fixed' | 'semantic'>('fixed');

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<WorkspaceFormData>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setValue('name', name);
    if (!watch('slug')) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setValue('slug', slug);
    }
  };

  const onSubmitWorkspace = async (data: WorkspaceFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create workspace');
      }

      const result = await response.json();
      setWorkspaceId(result.data.workspace.id);

      // Set RAG settings
      await fetch(`/api/workspaces/${result.data.workspace.id}/rag-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkingStrategy,
          chunkSize: 1000,
          chunkOverlap: 200,
        }),
      });

      toast.success('Workspace created!');
      setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspaceId);

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      setUploadedDocument(true);
      toast.success('Document uploaded successfully!');
      setStep(3);
    } catch (_error: unknown) {
      toast.error('Failed to upload document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    router.push('/chat');
  };

  const skipStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="font-semibold">Welcome to RAG Starter Kit</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Step {step} of {totalSteps}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>

        <CardContent>
          {/* Step 1: Create Workspace */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-2xl">Create Your Workspace</CardTitle>
                <CardDescription>
                  Set up your first workspace to start organizing documents and chats
                </CardDescription>
              </div>

              <form onSubmit={handleSubmit(onSubmitWorkspace)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    <Building2 className="inline h-4 w-4 mr-2" />
                    Workspace Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="My Team Workspace"
                    {...register('name')}
                    onChange={handleNameChange}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Workspace Slug</Label>
                  <Input id="slug" placeholder="my-team-workspace" {...register('slug')} />
                  <p className="text-xs text-muted-foreground">
                    Used in URLs: /w/{watch('slug') || 'your-slug'}
                  </p>
                  {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Chunking Strategy</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setChunkingStrategy('fixed')}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        chunkingStrategy === 'fixed'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium">Fixed</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Standard character-based splitting
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChunkingStrategy('semantic')}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        chunkingStrategy === 'semantic'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium">Semantic</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Embedding-based boundaries
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={skipStep}>
                    Skip for now
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: Upload Document */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-2xl">Upload Your First Document</CardTitle>
                <CardDescription>
                  Add a document to start chatting with your AI assistant
                </CardDescription>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <Label htmlFor="document" className="cursor-pointer">
                  <span className="text-primary font-medium">Click to upload</span> or drag and drop
                </Label>
                <Input
                  id="document"
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  PDF, Word, Markdown, or Text files up to 50MB
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={skipStep}>
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: First Chat */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-2xl">Start Your First Chat</CardTitle>
                <CardDescription>Ask questions about your uploaded documents</CardDescription>
              </div>

              <div className="bg-muted rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">You</p>
                    <p className="text-sm text-muted-foreground">
                      What are the key points from my document?
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">AI Assistant</p>
                    <p className="text-sm text-muted-foreground">
                      I'll analyze your document and provide a summary of the key points, main
                      arguments, and important details...
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button onClick={() => setStep(4)}>
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-2xl">You're All Set!</CardTitle>
                <CardDescription>
                  Your workspace is ready. Start chatting with your documents!
                </CardDescription>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <Building2 className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Workspace Created</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">
                    {uploadedDocument ? 'Document Uploaded' : 'Ready for Documents'}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <Settings className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">RAG Configured</p>
                </div>
              </div>

              <Button onClick={handleComplete} size="lg" className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                Start Chatting
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
