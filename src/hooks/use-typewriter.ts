'use client';

import { useCallback, useEffect, useState } from 'react';

interface TypewriterOptions {
  text: string | string[];
  speed?: number;
  delay?: number;
  loop?: boolean;
  loopDelay?: number;
  onComplete?: () => void;
  enabled?: boolean;
}

interface TypewriterReturn {
  displayText: string;
  isTyping: boolean;
  isComplete: boolean;
  restart: () => void;
}

export function useTypewriter({
  text,
  speed = 45,
  delay = 0,
  loop = false,
  loopDelay = 2000,
  onComplete,
  enabled = true,
}: TypewriterOptions): TypewriterReturn {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [_shouldRestart, setShouldRestart] = useState(0);

  const texts = Array.isArray(text) ? text : [text];

  const restart = useCallback(() => {
    setDisplayText('');
    setIsComplete(false);
    setShouldRestart((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    setDisplayText('');
    setIsTyping(false);
    setIsComplete(false);

    let timeoutId: NodeJS.Timeout;
    let charIndex = 0;
    let textIndex = 0;
    let isCancelled = false;

    const typeNextChar = () => {
      if (isCancelled) return;

      const currentText = texts[textIndex];

      if (charIndex < currentText.length) {
        setDisplayText(currentText.slice(0, charIndex + 1));
        charIndex++;
        timeoutId = setTimeout(typeNextChar, speed + Math.random() * 15);
      } else {
        textIndex++;
        if (textIndex < texts.length) {
          // Move to next line
          setDisplayText((prev) => `${prev}\n`);
          charIndex = 0;
          timeoutId = setTimeout(typeNextChar, speed * 3);
        } else {
          setIsTyping(false);
          setIsComplete(true);
          onComplete?.();

          if (loop) {
            timeoutId = setTimeout(() => {
              if (!isCancelled) {
                setDisplayText('');
                charIndex = 0;
                textIndex = 0;
                setIsTyping(true);
                timeoutId = setTimeout(typeNextChar, speed);
              }
            }, loopDelay);
          }
        }
      }
    };

    // Initial delay
    timeoutId = setTimeout(() => {
      if (!isCancelled) {
        setIsTyping(true);
        typeNextChar();
      }
    }, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [texts, speed, delay, loop, loopDelay, onComplete, enabled]);

  return { displayText, isTyping, isComplete, restart };
}
