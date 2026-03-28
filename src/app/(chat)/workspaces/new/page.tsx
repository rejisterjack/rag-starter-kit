'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

const workspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters').max(50),
  slug: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().max(200).optional(),
});

type WorkspaceFormData = z.infer<typeof workspaceSchema>;

const steps = [
  { id: 1, title: 'Workspace Details', description: 'Name your workspace' },
  { id: 2, title: 'Invite Team', description: 'Add team members' },
  { id: 3, title: 'Configure RAG', description: 'Set up document processing' },
];

export default function NewWorkspacePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [chunkingStrategy, setChunkingStrategy] = useState<'fixed' | 'semantic' | 'hierarchical'>(
    'fixed'
  );

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
      description: '',
    },
  });

  const workspaceName = watch('name');

  // Auto-generate slug from name
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

  const onSubmit = async (data: WorkspaceFormData) => {
    setIsLoading(true);
    try {
      // Create workspace
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
      const workspace = result.data.workspace;

      // Configure RAG settings
      await fetch(`/api/workspaces/${workspace.id}/rag-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkingStrategy,
          chunkSize: 1000,
          chunkOverlap: 200,
          topK: 5,
          similarityThreshold: 0.7,
        }),
      });

      // Send invites if provided
      if (inviteEmails.trim()) {
        const emails = inviteEmails.split(',').map((e) => e.trim());
        await fetch(`/api/workspaces/${workspace.id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails }),
        });
      }

      toast.success('Workspace created successfully!');
      router.push('/chat');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, steps.length));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Create New Workspace</CardTitle>
              <CardDescription>
                Step {currentStep} of {steps.length}: {steps[currentStep - 1].title}
              </CardDescription>
            </div>
            <div className="text-right">
              <span className="text-sm text-muted-foreground">
                {Math.round(progress)}% Complete
              </span>
            </div>
          </div>
          <Progress value={progress} className="mt-4" />
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 1: Workspace Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
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
                    Used in URLs: ragkit.com/w/{watch('slug') || 'your-slug'}
                  </p>
                  {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="What is this workspace for?"
                    {...register('description')}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Invite Team */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="invites">
                    <Users className="inline h-4 w-4 mr-2" />
                    Invite Team Members (Optional)
                  </Label>
                  <Textarea
                    id="invites"
                    placeholder="Enter email addresses separated by commas..."
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    You can also invite members later from workspace settings.
                  </p>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Preview</h4>
                  <p className="text-sm text-muted-foreground">
                    {workspaceName || 'Your Workspace'} will be created with{' '}
                    {inviteEmails ? inviteEmails.split(',').filter(Boolean).length : 0} invited
                    member(s).
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Configure RAG */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label>Chunking Strategy</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {(['fixed', 'semantic', 'hierarchical'] as const).map((strategy) => (
                      <button
                        key={strategy}
                        type="button"
                        onClick={() => setChunkingStrategy(strategy)}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          chunkingStrategy === strategy
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="font-medium capitalize">{strategy}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {strategy === 'fixed' && 'Standard character-based splitting'}
                          {strategy === 'semantic' && 'Embedding-based boundaries'}
                          {strategy === 'hierarchical' && 'Parent-child relationships'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Summary</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Workspace: {workspaceName}</li>
                    <li>• Slug: {watch('slug')}</li>
                    <li>
                      • Members: {inviteEmails ? inviteEmails.split(',').filter(Boolean).length : 0}
                    </li>
                    <li>• Chunking: {chunkingStrategy}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {currentStep < steps.length ? (
                <Button type="button" onClick={nextStep}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Workspace'
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
