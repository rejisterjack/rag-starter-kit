'use client';

import { ScrollArea } from '@/components/ui/scroll-area';

interface TextViewerProps {
  content: string;
  className?: string;
}

export function TextViewer({ content, className }: TextViewerProps) {
  const lines = content.split('\n');

  return (
    <ScrollArea className={className ?? 'h-full'}>
      <div className="p-4 font-mono text-sm leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: line numbers are positional by design
                key={i}
                className="hover:bg-muted/50"
              >
                <td className="pr-4 text-right text-muted-foreground select-none border-r border-border align-top w-[1%] whitespace-nowrap">
                  {i + 1}
                </td>
                <td className="pl-4 whitespace-pre-wrap break-words">{line || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  );
}
