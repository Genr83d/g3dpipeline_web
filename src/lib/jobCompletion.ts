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
