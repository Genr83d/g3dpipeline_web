import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from '../types';
import { ToastProvider } from '../components/Toast';
import { JobCard } from '../components/JobCard';
import { autoCompletionTime, isDueForAutoCompletion } from '../lib/jobCompletion';
import {
  JobAutoCompleter,
  autoCompletedMessage,
  canAutoComplete,
  msUntilNextSweep,
} from '../lib/jobAutoCompleter';
import { useJobAutoCompletion } from '../hooks/useJobAutoCompletion';
import type { Actor, Assigner } from '../services/jobService';

const service = vi.hoisted(() => ({ autoCompleteJob: vi.fn(async () => undefined) }));
vi.mock('../services/jobService', () => ({ autoCompleteJob: service.autoCompleteJob }));
vi.mock('../context/AuthProvider', () => ({
  useAuth: () => ({
    profile: {
      uid: 'manager-1',
      role: 'manager',
      name: 'Renee Bailey',
      email: 'renee@example.com',
      status: 'active',
      createdAt: null,
      updatedAt: null,
    },
  }),
}));
vi.mock('../context/AppearanceProvider', () => ({ useAppearance: () => ({ motionReduced: true }) }));

const NOW = new Date(2026, 9, 21, 8, 30);
const YESTERDAY_AFTERNOON = new Date(2026, 9, 20, 15);
const manager = { uid: 'manager-1', role: 'manager' as const };

function job(overrides: Partial<Job> = {}): Job {
  return {
    tags: [],
    id: 'job-1', orderNumber: 'G3D-JOB-1', name: 'Keychains', customer: 'Acme', quantity: 10,
    completedQuantity: 10, dueDate: new Date(2026, 9, 25), status: 'started',
    category: 'manufacturing',
    repairProcesses: [{ name: 'Printing', progress: 100, collaboratorUid: 'staff-1' }],
    isAwf: false, createdByUid: 'creator', createdByName: 'Creator',
    createdByEmail: '', assignedToUid: 'staff-1', assignedToName: 'Alex', assignedToRole: 'staff',
    assignedByUid: '', assignedByName: '', assignedAt: null,
    collaborators: [{ uid: 'staff-1', name: 'Alex', role: 'staff' }],
    collaboratorUids: ['staff-1'], createdAt: null, updatedAt: YESTERDAY_AFTERNOON, startedAt: null,
    completedAt: null, completedByUid: '', completedByName: '', updatedByUid: 'staff-1',
    updatedByName: 'Alex', dueDateChangeNote: '', previousDueDate: null, dueDateChangedAt: null,
    dueDateChangedByUid: '', dueDateChangedByName: '', ...overrides,
  };
}

describe('isDueForAutoCompletion', () => {
  it('is due once the day the work was finished has ended', () => {
    expect(isDueForAutoCompletion(job(), NOW)).toBe(true);
  });

  it('waits until tomorrow for a job finished today', () => {
    const today = job({ updatedAt: new Date(2026, 9, 21, 7) });
    expect(isDueForAutoCompletion(today, NOW)).toBe(false);
    expect(isDueForAutoCompletion(today, new Date(2026, 9, 22, 0, 1))).toBe(true);
  });

  it('keeps unfinished, pending, completed and unstamped jobs open', () => {
    expect(isDueForAutoCompletion(job({ completedQuantity: 9 }), NOW)).toBe(false);
    expect(
      isDueForAutoCompletion(
        job({ repairProcesses: [{ name: 'Packing', progress: 99, collaboratorUid: '' }] }),
        NOW,
      ),
    ).toBe(false);
    expect(isDueForAutoCompletion(job({ status: 'pending' }), NOW)).toBe(false);
    expect(isDueForAutoCompletion(job({ status: 'completed' }), NOW)).toBe(false);
    expect(isDueForAutoCompletion(job({ updatedAt: null }), NOW)).toBe(false);
  });
});

