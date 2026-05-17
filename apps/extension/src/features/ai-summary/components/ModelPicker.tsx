import { cn } from '@sidekick/ui-kit';
import { ANTHROPIC_MODELS, type AnthropicModelId } from '../types';

interface Props {
  value: AnthropicModelId;
  onChange: (next: AnthropicModelId) => void;
}

export function ModelPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {ANTHROPIC_MODELS.map((m) => {
        const selected = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={cn(
              'duration-fast rounded-md border px-3 py-2 text-left transition-all',
              selected
                ? 'border-accent-500 bg-accent-500/8 shadow-xs'
                : 'border-border bg-surface-elevated hover:bg-surface-muted',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg-default text-sm font-medium">{m.label}</span>
              <span className="text-fg-subtle text-[10px]">{m.context}</span>
            </div>
            <p className="text-fg-muted mt-0.5 text-xs">{m.blurb}</p>
          </button>
        );
      })}
    </div>
  );
}
