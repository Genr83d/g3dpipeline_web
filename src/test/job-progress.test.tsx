import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Job, UserRole } from '../types';
import { JobCard } from '../components/JobCard';
import { JobProgressModal } from '../components/JobProgressModal';
import { jobCompletionRatio, resolvedCompletedQuantity, validateCompletedQuantity } from '../lib/jobProgress';
import { canUpdateJobProgress } from '../lib/jobPermissions';

const testState = vi.hoisted(() => ({ role: 'staff' as UserRole, uid: 'worker-1' }));

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => ({
    profile: {
      uid: testState.uid,
      role: testState.role,
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
    id: 'job-1', name: 'Badge batch', customer: 'Client', quantity: 15,
    completedQuantity: 12, dueDate: new Date('2099-01-01'), status: 'started',
    category: 'manufacturing', isAwf: false, createdByUid: 'creator', createdByName: 'Creator',
    createdByEmail: '', assignedToUid: 'worker-1', assignedToName: 'Worker', assignedToRole: 'staff',
    assignedByUid: '', assignedByName: '', assignedAt: null,
    collaborators: [{ uid: 'worker-1', name: 'Worker', role: 'staff' }],
    collaboratorUids: ['worker-1'], createdAt: null, updatedAt: null, startedAt: null,
    completedAt: null, completedByUid: '', completedByName: '', updatedByUid: '', updatedByName: '',
    dueDateChangeNote: '', previousDueDate: null, dueDateChangedAt: null,
    dueDateChangedByUid: '', dueDateChangedByName: '', ...overrides,
  };
}

describe('job progress calculations', () => {
  it('defaults legacy jobs based on status and clamps malformed stored values', () => {
    expect(resolvedCompletedQuantity(undefined, 15, 'pending')).toBe(0);
    expect(resolvedCompletedQuantity(undefined, 15, 'completed')).toBe(15);
    expect(resolvedCompletedQuantity(18, 15, 'started')).toBe(15);
    expect(resolvedCompletedQuantity(-2, 15, 'started')).toBe(0);
  });

  it('calculates each fraction safely, including 12/15 = 80%', () => {
    expect(jobCompletionRatio(12, 15)).toBe(0.8);
    expect(jobCompletionRatio(3, 6)).toBe(0.5);
    expect(jobCompletionRatio(8, 8)).toBe(1);
    expect(jobCompletionRatio(3, 0)).toBe(0);
  });

  it('accepts only whole in-range values', () => {
    expect(validateCompletedQuantity('0', 15)).toBeNull();
    expect(validateCompletedQuantity('15', 15)).toBeNull();
    for (const invalid of ['', '-1', '15.5', '1e1', '16', 'hello']) {
      expect(validateCompletedQuantity(invalid, 15)).toBe('Enter a whole number from 0 to 15.');
    }
  });
});

describe('job progress permissions', () => {
  const target = { status: 'started' as const, collaboratorUids: ['worker-1'], assignedToUid: '' };

  it('allows collaborators, managers, and admins but not unassigned staff', () => {
    expect(canUpdateJobProgress(target, { uid: 'worker-1', role: 'staff' })).toBe(true);
    expect(canUpdateJobProgress(target, { uid: 'manager', role: 'manager' })).toBe(true);
    expect(canUpdateJobProgress(target, { uid: 'admin', role: 'admin' })).toBe(true);
    expect(canUpdateJobProgress(target, { uid: 'other', role: 'staff' })).toBe(false);
  });

  it('rejects completed jobs', () => {
    expect(canUpdateJobProgress({ ...target, status: 'completed' }, { uid: 'worker-1', role: 'staff' })).toBe(false);
  });
});

describe('job progress UI', () => {
  it('shows per-job counts and an 80% fractional bar when collapsed', async () => {
    render(<JobCard job={job()} onUpdateProgress={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Badge batch' }));
    expect(screen.getByText('12/15 units')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
    expect(screen.getByTestId('job-progress-fill-job-1')).toHaveStyle({ width: '80%' });
  });

  it('hides progress for quantity-free categories and edit for one-unit jobs', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<JobCard job={job({ quantity: 1, completedQuantity: 0 })} onUpdateProgress={onUpdate} />);
    expect(screen.queryByRole('button', { name: 'Update job progress' })).not.toBeInTheDocument();
    rerender(<JobCard job={job({ category: 'softwareDevelopment', quantity: 1, completedQuantity: 0 })} onUpdateProgress={onUpdate} />);
    expect(screen.queryByText(/0\/1 units/)).not.toBeInTheDocument();
  });

  it('keeps the editor open and reports a failed write', async () => {
    render(<JobProgressModal job={job()} onSave={vi.fn().mockRejectedValue(new Error('denied'))} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Units completed')).toHaveValue(12);
    await userEvent.click(screen.getByRole('button', { name: 'Save Progress' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to update progress. Try again.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
