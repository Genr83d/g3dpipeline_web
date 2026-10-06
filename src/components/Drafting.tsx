import type { ReactNode } from 'react';
import { useAppearance } from '../context/AppearanceProvider';

/** Signal colours. Status hue lives here and on progress fills only — the rest
 *  of the interface stays ink and slate, so a lit LED actually reads. */
export type SignalTone = 'primary' | 'amber' | 'secondary' | 'danger' | 'idle';

const dotStyles: Readonly<Record<SignalTone, string>> = {
  primary: 'bg-primary dark:bg-indigo-300',
  amber: 'bg-amber-500 dark:bg-amber-300',
  secondary: 'bg-secondary dark:bg-emerald-300',
  danger: 'bg-danger dark:bg-red-400',
  idle: 'bg-slate-400 dark:bg-slate-500',
};

export const signalText: Readonly<Record<SignalTone, string>> = {
  primary: 'text-primary dark:text-indigo-300',
  amber: 'text-amber-700 dark:text-amber-300',
  secondary: 'text-secondary dark:text-emerald-300',
  danger: 'text-danger dark:text-red-300',
  idle: 'text-slate-500 dark:text-slate-400',
};

export const signalFill: Readonly<Record<SignalTone, string>> = {
  primary: 'bg-primary dark:bg-indigo-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  secondary: 'bg-secondary dark:bg-emerald-400',
  danger: 'bg-danger dark:bg-red-400',
  idle: 'bg-slate-400 dark:bg-slate-500',
};

export const signalTrack: Readonly<Record<SignalTone, string>> = {
  primary: 'bg-primary/12 dark:bg-indigo-400/15',
  amber: 'bg-amber-500/15 dark:bg-amber-400/15',
  secondary: 'bg-secondary/15 dark:bg-emerald-400/15',
  danger: 'bg-danger/12 dark:bg-red-400/15',
  idle: 'bg-slate-400/15 dark:bg-slate-500/20',
};

/** A small indicator lamp. `live` adds a slow halo for work that is actively
 *  running; it is dropped when the user has asked for reduced motion. */
export function Led({ tone, live = false }: { tone: SignalTone; live?: boolean }) {
  const { motionReduced } = useAppearance();
  return (
    <span aria-hidden className="relative inline-flex h-2 w-2 shrink-0">
      {live && !motionReduced && (
        <span
          className={`absolute inset-0 animate-ping rounded-full opacity-50 [animation-duration:2.4s] ${dotStyles[tone]}`}
        />
      )}
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ring-2 ring-white/70 dark:ring-slate-950/70 hc:ring-0 ${dotStyles[tone]}`}
      />
    </span>
  );
}

/** A dimension line used as a section rule: end ticks, a mono label, a
 *  hairline, and an optional measured value on the right.
 *
 *    ├ CHECKLIST ─────────────── 1/3 ┤ */
export function DimRule({
  label,
  value,
  className = '',
}: {
  label: ReactNode;
  value?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-slate-500 dark:text-slate-400 ${className}`}
    >
      <span aria-hidden className="h-2.5 w-px shrink-0 bg-[var(--rule)]" />
      <div className="technical-label shrink-0">{label}</div>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-[var(--rule)]" />
      {value !== undefined && (
        <span className="readout shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {value}
        </span>
      )}
      <span aria-hidden className="h-2.5 w-px shrink-0 bg-[var(--rule)]" />
    </div>
  );
}

/** A linear gauge. The fill eases to its value with a CSS transition, so a
 *  saved change visibly travels rather than jumping. */
export function Gauge({
  value,
  tone,
  label,
  testId,
  className = 'h-1.5',
}: {
  value: number;
  tone: SignalTone;
  label: string;
  testId?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`overflow-hidden rounded-[1px] ${signalTrack[tone]} ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        data-testid={testId}
        className={`h-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${signalFill[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
