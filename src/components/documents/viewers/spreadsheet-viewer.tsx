'use client';

import { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SpreadsheetViewerProps {
  content: string;
  className?: string;
}

function parseSheets(content: string): { name: string; rows: string[][] }[] {
  const sheets: { name: string; rows: string[][] }[] = [];
  let currentName = 'Sheet 1';
  let currentRows: string[][] = [];

  for (const line of content.split('\n')) {
    const sheetMatch = line.match(/^##\s+(.+)/);
    if (sheetMatch) {
      if (currentRows.length > 0) {
        sheets.push({ name: currentName, rows: currentRows });
      }
      currentName = sheetMatch[1].trim();
      currentRows = [];
      continue;
    }

    if (line.trim() === '') continue;
    const cells = line.split('\t');
    if (cells.length > 0 && cells.some((c) => c.trim() !== '')) {
      currentRows.push(cells);
    }
  }

  if (currentRows.length > 0) {
    sheets.push({ name: currentName, rows: currentRows });
  }

  if (sheets.length === 0 && content.trim()) {
    const rows = content
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => l.split('\t'));
    if (rows.length > 0) {
      sheets.push({ name: 'Sheet 1', rows });
    }
  }

  return sheets;
}

export function SpreadsheetViewer({ content, className }: SpreadsheetViewerProps) {
  const sheets = useMemo(() => parseSheets(content), [content]);
  const [activeSheet, setActiveSheet] = useState(0);

  if (sheets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No data to display
      </div>
    );
  }

  const sheet = sheets[activeSheet];
  const headerRow = sheet.rows[0];
  const dataRows = sheet.rows.slice(1);

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      {sheets.length > 1 && (
        <div className="flex gap-1 px-4 py-1.5 border-b bg-muted/30 overflow-x-auto">
          {sheets.map((s, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: sheet tabs are positional
              key={i}
              type="button"
              onClick={() => setActiveSheet(i)}
              className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                i === activeSheet
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4">
          <Table>
            {headerRow && (
              <TableHeader>
                <TableRow>
                  {headerRow.map((cell, i) => (
                    <TableHead
                      // biome-ignore lint/suspicious/noArrayIndexKey: column positions are stable
                      key={i}
                      className="text-xs whitespace-nowrap"
                    >
                      {cell}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {(headerRow ? dataRows : sheet.rows).map((row, ri) => (
                <TableRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: row positions are stable
                  key={ri}
                >
                  {row.map((cell, ci) => (
                    <TableCell
                      // biome-ignore lint/suspicious/noArrayIndexKey: column positions are stable
                      key={ci}
                      className="text-xs whitespace-nowrap"
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </div>
  );
}
