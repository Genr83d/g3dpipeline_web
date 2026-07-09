import { motion } from 'framer-motion';
import { useAppearance } from '../context/AppearanceProvider';

/** Pipeline progress as a hero number plus one thin segmented bar —
 *  completed (success), in progress (amber), pending (primary) — with
 *  2px surface gaps between segments and a legend carrying the counts. */
export function JobProgressGauge({
  pending,
  started,
  completed,
}: {
  pending: number;
  started: number;
  completed: number;
}) {
  const { motionReduced } = useAppearance();
  const total = pending + started + completed;
  const completionPercentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  const segments = [
    {
      key: 'completed',
      label: 'Completed',
      count: completed,
      cls: 'bg-secondary dark:bg-emerald-400',
    },
    {
      key: 'started',
      label: 'In Progress',
      count: started,
      cls: 'bg-amber-600 dark:bg-amber-400',
    },
    {
      key: 'pending',
      label: 'Pending',
      count: pending,
      cls: 'bg-primary dark:bg-indigo-400',
    },
  ];

  return (
    <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="shrink-0">
        <p className="technical-label">Pipeline completion</p>
        <p className="font-display text-5xl font-bold tabular-nums text-ink dark:text-slate-50">
          {completionPercentage}%
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {total} total job{total === 1 ? '' : 's'}
        </p>
      </div>
      <div className="w-full min-w-0 flex-1 space-y-3">
        <div
          role="img"
          aria-label={`${completionPercentage}% of jobs complete: ${completed} completed, ${started} in progress, ${pending} pending`}
          className="flex h-4 w-full gap-0.5 overflow-hidden rounded-md border border-slate-200/70 bg-slate-200/80 p-0.5 dark:border-slate-800 dark:bg-slate-950/60"
        >
          {total > 0 &&
            segments.map(
              (s) =>
                s.count > 0 && (
                  <motion.div
                    key={s.key}
                    className={`h-full ${s.cls}`}
                    initial={motionReduced ? false : { width: 0 }}
                    animate={{ width: `${(s.count / total) * 100}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                  />
                ),
            )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-3">
          {segments.map((s) => (
            <li
              key={s.key}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-200/60 bg-white/45 px-3 py-2 text-sm dark:border-slate-800/80 dark:bg-slate-950/25"
            >
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${s.cls}`} />
                {s.label}
              </span>
              <span className="font-semibold tabular-nums">{s.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
