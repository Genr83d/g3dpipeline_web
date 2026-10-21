import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import { OnboardingProvider, useOnboarding } from '../onboarding/OnboardingProvider';
import type { TutorialId } from '../onboarding/tours';

/** The guided tour follows what the user does: it waits for the Add job form
 *  to open, points into it, goes back if it closes, and steps aside for a
 *  dialog it is not about. */
const testState = vi.hoisted(() => ({ auth: null as unknown as AuthState }));

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => testState.auth,
}));

beforeEach(() => {
  localStorage.clear();
  // The application tour has been seen, so it does not start by itself.
  localStorage.setItem(
    'g3d-onboarding:v1:user-1:staff:application',
    JSON.stringify({ step: 0, complete: true }),
  );
  testState.auth = {
    authUser: { uid: 'user-1', email: 'alex@example.com' } as AuthState['authUser'],
    profile: {
      uid: 'user-1',
      name: 'Alex Worker',
      email: 'alex@example.com',
      role: 'staff',
      status: 'active',
      createdAt: null,
      updatedAt: null,
    },
    firstName: 'Alex',
    profileError: false,
    isActive: true,
    isAdmin: false,
    isManagerOrAdmin: false,
    actor: null,
    assigner: null,
  };
});

/** Stands in for the Jobs page: the same tour anchors, a form that opens and
 *  closes like the real Add job dialog, and an unrelated dialog. */
function FakeJobsPage() {
  const { startTutorial } = useOnboarding();
  const [adding, setAdding] = useState(false);
  const [other, setOther] = useState(false);
  return (
    <div>
      <a data-tour="nav-jobs" href="/">Jobs</a>
      <div data-tour="job-board">
        <article data-tour="job-card">Bracket set</article>
      </div>
      <button data-tour="add-job" onClick={() => setAdding(true)}>
        Add job
      </button>
      <button onClick={() => setOther(true)}>Open another dialog</button>
      {(['create-job', 'work-job'] as TutorialId[]).map((id) => (
        <button key={id} onClick={() => startTutorial(id)}>
          Start {id}
        </button>
      ))}
      {adding && (
        <div role="dialog" aria-modal="true" aria-label="Add job">
          <form data-tour="job-form">
            <div data-tour="job-form-basics">
              <input aria-label="Job Name" />
            </div>
            <div data-tour="job-form-sections">
              <textarea aria-label="Sections" />
            </div>
            <fieldset data-tour="job-form-tags" />
            <div data-tour="job-form-actions">
              <button type="button" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button type="button" onClick={() => setAdding(false)}>
                Save job
              </button>
            </div>
          </form>
        </div>
      )}
      {other && (
        <div role="dialog" aria-modal="true" aria-label="Other">
          <button onClick={() => setOther(false)}>Close other</button>
        </div>
      )}
    </div>
  );
}

function renderTour() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <OnboardingProvider>
        <FakeJobsPage />
      </OnboardingProvider>
    </MemoryRouter>,
  );
}

const tooltip = () => screen.getByTestId('onboarding-tooltip');

async function expectStep(title: string, position: string) {
  // The tour looks at the page every 150ms, so give it a few looks.
  expect(await screen.findByRole('heading', { name: title }, { timeout: 2000 })).toBeInTheDocument();
  expect(tooltip()).toHaveTextContent(position);
}

async function openTheForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Start create-job' }));
  await expectStep('Open Jobs', 'Step 1 of 7');
  await user.click(within(tooltip()).getByRole('button', { name: 'Next' }));
  await expectStep('Choose Add job', 'Step 2 of 7');
  await user.click(screen.getByRole('button', { name: 'Add job' }));
  await expectStep('Describe the job', 'Step 3 of 7');
}

