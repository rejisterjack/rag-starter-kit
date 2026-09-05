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
      <div className="min-h-full py-8 px-4 flex justify-center bg-transparent">
        <div className="w-full max-w-3xl bg-neutral-950/70 border border-white/10 shadow-2xl rounded-2xl p-6 md:p-8 backdrop-blur-sm font-mono text-sm leading-relaxed">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr
                  // biome-ignore lint/suspicious/noArrayIndexKey: line numbers are positional by design
                  key={i}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="pr-4 text-right text-muted-foreground/30 select-none border-r border-white/10 align-top w-[1%] whitespace-nowrap">
                    {i + 1}
                  </td>
                  <td className="pl-4 whitespace-pre-wrap break-words text-muted-foreground hover:text-foreground transition-colors">
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ScrollArea>
  );
}
