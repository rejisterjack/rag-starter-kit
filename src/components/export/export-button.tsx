'use client';

import React, { useState, useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  FileType2,
  FileCode2,
  Download,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';

import { ExportDialog, type ExportOptions, type ExportOptions as ExportDialogOptions } from './export-dialog';
import type { ExportFormat } from '@/lib/export';

// =============================================================================
// Types
// =============================================================================

export interface ExportButtonProps {
  chatId: string;
  chatTitle?: string;
  workspaceId?: string;
  workspaceName?: string;
  variant?: 'button' | 'dropdown' | 'icon';
  onExport?: (format: 'pdf' | 'markdown' | 'html' | 'json', options?: ExportDialogOptions) => Promise<void>;
  showLabel?: boolean;
  className?: string;
  disabled?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ExportButton({
  chatId,
  chatTitle,
  workspaceId,
  workspaceName,
  variant = 'button',
  onExport,
  showLabel = true,
  className,
  ...props
}: ExportButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);

  const handleQuickExport = useCallback(
    async (format: 'pdf' | 'markdown' | 'html' | 'json') => {
      if (!onExport) return;

      setIsExporting(true);
      setExportFormat(format);

      try {
        await onExport(format, {
          format,
          includeCitations: true,
          citationStyle: 'numbered',
          includeSources: true,
        });
      } finally {
        setIsExporting(false);
        setExportFormat(null);
      }
    },
    [onExport]
  );

  const handleAdvancedExport = useCallback(
    async (options: ExportDialogOptions): Promise<Blob> => {
      if (!onExport) return new Blob([]);

      await onExport(options.format, options);
      return new Blob([]);
    },
    [onExport]
  );

  // Quick export items
  const quickExportItems: Array<{
    format: 'pdf' | 'markdown' | 'html' | 'json';
    label: string;
    icon: typeof FileText;
    shortcut: string;
  }> = [
    {
      format: 'pdf',
      label: 'Export as PDF',
      icon: FileText,
      shortcut: 'PDF',
    },
    {
      format: 'markdown',
      label: 'Export as Word',
      icon: FileType2,
      shortcut: 'DOCX',
    },
    {
      format: 'markdown',
      label: 'Export as Markdown',
      icon: FileCode2,
      shortcut: 'MD',
    },
  ];

  // Icon button variant
  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDialogOpen(true)}
              disabled={isExporting}
              className={className}
              {...props}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Export conversation</p>
          </TooltipContent>
        </Tooltip>

        <ExportDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          conversationId={chatId}
          conversationTitle={chatTitle || 'Chat'}
          onExport={handleAdvancedExport}
        />
      </TooltipProvider>
    );
  }

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size={showLabel ? 'default' : 'icon'}
              disabled={isExporting}
              className={className}
              {...props}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {showLabel && <span className="ml-2">Export</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {quickExportItems.map((item) => (
              <DropdownMenuItem
                key={item.format}
                onClick={() => handleQuickExport(item.format)}
                disabled={isExporting}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                {isExporting && exportFormat === item.format ? (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                ) : (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {item.shortcut}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDialogOpen(true)}>
              <MoreHorizontal className="mr-2 h-4 w-4" />
              <span>Advanced Options...</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ExportDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          conversationId={chatId}
          conversationTitle={chatTitle || 'Chat'}
          onExport={handleAdvancedExport}
        />
      </>
    );
  }

  // Default button variant
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setDialogOpen(true)}
        disabled={isExporting}
        className={className}
        {...props}
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export
          </>
        )}
      </Button>

      <ExportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        conversationId={chatId}
        conversationTitle={chatTitle || 'Chat'}
        onExport={handleAdvancedExport}
      />
    </>
  );
}

// =============================================================================
// Bulk Export Button
// =============================================================================

export interface BulkExportButtonProps extends ButtonProps {
  workspaceId?: string;
  workspaceName?: string;
  onExport?: (options: ExportDialogOptions, filters?: unknown) => Promise<void>;
}

export function BulkExportButton({
  workspaceId,
  workspaceName,
  onExport,
  className,
  ...props
}: BulkExportButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleExport = useCallback(
    async (options: ExportOptions): Promise<Blob> => {
      if (!onExport) return new Blob([]);
      await onExport(options as ExportDialogOptions);
      return new Blob([]);
    },
    [onExport]
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setDialogOpen(true)}
        className={className}
        {...props}
      >
        <Download className="mr-2 h-4 w-4" />
        Bulk Export
      </Button>

      <ExportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        conversationId={workspaceId || 'bulk'}
        conversationTitle={workspaceName || 'Bulk Export'}
        onExport={handleExport}
      />
    </>
  );
}

export default ExportButton;
