'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface VoiceWaveformProps {
  isActive: boolean;
  className?: string;
  barCount?: number;
  color?: string;
}

export function VoiceWaveform({
  isActive,
  className,
  barCount = 5,
  color = 'currentColor',
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bars: number[] = new Array(barCount).fill(0.3);
    let frame = 0;

    const animate = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      const barWidth = rect.width / (barCount * 2 - 1);
      const maxBarHeight = rect.height * 0.8;
      const centerY = rect.height / 2;

      bars.forEach((bar, i) => {
        // Update bar height
        if (isActive) {
          // Simulate audio levels with noise
          const targetHeight = 0.2 + Math.random() * 0.8;
          bars[i] += (targetHeight - bars[i]) * 0.3;
        } else {
          // Return to idle state
          bars[i] += (0.3 - bars[i]) * 0.1;
        }

        // Add subtle wave motion
        const waveOffset = Math.sin(frame * 0.1 + i * 0.5) * 0.1;
        const height = Math.max(0.1, Math.min(1, bars[i] + waveOffset));

        const barHeight = height * maxBarHeight;
        const x = i * barWidth * 2;
        const y = centerY - barHeight / 2;

        // Draw bar with rounded corners
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();

        // Add glow effect when active
        if (isActive && height > 0.5) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      frame++;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, barCount, color]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('h-6 w-12', className)}
      style={{ width: '3rem', height: '1.5rem' }}
    />
  );
}

// Simpler CSS-based version for fallback
interface VoiceWaveformCSSProps {
  isActive: boolean;
  className?: string;
}

export function VoiceWaveformCSS({ isActive, className }: VoiceWaveformCSSProps) {
  return (
    <div className={cn('flex items-center gap-0.5 h-5', className)}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-full bg-current transition-all duration-150',
            isActive && 'animate-pulse'
          )}
          style={{
            height: isActive ? `${20 + Math.random() * 60}%` : '30%',
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default VoiceWaveform;
