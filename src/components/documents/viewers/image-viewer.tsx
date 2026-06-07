'use client';

import { ScrollArea } from '@/components/ui/scroll-area';

interface ImageViewerProps {
  url: string;
  fileName: string;
}

export function ImageViewer({ url, fileName }: ImageViewerProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex items-center justify-center p-8 min-h-full bg-transparent">
        {/* biome-ignore lint/performance/noImgElement: Cloudinary URLs can't use next/image */}
        <img
          src={url}
          alt={fileName}
          className="max-w-full max-h-[70vh] object-contain rounded-2xl border border-white/10 shadow-2xl hover:scale-[1.01] transition-transform duration-300"
        />
      </div>
    </ScrollArea>
  );
}
