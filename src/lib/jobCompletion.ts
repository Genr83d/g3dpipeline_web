import type { Job, JobSection } from '../types';
import { jobQuantityConfig } from './jobCategories';

export type CompletionGateInput = Pick<Job, 'category' | 'quantity' | 'completedQuantity'> & {
  repairProcesses: readonly JobSection[];
};

/** What still stands between a job and completion: units not yet made (for
 *  categories that count units) and sections below 100%. Empty means the job
 *  is ready to complete. The same rule the Firestore rules enforce, and the
 *  same wording as the Flutter app. */
export function jobCompletionBlockers(job: CompletionGateInput): string[] {
  const blockers: string[] = [];
  if (jobQuantityConfig(job.category).usesQuantity && job.completedQuantity < job.quantity) {
    const left = job.quantity - Math.min(Math.max(job.completedQuantity, 0), job.quantity);
    blockers.push(`${left} of ${job.quantity} ${job.quantity === 1 ? 'unit' : 'units'} still to finish`);
  }
  for (const section of job.repairProcesses) {
    if (section.progress < 100) blockers.push(`${section.name} is at ${section.progress}%`);
  }
  return blockers;
}

/** Every counted unit is done and every section is at 100%. */
export function isJobReadyToComplete(job: CompletionGateInput): boolean {
  return jobCompletionBlockers(job).length === 0;
}

/** A started job is auto-completed once the day its work was finished has
 *  ended: every unit and section is done and it was last updated on an
 *  earlier calendar day than `now`. A job finished today waits until
 *  tomorrow, so it can still be corrected before it closes. The same rule as
 *  the Flutter app. */
export function isDueForAutoCompletion(
  job: CompletionGateInput & Pick<Job, 'status' | 'updatedAt'>,
  now: Date,
): boolean {
  if (job.status !== 'started' || !job.updatedAt || !isJobReadyToComplete(job)) return false;
  const finished = job.updatedAt;
  return (
    new Date(finished.getFullYear(), finished.getMonth(), finished.getDate()) <
    new Date(now.getFullYear(), now.getMonth(), now.getDate())
  );
}

/** When an end-of-day auto-completion is dated: the end of the calendar day
 *  the job was last updated on, which is when its work was finished.
 *  Firestore rules accept a stamp from that update to a day after it, so it
 *  is held inside that window (only a long daylight-saving day, or an update
 *  in the day's final millisecond, reaches either edge). */
export function autoCompletionTime(lastUpdatedAt: Date): Date {
  const endOfDay = new Date(
    lastUpdatedAt.getFullYear(),
    lastUpdatedAt.getMonth(),
    lastUpdatedAt.getDate(),
    23,
    59,
    59,
    999,
  );
  const cap = new Date(lastUpdatedAt.getTime() + 24 * 60 * 60 * 1000);
  if (endOfDay > cap) return cap;
  return endOfDay < lastUpdatedAt ? lastUpdatedAt : endOfDay;
}
