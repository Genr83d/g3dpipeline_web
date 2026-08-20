import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job, JobSection, UserRole } from '../types';
import { JobCard } from '../components/JobCard';
import { JobForm } from '../components/JobForm';
import { SectionProgressModal } from '../components/SectionProgressModal';
import { sectionRequiredMessage } from '../lib/jobSections';

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

const ACTUATOR_PROCESSES: JobSection[] = [
  { name: 'Cleaning', progress: 100, collaboratorUid: 'worker-1' },
  { name: 'Welding', progress: 50, collaboratorUid: 'worker-1' },
  { name: 'Machining', progress: 25, collaboratorUid: 'worker-2' },
  { name: 'Spraying', progress: 0, collaboratorUid: '' },
];

const CHAIR_SECTIONS: JobSection[] = [
  { name: 'Design', progress: 60, collaboratorUid: 'worker-1' },
  { name: 'Routing', progress: 30, collaboratorUid: 'worker-2' },
  { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-2' },
];

const TEAM = [
  { uid: 'worker-1', name: 'Worker One', role: 'staff' as UserRole },
  { uid: 'worker-2', name: 'Worker Two', role: 'staff' as UserRole },
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
    assignedToName: 'Worker One',
    assignedToRole: 'staff',
    assignedByUid: '',
    assignedByName: '',
    assignedAt: null,
    collaborators: TEAM,
    collaboratorUids: ['worker-1', 'worker-2'],
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

/** A manufacturing job broken into sections, the headline case for this feature. */
function chairJob(overrides: Partial<Job> = {}): Job {
  return job({
    name: 'Chairs',
    category: 'manufacturing',
    repairProcesses: CHAIR_SECTIONS,
    ...overrides,
  });
}

beforeEach(() => {
  testState.role = 'staff';
  testState.uid = 'worker-1';
});

describe('job sections on the job card', () => {
  it('lists every section with its own percentage and bar', () => {
    render(<JobCard job={job()} />);

    const list = screen.getByTestId('job-sections-job-1');
    expect(within(list).getByText('Cleaning')).toBeInTheDocument();
    expect(within(list).getByText('Welding')).toBeInTheDocument();
    expect(within(list).getByText('Machining')).toBeInTheDocument();
    expect(within(list).getByText('Spraying')).toBeInTheDocument();

    expect(screen.getByRole('progressbar', { name: 'Welding progress' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByTestId('job-section-fill-job-1-welding')).toHaveStyle({ width: '50%' });
    expect(screen.getByTestId('job-section-fill-job-1-spraying')).toHaveStyle({ width: '0%' });
  });

  it('shows sections with their own bars on a manufacturing job', () => {
    render(<JobCard job={chairJob()} />);

    const list = screen.getByTestId('job-sections-job-1');
    expect(within(list).getByText('Design')).toBeInTheDocument();
    expect(within(list).getByText('Routing')).toBeInTheDocument();
    expect(within(list).getByText('Metalworking')).toBeInTheDocument();

    expect(screen.getByRole('progressbar', { name: 'Design progress' })).toHaveAttribute(
      'aria-valuenow',
      '60',
    );
    expect(screen.getByTestId('job-section-fill-job-1-design')).toHaveStyle({ width: '60%' });
    expect(screen.getByTestId('job-section-fill-job-1-routing')).toHaveStyle({ width: '30%' });
    expect(screen.getByTestId('job-section-fill-job-1-metalworking')).toHaveStyle({ width: '0%' });
  });

  it('names the collaborator on each section, or “Unassigned”', () => {
    render(<JobCard job={chairJob()} />);

    const list = screen.getByTestId('job-sections-job-1');
    expect(within(list).getByText('Worker One')).toBeInTheDocument();
    expect(within(list).getAllByText('Worker Two')).toHaveLength(2);

    render(<JobCard job={job({ id: 'job-2' })} />);
    expect(within(screen.getByTestId('job-sections-job-2')).getByText('Unassigned')).toBeInTheDocument();
  });

  it('says “Repair processes” for repairs and “Job sections” everywhere else', () => {
    const { rerender } = render(<JobCard job={job()} />);
    expect(screen.getByText('Repair processes')).toBeInTheDocument();

    rerender(<JobCard job={chairJob()} />);
    expect(screen.getByText('Job sections')).toBeInTheDocument();
    expect(screen.queryByText('Repair processes')).not.toBeInTheDocument();
  });

  it('shows the rounded average beside the heading', () => {
    const { rerender } = render(<JobCard job={job()} />);
    expect(screen.getByText('44% overall')).toBeInTheDocument();

    rerender(<JobCard job={chairJob()} />);
    expect(screen.getByText('30% overall')).toBeInTheDocument();
  });

  it('stays hidden for jobs with no sections at all', () => {
    render(<JobCard job={job({ category: 'manufacturing', repairProcesses: [] })} />);
    expect(screen.queryByTestId('job-sections-job-1')).not.toBeInTheDocument();
  });

  it('offers the update action to a section owner, a manager, and an admin', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<JobCard job={chairJob()} onUpdateSectionProgress={onUpdate} />);
    expect(screen.getByRole('button', { name: 'Update section progress' })).toBeInTheDocument();

    for (const role of ['manager', 'admin'] as const) {
      testState.role = role;
      testState.uid = 'boss-1';
      rerender(<JobCard job={chairJob({ id: `job-${role}` })} onUpdateSectionProgress={onUpdate} />);
      expect(screen.getByRole('button', { name: 'Update section progress' })).toBeInTheDocument();
    }
  });

  it('hides the update action from a collaborator who owns no section', () => {
    testState.uid = 'worker-3';
    render(
      <JobCard
        job={chairJob({
          collaborators: [...TEAM, { uid: 'worker-3', name: 'Worker Three', role: 'staff' }],
          collaboratorUids: ['worker-1', 'worker-2', 'worker-3'],
        })}
        onUpdateSectionProgress={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Update section progress' }),
    ).not.toBeInTheDocument();
  });

  it('hides the update action from outsiders and on completed jobs', () => {
    testState.uid = 'someone-else';
    const { rerender } = render(<JobCard job={job()} onUpdateSectionProgress={vi.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Update section progress' }),
    ).not.toBeInTheDocument();

    testState.uid = 'worker-1';
    rerender(
      <JobCard
        job={job({ status: 'completed', completedAt: new Date('2099-01-01') })}
        onUpdateSectionProgress={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Update section progress' }),
    ).not.toBeInTheDocument();
    // The sections themselves stay readable on a completed job.
    expect(screen.getByTestId('job-sections-job-1')).toBeInTheDocument();
  });

  it('opens the progress editor from the card', async () => {
    const onUpdate = vi.fn();
    render(<JobCard job={job()} onUpdateSectionProgress={onUpdate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Update section progress' }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
  });
});

describe('section progress dialog', () => {
  it('shows one slider per section with its stored percentage', () => {
    testState.role = 'manager';
    render(<SectionProgressModal job={job()} onSave={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Cleaning')).toHaveValue('100');
    expect(screen.getByLabelText('Welding')).toHaveValue('50');
    expect(screen.getByLabelText('Machining')).toHaveValue('25');
    expect(screen.getByLabelText('Spraying')).toHaveValue('0');
    expect(screen.getByLabelText('Welding')).toHaveAttribute('step', '5');
  });

  it('disables sections owned by someone else and names their owner', () => {
    render(<SectionProgressModal job={chairJob()} onSave={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Design')).toBeEnabled();
    expect(screen.getByLabelText('Routing')).toBeDisabled();
    expect(screen.getByLabelText('Metalworking')).toBeDisabled();
    expect(screen.getAllByText('Assigned to Worker Two')).toHaveLength(2);
  });

  it('marks an unassigned section as such for a collaborator', () => {
    render(<SectionProgressModal job={job()} onSave={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Spraying')).toBeDisabled();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('leaves every section editable for a manager', () => {
    testState.role = 'manager';
    testState.uid = 'boss-1';
    render(<SectionProgressModal job={chairJob()} onSave={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Design')).toBeEnabled();
    expect(screen.getByLabelText('Routing')).toBeEnabled();
    expect(screen.getByLabelText('Metalworking')).toBeEnabled();
    expect(screen.queryByText(/^Assigned to /)).not.toBeInTheDocument();
  });

  it('recalculates the overall figure as a slider moves and saves every section', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SectionProgressModal job={chairJob()} onSave={onSave} onClose={vi.fn()} />);

    expect(screen.getByText('30% overall')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Design'), { target: { value: '90' } });
    expect(screen.getByText('40% overall')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save Progress' }));
    expect(onSave).toHaveBeenCalledWith([
      { name: 'Design', progress: 90, collaboratorUid: 'worker-1' },
      { name: 'Routing', progress: 30, collaboratorUid: 'worker-2' },
      { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-2' },
    ]);
  });

  it('keeps the dialog open and reports a failed write', async () => {
    render(
      <SectionProgressModal
        job={job()}
        onSave={vi.fn().mockRejectedValue(new Error('denied'))}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save Progress' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to update section progress. Try again.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('job sections in the job form', () => {
  async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Job Name'), 'Chairs');
    await user.type(screen.getByLabelText('Name of Receiver'), 'Customer');
    await user.type(screen.getByLabelText('Quantity'), '1');
    fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '2099-01-01' } });
  }

  it('appears for every job type, relabelled for repairs', async () => {
    const user = userEvent.setup();
    render(<JobForm submitLabel="Add job" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText('Job sections')).toBeInTheDocument();
    expect(
      screen.getByText(/Enter one section per line, such as Design, Routing, or Metalworking/),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Job Type'), 'repair');
    expect(screen.getByLabelText('Repair processes')).toBeInTheDocument();
    expect(
      screen.getByText(/Enter one process per line, such as Cleaning, Welding, Machining, or Spraying/),
    ).toBeInTheDocument();
  });

  it('blocks any job with no sections, with per-category wording', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<JobForm submitLabel="Add job" onSubmit={onSubmit} onCancel={vi.fn()} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Job sections'), '   \n  ');
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    expect(screen.getByRole('alert')).toHaveTextContent(sectionRequiredMessage('manufacturing'));

    await user.selectOptions(screen.getByLabelText('Job Type'), 'repair');
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    expect(screen.getByRole('alert')).toHaveTextContent(sectionRequiredMessage('repair'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits one trimmed name per line', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<JobForm submitLabel="Add job" onSubmit={onSubmit} onCancel={vi.fn()} />);

    await fillRequiredFields(user);
    await user.type(
      screen.getByLabelText('Job sections'),
      '  Design  \n\nRouting\ndesign\nMetalworking',
    );
    await user.click(screen.getByRole('button', { name: 'Add job' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'manufacturing',
        sectionNames: ['Design', 'Routing', 'Metalworking'],
      }),
    );
  });

  it('loads the stored names when editing and keeps them across a category change', async () => {
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
    expect(screen.getByLabelText('Job sections')).toHaveValue(
      'Cleaning\nWelding\nMachining\nSpraying',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'manufacturing',
        sectionNames: ['Cleaning', 'Welding', 'Machining', 'Spraying'],
      }),
    );
  });
});
