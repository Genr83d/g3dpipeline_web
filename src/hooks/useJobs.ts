import { useEffect, useState } from 'react';
import { watchJobs } from '../services/jobService';
import type { Job } from '../types';

export interface JobsState {
  jobs: Job[];
  loading: boolean;
  error: string | null;
}

export function useJobs(enabled: boolean): JobsState {
  const [state, setState] = useState<JobsState>({ jobs: [], loading: true, error: null });

  useEffect(() => {
    if (!enabled) return;
    setState({ jobs: [], loading: true, error: null });
    return watchJobs(
      (jobs) => setState({ jobs, loading: false, error: null }),
      (err) => setState({ jobs: [], loading: false, error: err.message }),
    );
  }, [enabled]);

  return state;
}
