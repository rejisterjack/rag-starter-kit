'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MentionUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface MentionsInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentions: string[]) => void;
  users: MentionUser[];
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function MentionsInput({
  value,
  onChange,
  onMentionsChange,
  users,
  placeholder,
  className,
  rows = 3,
}: MentionsInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(-1);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (onMentionsChange) {
      const mentionRegex = /@([\w-]+)/g;
      const matches = value.match(mentionRegex);
      const mentions = matches ? matches.map((m) => m.slice(1)) : [];
      onMentionsChange(mentions);
    }
  }, [value, onMentionsChange]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursorPosition = e.target.selectionStart;

      onChange(newValue);
      setCursorPosition(newCursorPosition);

      const textBeforeCursor = newValue.slice(0, newCursorPosition);
      const mentionMatch = textBeforeCursor.match(/@([\w-]*)$/);

      if (mentionMatch) {
        setSearchQuery(mentionMatch[1]);
        setShowSuggestions(true);
        setSelectedIndex(0);
        mentionStartRef.current = textBeforeCursor.lastIndexOf('@');
      } else {
        setShowSuggestions(false);
        setSearchQuery('');
        mentionStartRef.current = -1;
      }
    },
    [onChange]
  );

  const insertMention = useCallback(
    (user: MentionUser) => {
      if (mentionStartRef.current === -1) return;

      const beforeMention = value.slice(0, mentionStartRef.current);
      const afterMention = value.slice(cursorPosition);
      const newValue = `${beforeMention}@${user.name} ${afterMention}`;

      onChange(newValue);
      setShowSuggestions(false);
      setSearchQuery('');
      mentionStartRef.current = -1;

      setTimeout(() => {
        textareaRef.current?.focus();
        const newCursorPos = beforeMention.length + user.name.length + 2;
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [value, cursorPosition, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < filteredUsers.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            insertMention(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    },
    [showSuggestions, filteredUsers, selectedIndex, insertMention]
  );

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'resize-none',
          className
        )}
      />

      {showSuggestions && filteredUsers.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 max-h-48 overflow-auto rounded-md border bg-popover shadow-lg">
          <div className="py-1">
            {filteredUsers.map((user, index) => (
              <button
                type="button"
                key={user.id}
                onClick={() => insertMention(user)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                  'hover:bg-accent transition-colors',
                  index === selectedIndex && 'bg-accent'
                )}
              >
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MentionsInput;
