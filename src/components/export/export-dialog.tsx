'use client';

import { useState, useCallback } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  conversationTitle: string;
  onExport: (options: ExportOptions) => Promise<Blob>;
}

export interface ExportOptions {
  format: 'pdf' | 'markdown' | 'html' | 'json';
  includeCitations: boolean;
  includeSources: boolean;
  citationStyle: 'numbered' | 'footnote';
}

export function ExportDialog({
  open,
  onOpenChange,
  conversationId,
  conversationTitle,
  onExport,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportOptions['format']>('pdf');
  const [includeCitations, setIncludeCitations] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [citationStyle, setCitationStyle] = useState<'numbered' | 'footnote'>('numbered');
  const [isExporting, setIsExporting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const options: ExportOptions = {
        format,
        includeCitations,
        includeSources,
        citationStyle,
      };

      const blob = await onExport(options);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${conversationTitle.replace(/\s+/g, '_')}.${getFileExtension(format)}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export completed successfully');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to export conversation');
    } finally {
      setIsExporting(false);
    }
  }, [format, includeCitations, includeSources, citationStyle, onExport, conversationTitle, onOpenChange]);

  const getFileExtension = (fmt: string): string => {
    switch (fmt) {
      case 'pdf': return 'pdf';
      case 'markdown': return 'md';
      case 'html': return 'html';
      case 'json': return 'json';
      default: return 'txt';
    }
  };

  const getFormatLabel = (fmt: string): string => {
    switch (fmt) {
      case 'pdf': return 'PDF Document';
      case 'markdown': return 'Markdown';
      case 'html': return 'HTML Page';
      case 'json': return 'JSON Data';
      default: return fmt;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Conversation
          </DialogTitle>
          <DialogDescription>
            Export &quot;{conversationTitle}" in your preferred format
          </DialogDescription>
        </DialogHeader>

        <Tabs value={format} onValueChange={(v) => setFormat(v as ExportOptions['format'])}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pdf">PDF</TabsTrigger>
            <TabsTrigger value="markdown">MD</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="pdf" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export as a formatted PDF document with professional styling.
            </p>
          </TabsContent>

          <TabsContent value="markdown" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export as Markdown for easy editing and portability.
            </p>
          </TabsContent>

          <TabsContent value="html" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export as a self-contained HTML page that can be viewed in any browser.
            </p>
          </TabsContent>

          <TabsContent value="json" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export raw data as JSON for programmatic use.
            </p>
          </TabsContent>
        </Tabs>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Export Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="citations"
                  checked={includeCitations}
                  onCheckedChange={(checked) => setIncludeCitations(checked as boolean)}
                />
                <Label htmlFor="citations" className="text-sm font-normal">
                  Include citations
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sources"
                  checked={includeSources}
                  onCheckedChange={(checked) => setIncludeSources(checked as boolean)}
                />
                <Label htmlFor="sources" className="text-sm font-normal">
                  Include full source references
                </Label>
              </div>
            </div>
          </div>

          {includeCitations && (
            <div className="space-y-2">
              <Label>Citation Style</Label>
              <Select value={citationStyle} onValueChange={(v) => setCitationStyle(v as 'numbered' | 'footnote')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numbered">Numbered [1], [2], ...</SelectItem>
                  <SelectItem value="footnote">Footnotes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export {getFormatLabel(format)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportDialog;
