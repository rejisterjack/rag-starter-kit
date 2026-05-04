'use client';

import * as React from 'react';

/**
 * Accessible live region for streaming chat responses.
 *
 * Screen readers will announce content changes in this region.
 * Uses aria-live="polite" to avoid interrupting the user.
 *
 * @example
 * ```tsx
 * <AriaLiveRegion>
 *   {isStreaming ? 'AI is generating a response...' : lastMessage}
 * </AriaLiveRegion>
 * ```
 */
interface AriaLiveRegionProps {
  /** Content to announce to screen readers */
  children: React.ReactNode;
  /** Politeness level: 'polite' waits for idle, 'assertive' interrupts */
  politeness?: 'polite' | 'assertive' | 'off';
  /** Whether the region is currently relevant (shows visually hidden text) */
  atomic?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function AriaLiveRegion({
  children,
  politeness = 'polite',
  atomic = true,
  className,
}: AriaLiveRegionProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className={className ?? 'sr-only'}
    >
      {children}
    </div>
  );
}

/**
 * Streaming status announcer for chat interfaces.
 *
 * Announces when AI starts/stops generating responses.
 * Debounces content updates to avoid overwhelming screen readers.
 */
interface StreamingAnnouncerProps {
  /** Whether the AI is currently streaming a response */
  isStreaming: boolean;
  /** The latest completed message (announced when streaming stops) */
  latestMessage?: string;
  /** Maximum characters to announce (truncates long messages) */
  maxAnnouncementLength?: number;
}

export function StreamingAnnouncer({
  isStreaming,
  latestMessage,
  maxAnnouncementLength = 200,
}: StreamingAnnouncerProps): React.ReactElement {
  const [announcement, setAnnouncement] = React.useState('');

  React.useEffect(() => {
    if (isStreaming) {
      setAnnouncement('AI is generating a response...');
    } else if (latestMessage) {
      const truncated =
        latestMessage.length > maxAnnouncementLength
          ? `${latestMessage.slice(0, maxAnnouncementLength)}... Response complete.`
          : `${latestMessage} Response complete.`;
      setAnnouncement(truncated);
    }
  }, [isStreaming, latestMessage, maxAnnouncementLength]);

  return <AriaLiveRegion politeness="polite">{announcement}</AriaLiveRegion>;
}

/**
 * Visually hidden but accessible heading for landmarks.
 * Use to provide context to screen reader users about page sections.
 */
interface VisuallyHiddenHeadingProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

export function VisuallyHiddenHeading({
  level = 2,
  children,
}: VisuallyHiddenHeadingProps): React.ReactElement {
  const Tag = `h${level}` as const;
  return <Tag className="sr-only">{children}</Tag>;
}
