import { cn } from '@sidekick/ui-kit';

interface Choice<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (next: T) => void;
  choices: Choice<T>[];
}

export function ChoiceGroup<T extends string>({ value, onChange, choices }: Props<T>) {
  return (
    <div className="bg-surface-muted/60 border-border flex rounded-md border p-0.5">
      {choices.map((c) => {
        const selected = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={cn(
              'duration-fast flex-1 rounded-sm px-2.5 py-1.5 text-sm font-medium transition-all',
              selected
                ? 'bg-surface-elevated text-fg-default shadow-xs'
                : 'text-fg-muted hover:text-fg-default',
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