describe('autoCompletionTime', () => {
  it('is the end of the day the work was finished', () => {
    expect(autoCompletionTime(YESTERDAY_AFTERNOON)).toEqual(new Date(2026, 9, 20, 23, 59, 59, 999));
  });

  it('stays within a day of the last update', () => {
    const midnight = new Date(2026, 9, 20);
    const stamp = autoCompletionTime(midnight);
    expect(stamp > midnight).toBe(true);
    expect(stamp.getTime() - midnight.getTime()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});

describe('canAutoComplete', () => {
  it('lets managers, admins and collaborators sweep', () => {
    expect(canAutoComplete(job(), manager)).toBe(true);
    expect(canAutoComplete(job(), { uid: 'admin-1', role: 'admin' })).toBe(true);
    expect(canAutoComplete(job(), { uid: 'staff-1', role: 'staff' })).toBe(true);
  });

  it('leaves other staff and AWF accounts out', () => {
    expect(canAutoComplete(job(), { uid: 'staff-2', role: 'staff' })).toBe(false);
    expect(
      canAutoComplete(job({ collaboratorUids: ['awf-1'] }), { uid: 'awf-1', role: 'awf' }),
    ).toBe(false);
  });
});

describe('msUntilNextSweep', () => {
  it('is a minute past the next midnight', () => {
    expect(msUntilNextSweep(new Date(2026, 9, 21, 23, 0))).toBe(61 * 60 * 1000);
  });
});

describe('JobAutoCompleter', () => {
  function sweeper(complete: (job: Job) => Promise<void> = async () => undefined) {
    const completed: string[] = [];
    const reported: Job[][] = [];
    const instance = new JobAutoCompleter({
      user: manager,
      clock: () => NOW,
      onCompleted: (jobs) => reported.push(jobs),
      complete: async (target, at) => {
        expect(at).toBe(NOW);
        await complete(target);
        completed.push(target.id);
      },
    });
    return { instance, completed, reported };
  }

  it('completes only the jobs that are due, and reports them', async () => {
    const { instance, completed, reported } = sweeper();
    instance.update([
      job({ id: 'done-yesterday' }),
      job({ id: 'done-today', updatedAt: new Date(2026, 9, 21, 7) }),
      job({ id: 'unfinished', completedQuantity: 3 }),
    ]);
    await instance.sweep();
    expect(completed).toEqual(['done-yesterday']);
    expect(reported.map((jobs) => jobs.map((j) => j.id))).toEqual([['done-yesterday']]);
  });

  it('does not retry a refused job until it changes', async () => {
    let attempts = 0;
    const { instance, completed } = sweeper(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Not enough Lamina in stock.');
    });
    instance.update([job()]);
    await instance.sweep();
    instance.update([job()]);
    await instance.sweep();
    expect(attempts).toBe(1);

    instance.update([job({ updatedAt: new Date(2026, 9, 20, 18) })]);
    await instance.sweep();
    expect(attempts).toBe(2);
    expect(completed).toEqual(['job-1']);
  });

  it('retries everything after retryAll', async () => {
    let attempts = 0;
    const { instance } = sweeper(async () => {
      attempts += 1;
      throw new Error('Clock ahead of the server.');
    });
    instance.update([job()]);
    await instance.sweep();
    instance.retryAll();
    await instance.sweep();
    expect(attempts).toBe(2);
  });

  it('does not complete a job twice when lists arrive mid-sweep', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { instance, completed } = sweeper(() => gate);
    instance.update([job()]);
    instance.update([job()]);
    instance.update([job(), job({ id: 'job-2' })]);
    release();
    await instance.sweep();
    expect(completed).toEqual(['job-1', 'job-2']);
  });

  it('stops after dispose', async () => {
    const { instance, completed } = sweeper();
    instance.dispose();
    instance.update([job()]);
    await instance.sweep();
    expect(completed).toEqual([]);
  });
});

describe('autoCompletedMessage', () => {
  it('names a single job and counts several', () => {
    expect(autoCompletedMessage([job()])).toBe(
      'Keychains was finished on an earlier day, so it was auto-completed.',
    );
    expect(autoCompletedMessage([job(), job({ id: 'job-2' })])).toBe(
      '2 jobs finished on earlier days were auto-completed.',
    );
  });
});

describe('useJobAutoCompletion', () => {
  const actor: Actor = { uid: 'manager-1', firstName: 'Renee', displayName: 'Renee Bailey', email: '' };
  const self: Assigner = { uid: 'manager-1', name: 'Renee Bailey', role: 'manager' };
  const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 17));
    service.autoCompleteJob.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sweeps the live list and toasts what it completed', async () => {
    renderHook(() => useJobAutoCompletion([job()], actor, self), { wrapper });
    await act(async () => {});
    expect(service.autoCompleteJob).toHaveBeenCalledWith(actor, self, 'job-1', expect.any(Date));
    expect(
      screen.getByText('Keychains was finished on an earlier day, so it was auto-completed.'),
    ).toBeInTheDocument();
  });

  it('does nothing while signed out', async () => {
    renderHook(() => useJobAutoCompletion([job()], null, null), { wrapper });
    await act(async () => {});
    expect(service.autoCompleteJob).not.toHaveBeenCalled();
  });

  it('sweeps a job finished today at a minute past midnight', async () => {
    const today = job({ updatedAt: new Date(2026, 9, 21, 16) });
    renderHook(() => useJobAutoCompletion([today], actor, self), { wrapper });
    await act(async () => {});
    expect(service.autoCompleteJob).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7 * 60 * 60 * 1000 + 60 * 1000);
    });
    expect(service.autoCompleteJob).toHaveBeenCalledTimes(1);
  });

  it('sweeps again when the tab comes back into view', async () => {
    const { rerender } = renderHook(
      ({ jobs }: { jobs: Job[] }) => useJobAutoCompletion(jobs, actor, self),
      { wrapper, initialProps: { jobs: [job()] } },
    );
    await act(async () => {});
    service.autoCompleteJob.mockRejectedValueOnce(new Error('offline'));
    rerender({ jobs: [job({ id: 'job-2' })] });
    await act(async () => {});
    expect(service.autoCompleteJob).toHaveBeenCalledTimes(2);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(service.autoCompleteJob).toHaveBeenCalledTimes(3);
  });
});

describe('archive card', () => {
  it('marks a job the sweep completed', () => {
    render(
      <JobCard
        job={job({
          status: 'completed',
          completedByName: 'Alex',
          completedAt: new Date(2026, 9, 20, 23, 59, 59),
          autoCompleted: true,
        })}
      />,
    );
    expect(screen.getByText(/Alex\s*\(auto, end of day\)/)).toBeInTheDocument();
  });
});
