import { useRef, useEffect } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button, Input, cn } from '@sidekick/ui-kit';
import { StreamingMarkdown } from './StreamingMarkdown';
import type { ChatTurn } from '../types';

interface Props {
  turns: ChatTurn[];
  pending: string | null;
  isStreaming: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function ChatView({
  turns,
  pending,
  isStreaming,
  inputValue,
  onInputChange,
  onSubmit,
  disabled,
}: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, pending]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {turns.length === 0 && !pending ? (
          <p className="text-fg-subtle px-2 text-center text-sm">
            ページについて自由に質問してください。
          </p>
        ) : null}
        {turns.map((t, i) => (
          <ChatBubble key={i} role={t.role} text={t.text} />
        ))}
        {pending !== null ? (
          <ChatBubble role="assistant" text={pending} streaming={isStreaming} />
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="border-border bg-surface-elevated sticky bottom-0 flex items-center gap-1.5 rounded-lg border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && inputValue.trim()) onSubmit();
        }}
      >
        <Input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="質問を入力…"
          disabled={disabled}
          className="border-0 text-base focus-visible:ring-0"
        />
        <Button type="submit" size="md" variant="primary" disabled={disabled || !inputValue.trim()}>
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
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
