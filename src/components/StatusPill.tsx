import type { JobStatus } from '../types';
import { Led, signalText, type SignalTone } from './Drafting';

/** Pending → primary, In Progress → amber/caution, Completed → success,
 *  per the Flutter status chip colors. Drawn as an indicator lamp with a mono
 *  label on a hairline outline, so status reads like an instrument panel. */
const styles: Record<JobStatus, { label: string; tone: SignalTone }> = {
  pending: { label: 'PENDING', tone: 'primary' },
  started: { label: 'IN PROGRESS', tone: 'amber' },
  completed: { label: 'COMPLETED', tone: 'secondary' },
};

export function StatusPill({ status, overdue = false }: { status: JobStatus; overdue?: boolean }) {
  const { label, tone } = overdue
    ? { label: 'OVERDUE', tone: 'danger' as const }
    : styles[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-current/25 bg-white/60 px-2 py-0.5 font-mono text-[0.68rem] font-semibold tracking-[0.08em] hc:border-current dark:bg-slate-950/40 ${signalText[tone]}`}
    >
      <Led tone={tone} live={!overdue && status === 'started'} />
      {label}
    </span>
  );
}
