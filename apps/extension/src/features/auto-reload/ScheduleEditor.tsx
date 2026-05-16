import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button, Input, cn } from '@sidekick/ui-kit';
import {
  DAY_LABELS,
  DAY_PRESETS,
  formatTimeOfDay,
  parseTimeOfDay,
  sortTimes,
  type DayOfWeek,
  type TimeOfDay,
} from './types';

interface Props {
  daysOfWeek: DayOfWeek[];
  times: TimeOfDay[];
  onChange: (next: { daysOfWeek: DayOfWeek[]; times: TimeOfDay[] }) => void;
}

function arrayEquals(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function ScheduleEditor({ daysOfWeek, times, onChange }: Props) {
  const [newTime, setNewTime] = useState('');

  const toggleDay = (d: DayOfWeek) => {
    const next = daysOfWeek.includes(d) ? daysOfWeek.filter((x) => x !== d) : [...daysOfWeek, d];
    onChange({ daysOfWeek: next, times });
  };

  const setPreset = (days: DayOfWeek[]) => {
    onChange({ daysOfWeek: days, times });
  };

  const removeTime = (idx: number) => {
    onChange({ daysOfWeek, times: times.filter((_, i) => i !== idx) });
  };

  const addTime = (raw: string) => {
    const parsed = parseTimeOfDay(raw);
    if (!parsed) return false;
    // Dedupe
    if (times.some((t) => t.hour === parsed.hour && t.minute === parsed.minute)) {
      return true;
    }
    onChange({ daysOfWeek, times: sortTimes([...times, parsed]) });
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addTime(newTime)) {
      setNewTime('');
    }
  };

  const sortedTimes = sortTimes(times);

  return (
    <div className="flex flex-col gap-4">
      {/* Days of week */}
      <div>
        <h4 className="text-fg-default mb-2 px-1 text-xs font-semibold">曜日</h4>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LABELS.map((d) => {
            const isOn = daysOfWeek.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={cn(
                  'duration-fast h-9 rounded-md text-xs font-medium transition-all',
                  isOn
                    ? 'bg-accent-600 shadow-xs text-white'
                    : 'border-border bg-surface-elevated text-fg-muted hover:bg-surface-muted border',
                  // Subtle weekend tint
                  !isOn && d.value === 0 && 'text-danger/70',
                  !isOn && d.value === 6 && 'text-info/70',
                )}
                aria-pressed={isOn}
                aria-label={d.long}
              >
                {d.short}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1.5">
          {DAY_PRESETS.map((preset) => {
            const active = arrayEquals(daysOfWeek, preset.days);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setPreset(preset.days)}
                className={cn(
                  'duration-fast rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-accent-500/12 text-accent-700 dark:text-accent-300'
                    : 'text-fg-subtle hover:text-fg-default hover:bg-surface-muted',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Times */}
      <div>
        <h4 className="text-fg-default mb-2 px-1 text-xs font-semibold">時刻</h4>
        {sortedTimes.length === 0 ? (
          <p className="border-border text-fg-subtle rounded-md border border-dashed px-3 py-3 text-center text-xs">
            時刻を1つ以上追加してください
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sortedTimes.map((t, i) => (
              <li
                key={`${t.hour}:${t.minute}`}
                className="border-border bg-surface-elevated flex items-center gap-2 rounded-md border px-3 py-2"
              >
                <span className="text-accent-600 text-sm font-semibold tabular-nums">
                  {formatTimeOfDay(t)}
                </span>
                <span className="text-fg-subtle text-[11px]">
                  {/* Show 12h variant for friendliness */}({t.hour < 12 ? '午前' : '午後'}{' '}
                  {((t.hour + 11) % 12) + 1}:{String(t.minute).padStart(2, '0')})
                </span>
                <button
                  type="button"
                  onClick={() => removeTime(i)}
                  className="text-fg-subtle hover:text-danger ml-auto flex h-6 w-6 items-center justify-center rounded transition-colors"
                  aria-label="削除"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="mt-2 flex gap-1.5">
          <Input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" size="md" disabled={!parseTimeOfDay(newTime)}>
            <Plus className="h-3.5 w-3.5" />
            追加
          </Button>
        </form>
      </div>
    </div>
  );
}