describe('Create a job follows the real form', () => {
  it('waits for Add job instead of offering Next', async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(screen.getByRole('button', { name: 'Start create-job' }));
    await user.click(within(await screen.findByTestId('onboarding-tooltip')).getByRole('button', { name: 'Next' }));
    await expectStep('Choose Add job', 'Step 2 of 7');

    expect(within(tooltip()).queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByTestId('onboarding-waiting')).toHaveTextContent('Click Add job to continue');

    // The arrow key cannot skip past it either.
    await user.keyboard('{ArrowRight}');
    expect(tooltip()).toHaveTextContent('Step 2 of 7');
  });

  it('moves into the form when Add job is clicked and walks through it', async () => {
    const user = userEvent.setup();
    renderTour();
    await openTheForm(user);

    // The form stays usable: the tour does not pause for the form it explains.
    expect(screen.queryByTestId('onboarding-paused')).not.toBeInTheDocument();

    await user.click(within(tooltip()).getByRole('button', { name: 'Next' }));
    await expectStep('Split it into sections', 'Step 4 of 7');
    await user.click(within(tooltip()).getByRole('button', { name: 'Next' }));
    await expectStep('Tag what it uses', 'Step 5 of 7');
    await user.click(within(tooltip()).getByRole('button', { name: 'Next' }));
    await expectStep('Save the job', 'Step 6 of 7');
    // Next would leave the form open behind the last step, so it waits.
    expect(screen.getByTestId('onboarding-waiting')).toHaveTextContent('Save or cancel to continue');

    // Saving closes the form, which finishes the form part of the guide.
    await user.click(screen.getByRole('button', { name: 'Save job' }));
    await expectStep('Find it on the board', 'Step 7 of 7');
  });

  it('typing in the form does not move the tour, and Escape is left to the form', async () => {
    const user = userEvent.setup();
    renderTour();
    await openTheForm(user);

    await user.type(screen.getByLabelText('Job Name'), 'Bracket{ArrowLeft}{ArrowRight}{ArrowLeft}');
    expect(tooltip()).toHaveTextContent('Step 3 of 7');

    await user.keyboard('{Escape}');
    expect(tooltip()).toHaveTextContent('Step 3 of 7');
  });

  it('closing the form part-way goes back to Choose Add job', async () => {
    const user = userEvent.setup();
    renderTour();
    await openTheForm(user);
    await user.click(within(tooltip()).getByRole('button', { name: 'Next' }));
    await expectStep('Split it into sections', 'Step 4 of 7');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await expectStep('Choose Add job', 'Step 2 of 7');
    expect(screen.getByTestId('onboarding-waiting')).toBeInTheDocument();

    // Opening it again picks the guide back up.
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    await expectStep('Describe the job', 'Step 3 of 7');
  });

  it('going Back to Choose Add job with the form open offers Next, not a loop', async () => {
    const user = userEvent.setup();
    renderTour();
    await openTheForm(user);

    await user.click(within(tooltip()).getByRole('button', { name: 'Back' }));
    await expectStep('Choose Add job', 'Step 2 of 7');
    // Give the tour several looks: it must stay put.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(tooltip()).toHaveTextContent('Step 2 of 7');
    expect(screen.queryByTestId('onboarding-waiting')).not.toBeInTheDocument();

    await user.click(within(tooltip()).getByRole('button', { name: 'Next' }));
    await expectStep('Describe the job', 'Step 3 of 7');
  });
});

describe('dialogs a step is not about', () => {
  it('pause the tour so the dialog can be used, and resume it on close', async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(screen.getByRole('button', { name: 'Start work-job' }));
    await expectStep('Choose a job', 'Step 1 of 4');

    await user.click(screen.getByRole('button', { name: 'Open another dialog' }));
    expect(await screen.findByTestId('onboarding-paused', {}, { timeout: 2000 })).toHaveTextContent(
      'Start and complete work is paused while this window is open.',
    );
    expect(screen.queryByTestId('onboarding-tooltip')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close other' }));
    await expectStep('Choose a job', 'Step 1 of 4');
    expect(screen.queryByTestId('onboarding-paused')).not.toBeInTheDocument();
  });

  it('can still be exited while paused', async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(screen.getByRole('button', { name: 'Start work-job' }));
    await expectStep('Choose a job', 'Step 1 of 4');
    await user.click(screen.getByRole('button', { name: 'Open another dialog' }));
    const paused = await screen.findByTestId('onboarding-paused', {}, { timeout: 2000 });

    await user.click(within(paused).getByRole('button', { name: 'Exit tutorial' }));
    expect(screen.queryByTestId('onboarding-paused')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('g3d-onboarding:v1:user-1:staff:work-job')!)).toEqual({
      step: 0,
      complete: false,
    });
  });
});

describe('keyboard', () => {
  it('arrow keys still step through a tour when nothing is being typed', async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(screen.getByRole('button', { name: 'Start work-job' }));
    await expectStep('Choose a job', 'Step 1 of 4');

    await user.keyboard('{ArrowRight}');
    await expectStep('Start the work', 'Step 2 of 4');
    await user.keyboard('{ArrowLeft}');
    await expectStep('Choose a job', 'Step 1 of 4');
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('onboarding-tooltip')).not.toBeInTheDocument();
  });
});
