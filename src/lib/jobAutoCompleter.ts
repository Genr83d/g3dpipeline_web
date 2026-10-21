import type { Job, UserRole } from '../types';
import { isDueForAutoCompletion } from './jobCompletion';

export interface AutoCompleteUser {
  uid: string;
  role: UserRole;
}

/** Mirrors who completeJob lets complete a job. AWF accounts never sweep on
 *  the web: completing reads inventory, which their role cannot read. */
export function canAutoComplete(job: Job, user: AutoCompleteUser): boolean {
  if (user.role === 'awf') return false;
  return user.role === 'manager' || user.role === 'admin' || job.collaboratorUids.includes(user.uid);
}

/** A minute past the next local midnight, so a device clock running slightly
 *  ahead of the server does not stamp a completion the rules see as in the
 *  future. */
export function msUntilNextSweep(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1);
  return next.getTime() - now.getTime();
}

export interface JobAutoCompleterOptions {
  user: AutoCompleteUser;
  /** Completes one job; normally jobService.autoCompleteJob. */
  complete: (job: Job, now: Date) => Promise<void>;
  /** Called with the jobs a sweep completed, when there were any. */
  onCompleted?: (completed: Job[]) => void;
  clock?: () => Date;
}

/** End-of-day auto-completion of finished jobs.
 *
 *  The shop runs on Firebase's free plan, with no server to run a nightly
 *  job, so every signed-in client sweeps instead: whenever the job list
 *  changes, at a minute past each midnight while the app is open, and when
 *  the tab becomes visible again. A job is swept once the day its work was
 *  finished has ended (see isDueForAutoCompletion). Clients sweeping at once
 *  are safe: completion runs in a transaction that refuses a job that is no
 *  longer started, so stock is only deducted once. */
export class JobAutoCompleter {
  // A job is tried once per version: a refusal (stock short, a rule, another
  // client finishing first) is not retried until the job changes, the day
  // rolls over or the tab becomes visible again.
  private readonly attempted = new Set<string>();
  private jobs: readonly Job[] = [];
  private inFlight: Promise<void> | null = null;
  private sweepAgain = false;
  private disposed = false;
  private readonly clock: () => Date;

  constructor(private readonly options: JobAutoCompleterOptions) {
    this.clock = options.clock ?? (() => new Date());
  }

  /** Takes the latest job list and sweeps it. */
  update(jobs: readonly Job[]): void {
    this.jobs = jobs;
    void this.sweep();
  }

  /** Forgets earlier refusals and sweeps again. */
  retryAll(): void {
    this.attempted.clear();
    void this.sweep();
  }

  /** Sweeps the latest job list. A call during a sweep queues one more pass
   *  over the newest list and returns the running sweep. */
  sweep(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.inFlight) {
      this.sweepAgain = true;
      return this.inFlight;
    }
    this.inFlight = this.sweepUntilSettled().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  dispose(): void {
    this.disposed = true;
  }

  private async sweepUntilSettled(): Promise<void> {
    do {
      this.sweepAgain = false;
      const now = this.clock();
      const completed: Job[] = [];

      for (const job of this.jobs) {
        if (!isDueForAutoCompletion(job, now) || !canAutoComplete(job, this.options.user)) continue;
        const key = `${job.id}@${job.updatedAt?.getTime() ?? ''}`;
        if (this.attempted.has(key)) continue;
        this.attempted.add(key);

        try {
          await this.options.complete(job, now);
          completed.push(job);
        } catch {
          // Left open for a manual completion or a later sweep.
        }
        if (this.disposed) return;
      }

      if (completed.length > 0) this.options.onCompleted?.(completed);
    } while (this.sweepAgain && !this.disposed);
  }
}

export function autoCompletedMessage(completed: readonly Job[]): string {
  return completed.length === 1
    ? `${completed[0].name} was finished on an earlier day, so it was auto-completed.`
    : `${completed.length} jobs finished on earlier days were auto-completed.`;
}
