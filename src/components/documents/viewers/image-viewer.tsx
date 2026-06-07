'use client';

import { ScrollArea } from '@/components/ui/scroll-area';

interface ImageViewerProps {
  url: string;
  fileName: string;
}

export function ImageViewer({ url, fileName }: ImageViewerProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex items-center justify-center p-6 min-h-full">
        {/* biome-ignore lint/performance/noImgElement: Cloudinary URLs can't use next/image */}
        <img
          src={url}
          alt={fileName}
          className="max-w-full max-h-[70vh] object-contain rounded shadow-sm"
        />
      </div>
    </ScrollArea>
  );
}
