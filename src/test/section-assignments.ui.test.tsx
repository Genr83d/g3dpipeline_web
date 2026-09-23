import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUser, Job, JobSection, UserRole } from '../types';
import { AssignJobModal } from '../components/AssignJobModal';
import { SECTION_ASSIGNMENT_REQUIRED_MESSAGE } from '../lib/jobSections';

const testState = vi.hoisted(() => ({ role: 'manager' as UserRole }));

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => ({
    profile: {
      uid: 'boss-1',
      name: 'Boss',
      email: 'boss@example.com',
      role: testState.role,
      status: 'active',
      createdAt: null,
      updatedAt: null,
    },
  }),
}));

const ELIGIBLE: AppUser[] = [
  {
    uid: 'worker-1',
    name: 'Worker One',
    email: 'one@example.com',
    role: 'staff',
    status: 'active',
    createdAt: null,
    updatedAt: null,
  },
  {
    uid: 'worker-2',
    name: 'Worker Two',
    email: 'two@example.com',
    role: 'staff',
    status: 'active',
    createdAt: null,
    updatedAt: null,
  },
];

vi.mock('../services/userService', () => ({
  watchAssignableUsers: (
    _role: UserRole,
    next: (users: AppUser[]) => void,
  ) => {
    next(ELIGIBLE);
    return () => undefined;
  },
}));

vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../services/inventoryService', () => ({ inventoryCol: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  deleteField: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
}));

const CHAIR_SECTIONS: JobSection[] = [
  { name: 'Design', progress: 60, collaboratorUid: 'worker-1' },
  { name: 'Routing', progress: 30, collaboratorUid: 'worker-2' },
  { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-2' },
];

function job(overrides: Partial<Job> = {}): Job {
  return {
    tags: [],
    id: 'job-1',
    orderNumber: 'G3D-JOB-1',
    name: 'Chairs',
    customer: 'Receiver',
    quantity: 10,
    completedQuantity: 0,
    dueDate: new Date('2099-06-15T23:59:59'),
    status: 'started',
    category: 'manufacturing',
    repairProcesses: CHAIR_SECTIONS,
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
    collaborators: [
      { uid: 'worker-1', name: 'Worker One', role: 'staff' },
      { uid: 'worker-2', name: 'Worker Two', role: 'staff' },
    ],
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

function renderModal(overrides: Partial<Job> = {}, onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <AssignJobModal
      job={job(overrides)}
      onSave={onSave}
      onClear={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return onSave;
}

beforeEach(() => {
  testState.role = 'manager';
});

describe('section assignments in the collaborator sheet', () => {
  it('offers one owner picker per section, preselected from the job', () => {
    renderModal();

    expect(screen.getByLabelText('Design')).toHaveValue('worker-1');
    expect(screen.getByLabelText('Routing')).toHaveValue('worker-2');
    expect(screen.getByLabelText('Metalworking')).toHaveValue('worker-2');
  });

  it('saves the collaborator list together with the section owners', async () => {
    const onSave = renderModal();

    await userEvent.selectOptions(screen.getByLabelText('Metalworking'), 'worker-1');
    await userEvent.click(screen.getByRole('button', { name: 'Save Collaborators' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1' }),
      [
        { uid: 'worker-1', name: 'Worker One', role: 'staff' },
        { uid: 'worker-2', name: 'Worker Two', role: 'staff' },
      ],
      [
        { name: 'Design', progress: 60, collaboratorUid: 'worker-1' },
        { name: 'Routing', progress: 30, collaboratorUid: 'worker-2' },
        { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-1' },
      ],
    );
  });

  it('unassigns a removed collaborator’s sections and blocks the save until reassigned', async () => {
    const onSave = renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Worker Two' }));
    expect(screen.getByLabelText('Routing')).toHaveValue('');
    expect(screen.getByLabelText('Metalworking')).toHaveValue('');

    await userEvent.click(screen.getByRole('button', { name: 'Save Collaborators' }));
    expect(screen.getByRole('alert')).toHaveTextContent(SECTION_ASSIGNMENT_REQUIRED_MESSAGE);
    expect(onSave).not.toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText('Routing'), 'worker-1');
    await userEvent.selectOptions(screen.getByLabelText('Metalworking'), 'worker-1');
    await userEvent.click(screen.getByRole('button', { name: 'Save Collaborators' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1' }),
      [{ uid: 'worker-1', name: 'Worker One', role: 'staff' }],
      [
        { name: 'Design', progress: 60, collaboratorUid: 'worker-1' },
        { name: 'Routing', progress: 30, collaboratorUid: 'worker-1' },
        { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-1' },
      ],
    );
  });

  it('labels the group “Repair processes” on a repair job', () => {
    renderModal({ category: 'repair' });
    expect(screen.getByText('Repair processes')).toBeInTheDocument();
  });
});
