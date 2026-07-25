import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job, RepairProcess, UserRole } from '../types';
import { JobCard } from '../components/JobCard';
import { JobForm } from '../components/JobForm';
import { RepairProgressModal } from '../components/RepairProgressModal';
import { REPAIR_PROCESS_REQUIRED_MESSAGE } from '../lib/repairProcesses';

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
vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));

const ACTUATOR_PROCESSES: RepairProcess[] = [
  { name: 'Cleaning', progress: 100 },
  { name: 'Welding', progress: 50 },
  { name: 'Machining', progress: 25 },
  { name: 'Spraying', progress: 0 },
];

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    orderNumber: 'G3D-JOB-1',
    name: 'Actuator repair',
    customer: 'Receiver',
    quantity: 1,
    completedQuantity: 0,
    dueDate: new Date('2099-06-15T23:59:59'),
    status: 'started',
    category: 'repair',
    repairProcesses: ACTUATOR_PROCESSES,
    isAwf: false,
    createdByUid: 'creator',
    createdByName: 'Creator',
    createdByEmail: 'creator@example.com',
    assignedToUid: 'worker-1',
    assignedToName: 'Worker',
    assignedToRole: 'staff',
    assignedByUid: '',
    assignedByName: '',
    assignedAt: null,
    collaborators: [{ uid: 'worker-1', name: 'Worker', role: 'staff' }],
    collaboratorUids: ['worker-1'],
    createdAt: null,
    updatedAt: null,
    startedAt: null,
    completedAt: null,
    completedByUid: '',
    completedByName: '',
    updatedByUid: '',
    updatedByName: '',
    dueDateChangeNote: '',
    previousDueDate: null,
    dueDateChangedAt: null,
    dueDateChangedByUid: '',
    dueDateChangedByName: '',
    ...overrides,
  };
}

beforeEach(() => {
  testState.role = 'staff';
  testState.uid = 'worker-1';
});

