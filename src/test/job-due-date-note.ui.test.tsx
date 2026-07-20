import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobForm, type JobFormValues } from '../components/JobForm';
import { JobCard } from '../components/JobCard';
import type { Job } from '../types';

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => ({
    profile: {
      uid: 'current-user',
      name: 'Alex Worker',
      email: 'alex@example.com',
      role: 'admin',
      status: 'active',
      createdAt: null,
      updatedAt: null,
    },
  }),
}));

vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));

const REASON_LABEL = 'Reason for deadline change';

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    name: 'Event badges',
    customer: 'Receiver',
    quantity: 12,
    dueDate: new Date('2099-06-15T23:59:59'),
    status: 'pending',
    category: 'manufacturing',
    isAwf: false,
    createdByUid: 'creator',
    createdByName: 'Creator',
    createdByEmail: 'creator@example.com',
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    assignedByUid: '',
    assignedByName: '',
    assignedAt: null,
    collaborators: [],
    collaboratorUids: [],
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

function renderForm(
  onSubmit = vi.fn(async (_values: JobFormValues) => undefined),
  initial?: Job,
) {
  render(
    <JobForm
      initial={initial}
      submitLabel={initial ? 'Save changes' : 'Add job'}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  );
  return onSubmit;
}

async function changeDeadline(user: ReturnType<typeof userEvent.setup>, value: string) {
  const due = screen.getByLabelText('Deadline');
  await user.clear(due);
  await user.type(due, value);
}

describe('JobForm deadline-change reason field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is hidden until the deadline lands on a different calendar day', async () => {
    const user = userEvent.setup();
    renderForm(undefined, job());
    expect(screen.queryByLabelText(REASON_LABEL)).not.toBeInTheDocument();

    await changeDeadline(user, '2099-07-20');
    expect(screen.getByLabelText(REASON_LABEL)).toBeInTheDocument();
    expect(screen.getByText('Required when the due date changes')).toBeInTheDocument();
  });

  it('disappears again when the original day is re-selected', async () => {
    const user = userEvent.setup();
    renderForm(undefined, job());

    await changeDeadline(user, '2099-07-20');
    expect(screen.getByLabelText(REASON_LABEL)).toBeInTheDocument();

    await changeDeadline(user, '2099-06-15');
    expect(screen.queryByLabelText(REASON_LABEL)).not.toBeInTheDocument();
  });

  it('never appears while creating a new job', async () => {
    const user = userEvent.setup();
    renderForm();
    await changeDeadline(user, '2099-07-20');
    expect(screen.queryByLabelText(REASON_LABEL)).not.toBeInTheDocument();
  });

  it('blocks submission of a deadline change with no reason', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(undefined, job());

    await changeDeadline(user, '2099-07-20');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add a reason for changing the deadline.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only reason', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(undefined, job());

    await changeDeadline(user, '2099-07-20');
    await user.type(screen.getByLabelText(REASON_LABEL), '   ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add a reason for changing the deadline.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a trimmed reason alongside the new deadline', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(undefined, job());

    await changeDeadline(user, '2099-07-20');
    await user.type(screen.getByLabelText(REASON_LABEL), '  Client moved delivery  ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      dueDateChangeNote: 'Client moved delivery',
    });
    expect(onSubmit.mock.calls[0][0].dueDate.getFullYear()).toBe(2099);
    expect(onSubmit.mock.calls[0][0].dueDate.getMonth()).toBe(6); // July (0-indexed)
  });

  it('does not require a reason when other fields change but the day does not', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(undefined, job());

    await user.clear(screen.getByLabelText('Job Name'));
    await user.type(screen.getByLabelText('Job Name'), 'Renamed order');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].dueDateChangeNote).toBeUndefined();
    expect(screen.queryByLabelText(REASON_LABEL)).not.toBeInTheDocument();
  });
});

describe('JobCard deadline-change history row', () => {
  it('shows the latest reason in the expanded details', () => {
    render(<JobCard job={job({ dueDateChangeNote: 'Client moved delivery' })} />);
    expect(screen.getByText('Deadline changed')).toBeInTheDocument();
    expect(screen.getByText('Client moved delivery')).toBeInTheDocument();
  });

  it('omits the row for jobs without a deadline-change note (legacy safe)', () => {
    render(<JobCard job={job()} />);
    expect(screen.queryByText('Deadline changed')).not.toBeInTheDocument();
    // The rest of the card still renders.
    expect(screen.getByText('Event badges')).toBeInTheDocument();
  });
});
