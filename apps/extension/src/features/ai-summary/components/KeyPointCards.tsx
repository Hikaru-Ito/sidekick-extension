import type { KeyPoint } from '../types';

interface Props {
  points: KeyPoint[];
}

export function KeyPointCards({ points }: Props) {
  if (points.length === 0) {
    return (
      <p className="text-fg-muted text-center text-sm">
        要点を生成できませんでした。再度試してください。
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {points.map((p, i) => (
        <li
          key={i}
          className="border-border bg-surface-elevated shadow-xs flex gap-3 rounded-lg border p-4"
        >
          <div className="bg-accent-500/12 text-accent-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xl leading-none">
            {p.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-fg-default text-base font-semibold leading-snug">{p.title}</div>
            {p.body ? (
              <p className="text-fg-muted mt-1.5 text-sm leading-relaxed">{p.body}</p>
            ) : null}
          </div>
          <span className="text-fg-subtle text-xs tabular-nums">
            {String(i + 1).padStart(2, '0')}
          </span>
        </li>
      ))}
    </ol>
  );
}