describe('repair processes on the job card', () => {
  it('lists every process with its own percentage and bar', () => {
    render(<JobCard job={job()} />);

    const list = screen.getByTestId('repair-processes-job-1');
    expect(within(list).getByText('Cleaning')).toBeInTheDocument();
    expect(within(list).getByText('Welding')).toBeInTheDocument();
    expect(within(list).getByText('Machining')).toBeInTheDocument();
    expect(within(list).getByText('Spraying')).toBeInTheDocument();

    expect(screen.getByRole('progressbar', { name: 'Welding progress' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByTestId('repair-process-fill-job-1-welding')).toHaveStyle({ width: '50%' });
    expect(screen.getByTestId('repair-process-fill-job-1-spraying')).toHaveStyle({ width: '0%' });
  });

  it('shows the rounded average beside the heading', () => {
    render(<JobCard job={job()} />);
    expect(screen.getByText('44% overall')).toBeInTheDocument();
  });

  it('stays hidden for jobs that are not repairs', () => {
    render(<JobCard job={job({ category: 'manufacturing', repairProcesses: [] })} />);
    expect(screen.queryByTestId('repair-processes-job-1')).not.toBeInTheDocument();
  });

  it('offers the update action to a collaborator, a manager, and an admin', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<JobCard job={job()} onUpdateRepairProgress={onUpdate} />);
    expect(screen.getByRole('button', { name: 'Update repair process progress' })).toBeInTheDocument();

    for (const role of ['manager', 'admin'] as const) {
      testState.role = role;
      testState.uid = 'boss-1';
      rerender(<JobCard job={job({ ...job(), id: `job-${role}` })} onUpdateRepairProgress={onUpdate} />);
      expect(screen.getByRole('button', { name: 'Update repair process progress' })).toBeInTheDocument();
    }
  });

  it('hides the update action from unassigned staff and on completed jobs', () => {
    testState.uid = 'someone-else';
    const { rerender } = render(<JobCard job={job()} onUpdateRepairProgress={vi.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Update repair process progress' }),
    ).not.toBeInTheDocument();

    testState.uid = 'worker-1';
    rerender(
      <JobCard
        job={job({ status: 'completed', completedAt: new Date('2099-01-01') })}
        onUpdateRepairProgress={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Update repair process progress' }),
    ).not.toBeInTheDocument();
    // The processes themselves stay readable on a completed job.
    expect(screen.getByTestId('repair-processes-job-1')).toBeInTheDocument();
  });

  it('opens the progress editor from the card', async () => {
    const onUpdate = vi.fn();
    render(<JobCard job={job()} onUpdateRepairProgress={onUpdate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Update repair process progress' }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
  });
});

describe('repair process progress dialog', () => {
  it('shows one slider per process with its stored percentage', () => {
    render(<RepairProgressModal job={job()} onSave={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Cleaning')).toHaveValue('100');
    expect(screen.getByLabelText('Welding')).toHaveValue('50');
    expect(screen.getByLabelText('Machining')).toHaveValue('25');
    expect(screen.getByLabelText('Spraying')).toHaveValue('0');
    expect(screen.getByLabelText('Welding')).toHaveAttribute('step', '5');
  });

  it('recalculates the overall figure as a slider moves and saves every process', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RepairProgressModal job={job()} onSave={onSave} onClose={vi.fn()} />);

    expect(screen.getByText('44% overall')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Spraying'), { target: { value: '60' } });
    expect(screen.getByText('59% overall')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save Progress' }));
    expect(onSave).toHaveBeenCalledWith([
      { name: 'Cleaning', progress: 100 },
      { name: 'Welding', progress: 50 },
      { name: 'Machining', progress: 25 },
      { name: 'Spraying', progress: 60 },
    ]);
  });

  it('keeps the dialog open and reports a failed write', async () => {
    render(
      <RepairProgressModal
        job={job()}
        onSave={vi.fn().mockRejectedValue(new Error('denied'))}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save Progress' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to update repair progress. Try again.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('repair processes in the job form', () => {
  async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Job Name'), 'Actuator repair');
    await user.type(screen.getByLabelText('Name of Receiver'), 'Customer');
    await user.type(screen.getByLabelText('Quantity'), '1');
    fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '2099-01-01' } });
  }

  it('appears only for the Repair job type', async () => {
    const user = userEvent.setup();
    render(<JobForm submitLabel="Add job" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText('Repair processes')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Job Type'), 'repair');
    expect(screen.getByLabelText('Repair processes')).toBeInTheDocument();
    expect(
      screen.getByText(/Enter one process per line, such as Cleaning, Welding, Machining, or Spraying/),
    ).toBeInTheDocument();
  });

  it('blocks a repair job with no processes', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<JobForm submitLabel="Add job" onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Job Type'), 'repair');
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Repair processes'), '   \n  ');
    await user.click(screen.getByRole('button', { name: 'Add job' }));

    expect(screen.getByRole('alert')).toHaveTextContent(REPAIR_PROCESS_REQUIRED_MESSAGE);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits one trimmed name per line', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<JobForm submitLabel="Add job" onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Job Type'), 'repair');
    await fillRequiredFields(user);
    await user.type(
      screen.getByLabelText('Repair processes'),
      '  Cleaning  \n\nWelding\ncleaning\nMachining\nSpraying',
    );
    await user.click(screen.getByRole('button', { name: 'Add job' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'repair',
        repairProcessNames: ['Cleaning', 'Welding', 'Machining', 'Spraying'],
      }),
    );
  });

  it('loads the stored process names when editing and clears them for another type', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <JobForm
        initial={job()}
        submitLabel="Save changes"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Repair processes')).toHaveValue(
      'Cleaning\nWelding\nMachining\nSpraying',
    );

    await user.selectOptions(screen.getByLabelText('Job Type'), 'manufacturing');
    expect(screen.queryByLabelText('Repair processes')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'manufacturing', repairProcessNames: [] }),
    );
  });
});
