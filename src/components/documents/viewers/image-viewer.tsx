'use client';

import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImageViewerProps {
  url: string;
  fileName: string;
}

export function ImageViewer({ url, fileName }: ImageViewerProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex items-center justify-center p-8 min-h-full bg-transparent">
        <Image
          src={url}
          alt={fileName}
          width={1200}
          height={800}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
          className="max-w-full max-h-[70vh] object-contain rounded-2xl border border-white/10 shadow-2xl hover:scale-[1.01] transition-transform duration-300"
        />
      </div>
    </ScrollArea>
  );
}
