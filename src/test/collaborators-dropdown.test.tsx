import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job, UserRole } from '../types';
import { JobCard } from '../components/JobCard';
import { parseJob } from '../services/jobService';

const testState = vi.hoisted(() => ({ auth: null as unknown }));

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => testState.auth,
}));

vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));

vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../services/inventoryService', () => ({ inventoryCol: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  addDoc: vi.fn(),
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

function setRole(role: UserRole, uid = 'current-user') {
  testState.auth = {
    profile: {
      uid,
      name: 'Alex Worker',
      email: 'alex@example.com',
      role,
      status: 'active',
      createdAt: null,
      updatedAt: null,
    },
    isAdmin: role === 'admin',
    isManagerOrAdmin: role === 'manager' || role === 'admin',
  };
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    name: 'Event badges',
    customer: 'Receiver',
    quantity: 10,
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
    ...overrides,
  };
}

const team = [
  { uid: 'u1', name: 'Sam Carter', role: 'staff' as const },
  { uid: 'u2', name: 'Jordan Diaz', role: 'awf' as const },
  { uid: 'u3', name: '', role: 'manager' as const },
];

beforeEach(() => setRole('staff'));

describe('collaborator dropdown', () => {
  it('shows a collapsed count row and hides names until expanded', () => {
    render(
      <JobCard job={job({ collaborators: team, collaboratorUids: ['u1', 'u2', 'u3'] })} />,
    );
    expect(screen.getByRole('button', { name: /Collaborators \(3\)/ })).toBeInTheDocument();
    expect(screen.queryByText('Sam Carter')).not.toBeInTheDocument();
    expect(screen.queryByText('Jordan Diaz')).not.toBeInTheDocument();
  });

  it('expands to a vertical list with initials avatar, names, and role labels', async () => {
    const user = userEvent.setup();
    render(
      <JobCard job={job({ collaborators: team, collaboratorUids: ['u1', 'u2', 'u3'] })} />,
    );
    await user.click(screen.getByRole('button', { name: /Collaborators \(3\)/ }));
    const list = screen.getByTestId('job-collaborators-job-1');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Sam Carter');
    expect(items[0]).toHaveTextContent('Staff');
    expect(items[0]).toHaveTextContent('S');
    expect(items[1]).toHaveTextContent('Jordan Diaz');
    expect(items[1]).toHaveTextContent('AWF Staff');
    // Missing name falls back to "Unknown collaborator" with a "?" avatar.
    expect(items[2]).toHaveTextContent('Unknown collaborator');
    expect(items[2]).toHaveTextContent('Manager');
    expect(items[2]).toHaveTextContent('?');
  });

  it('never renders email addresses or other private contact details', async () => {
    const user = userEvent.setup();
    render(
      <JobCard
        job={job({
          collaborators: team,
          collaboratorUids: ['u1', 'u2', 'u3'],
          createdByEmail: 'creator@example.com',
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Collaborators \(3\)/ }));
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('shows Unassigned when a job has no collaborators', () => {
    render(<JobCard job={job()} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.queryByText(/Collaborators \(/)).not.toBeInTheDocument();
  });

  it('surfaces legacy single-assignee jobs through the collaborator fallback', async () => {
    const user = userEvent.setup();
    const legacy = parseJob('legacy-1', {
      name: 'Legacy job',
      status: 'started',
      assignedToUid: 'legacy-user',
      assignedToName: 'Old Assignee',
      assignedToRole: 'staff',
    });
    render(<JobCard job={legacy} />);
    await user.click(screen.getByRole('button', { name: /Collaborators \(1\)/ }));
    const list = screen.getByTestId('job-collaborators-legacy-1');
    expect(list).toHaveTextContent('Old Assignee');
    expect(list).toHaveTextContent('Staff');
  });

  it('hides the quantity row for Software development jobs', () => {
    render(<JobCard job={job({ category: 'softwareDevelopment' })} />);
    expect(screen.queryByText('Quantity')).not.toBeInTheDocument();
    expect(screen.queryByText(/unit/)).not.toBeInTheDocument();
  });

  it('keeps delete inaccessible for non-admin users', () => {
    setRole('manager');
    const onDelete = vi.fn();
    render(<JobCard job={job()} onDelete={onDelete} />);
    expect(screen.queryByRole('button', { name: 'Delete job' })).not.toBeInTheDocument();
  });
});
