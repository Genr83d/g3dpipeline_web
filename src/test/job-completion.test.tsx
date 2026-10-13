import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Job, JobSection } from '../types';
import { JobCard } from '../components/JobCard';
import { isJobReadyToComplete, jobCompletionBlockers } from '../lib/jobCompletion';
import { MAX_JOB_SECTIONS, validateJobSections } from '../lib/jobSections';

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => ({
    profile: {
      uid: 'worker-1',
      role: 'staff',
      name: 'Worker',
      email: 'worker@example.com',
      status: 'active',
      createdAt: null,
      updatedAt: null,
    },
  }),
}));
vi.mock('../context/AppearanceProvider', () => ({ useAppearance: () => ({ motionReduced: true }) }));

function job(overrides: Partial<Job> = {}): Job {
  return {
    tags: [],
    id: 'job-1', orderNumber: 'G3D-JOB-1', name: 'Bracket set', customer: 'Acme', quantity: 20,
    completedQuantity: 20, dueDate: new Date('2099-01-01'), status: 'started',
    category: 'manufacturing',
    repairProcesses: [{ name: 'Design', progress: 100, collaboratorUid: 'worker-1' }],
    isAwf: false, createdByUid: 'creator', createdByName: 'Creator',
    createdByEmail: '', assignedToUid: 'worker-1', assignedToName: 'Worker', assignedToRole: 'staff',
    assignedByUid: '', assignedByName: '', assignedAt: null,
    collaborators: [{ uid: 'worker-1', name: 'Worker', role: 'staff' }],
    collaboratorUids: ['worker-1'], createdAt: null, updatedAt: null, startedAt: null,
    completedAt: null, completedByUid: '', completedByName: '', updatedByUid: '', updatedByName: '',
    dueDateChangeNote: '', previousDueDate: null, dueDateChangedAt: null,
    dueDateChangedByUid: '', dueDateChangedByName: '', ...overrides,
  };
}

const section = (name: string, progress: number): JobSection => ({ name, progress, collaboratorUid: '' });

describe('jobCompletionBlockers', () => {
  it('is empty when every unit and section is done', () => {
    expect(jobCompletionBlockers(job())).toEqual([]);
    expect(isJobReadyToComplete(job())).toBe(true);
  });

  it('lists outstanding units and every unfinished section, matching the Flutter wording', () => {
    expect(
      jobCompletionBlockers(
        job({
          completedQuantity: 12,
          repairProcesses: [section('Design', 100), section('Routing', 60), section('Metalwork', 0)],
        }),
      ),
    ).toEqual(['8 of 20 units still to finish', 'Routing is at 60%', 'Metalwork is at 0%']);
  });

  it('reads naturally for a single unit', () => {
    expect(jobCompletionBlockers(job({ quantity: 1, completedQuantity: 0 }))).toEqual([
      '1 of 1 unit still to finish',
    ]);
  });

  it('ignores units for software development, but not its sections', () => {
    const software = { category: 'softwareDevelopment' as const, quantity: 1, completedQuantity: 0 };
    expect(isJobReadyToComplete(job(software))).toBe(true);
    expect(jobCompletionBlockers(job({ ...software, repairProcesses: [section('Build', 80)] }))).toEqual([
      'Build is at 80%',
    ]);
  });

  it('requires all units for every category that counts them', () => {
    for (const category of ['manufacturing', 'repair', 'design', 'miscellaneous'] as const) {
      expect(isJobReadyToComplete(job({ category, quantity: 2, completedQuantity: 1 }))).toBe(false);
    }
  });
});

describe('job card completion gate', () => {
  it('disables Complete and says what is left', async () => {
    const onComplete = vi.fn();
    render(
      <JobCard
        job={job({ completedQuantity: 12, repairProcesses: [section('Routing', 60)] })}
        onComplete={onComplete}
      />,
    );
    const button = screen.getByRole('button', { name: 'Complete' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/8 of 20 units still to finish/);
    const hint = screen.getByTestId('job-completion-blockers-job-1');
    expect(hint).toHaveTextContent('Finish the work to complete this job');
    expect(hint).toHaveTextContent('Routing is at 60%');
    await userEvent.click(button);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('enables Complete once the work is done', async () => {
    const onComplete = vi.fn();
    render(<JobCard job={job()} onComplete={onComplete} />);
    expect(screen.queryByTestId('job-completion-blockers-job-1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows no checklist to someone who cannot complete the job', () => {
    render(<JobCard job={job({ completedQuantity: 0, collaboratorUids: ['someone-else'], assignedToUid: 'someone-else' })} onComplete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('job-completion-blockers-job-1')).not.toBeInTheDocument();
  });
});

describe('section cap', () => {
  it('allows up to 25 sections, the most the rules can verify', () => {
    const sections = (n: number) => Array.from({ length: n }, (_, i) => section(`Step ${i + 1}`, 0));
    expect(MAX_JOB_SECTIONS).toBe(25);
    expect(validateJobSections('manufacturing', sections(25))).toBeNull();
    expect(validateJobSections('manufacturing', sections(26))).toBe('A job can have at most 25 sections.');
    expect(validateJobSections('repair', sections(26))).toBe('A job can have at most 25 repair processes.');
  });
});
