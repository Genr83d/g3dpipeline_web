import { useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import {
  JobAutoCompleter,
  autoCompletedMessage,
  msUntilNextSweep,
} from '../lib/jobAutoCompleter';
import { autoCompleteJob, type Actor, type Assigner } from '../services/jobService';
import type { Job } from '../types';

/** Runs the end-of-day sweep (see JobAutoCompleter) over the live job list
 *  for as long as the signed-in workspace is mounted. */
export function useJobAutoCompletion(
  jobs: readonly Job[],
  actor: Actor | null,
  self: Assigner | null,
): void {
  const { toast } = useToast();
  const completerRef = useRef<JobAutoCompleter | null>(null);
  // The latest values, so a profile snapshot that changes neither the
  // account nor its role does not restart the sweeper.
  const latest = useRef({ jobs, actor, self, toast });
  latest.current = { jobs, actor, self, toast };

  const uid = actor?.uid ?? null;
  const role = self?.role ?? null;

  useEffect(() => {
    if (!uid || !role) return;

    const completer = new JobAutoCompleter({
      user: { uid, role },
      complete: (job, now) => {
        const { actor: currentActor, self: currentSelf } = latest.current;
        if (!currentActor || !currentSelf) return Promise.reject(new Error('Signed out.'));
        return autoCompleteJob(currentActor, currentSelf, job.id, now);
      },
      onCompleted: (completed) => latest.current.toast(autoCompletedMessage(completed), 'success'),
    });
    completerRef.current = completer;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleMidnight = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        scheduleMidnight();
        completer.retryAll();
      }, msUntilNextSweep(new Date()));
    };
    // Background tabs throttle timers, so a midnight can be missed.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      scheduleMidnight();
      completer.retryAll();
    };

    scheduleMidnight();
    document.addEventListener('visibilitychange', onVisibilityChange);
    completer.update(latest.current.jobs);

    return () => {
      completer.dispose();
      completerRef.current = null;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [uid, role]);

  useEffect(() => {
    completerRef.current?.update(jobs);
  }, [jobs]);
}
