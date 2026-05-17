import { useEffect, useRef } from 'react';
import { Loader2, MessageSquareText, Send } from 'lucide-react';
import { Button, Input, cn } from '@sidekick/ui-kit';
import { StreamingMarkdown } from './StreamingMarkdown';
import type { ChatTurn } from '../types';

interface ChatThreadProps {
  turns: ChatTurn[];
  pending: string | null;
  isStreaming: boolean;
}

export function ChatThread({ turns, pending, isStreaming }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, pending]);

  if (turns.length === 0 && pending === null) return null;

  return (
    <section className="flex flex-col gap-4">
      <header className="text-fg-subtle flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider">
        <MessageSquareText className="h-3.5 w-3.5" />
        追加の質問
      </header>
      <div className="flex flex-col gap-4">
        {turns.map((t, i) => (
          <ChatBubble key={i} role={t.role} text={t.text} />
        ))}
        {pending !== null ? (
          <ChatBubble role="assistant" text={pending} streaming={isStreaming} />
        ) : null}
        <div ref={endRef} />
      </div>
    </section>
  );
}

interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInputBar({
  value,
  onChange,
  onSubmit,
  isStreaming,
  disabled,
  placeholder = 'このページについて質問する…',
}: ChatInputBarProps) {
  return (
    <form
      className="border-border bg-surface-elevated sticky bottom-0 z-10 flex items-center gap-1.5 rounded-lg border p-2 shadow-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }}
    >
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="border-0 text-base focus-visible:ring-0"
      />
      <Button type="submit" size="md" variant="primary" disabled={disabled || !value.trim()}>
        {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}

function ChatBubble({
  role,
  text,
  streaming,
}: {
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-accent-600 max-w-[85%] rounded-2xl rounded-tr-md px-4 py-2.5 text-base leading-relaxed text-white">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex">
      <div
        className={cn(
          'bg-surface-muted text-fg-default max-w-[92%] rounded-2xl rounded-tl-md px-4 py-3',
          streaming && 'animate-pulse',
        )}
      >
        <StreamingMarkdown text={text || '...'} />
      </div>
    </div>
  );
}
