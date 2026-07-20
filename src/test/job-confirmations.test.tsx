import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  JOB_DELETE_WARNING,
  JOB_DOWNSTREAM_WARNING,
  JobConfirmDialog,
  JobConfirmSummary,
} from '../components/JobConfirmDialog';

vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));

function deferred() {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderStartDialog({
  onConfirm = vi.fn(async () => undefined),
  onCancel = vi.fn(),
  open = true,
}: {
  onConfirm?: () => Promise<void>;
  onCancel?: () => void;
  open?: boolean;
} = {}) {
  render(
    <JobConfirmDialog
      open={open}
      title="Start Job?"
      confirmLabel="Start Job"
      busyLabel="Updating…"
      warning={JOB_DOWNSTREAM_WARNING}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <JobConfirmSummary jobName="Event badges" currentStatus="Pending" targetStatus="In Progress" />
    </JobConfirmDialog>,
  );
  return { onConfirm, onCancel };
}

beforeEach(() => vi.clearAllMocks());

describe('start/complete confirmation dialog', () => {
  it('shows title, job name, statuses, and downstream warning', () => {
    renderStartDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Start Job?');
    expect(dialog).toHaveTextContent('Event badges');
    expect(dialog).toHaveTextContent('Pending');
    expect(dialog).toHaveTextContent('In Progress');
    expect(dialog).toHaveTextContent(JOB_DOWNSTREAM_WARNING);
  });

  it('falls back to a safe untitled-job label', () => {
    render(
      <JobConfirmDialog
        open
        title="Start Job?"
        confirmLabel="Start Job"
        busyLabel="Updating…"
        warning={JOB_DOWNSTREAM_WARNING}
        onCancel={vi.fn()}
        onConfirm={vi.fn(async () => undefined)}
      >
        <JobConfirmSummary jobName="   " currentStatus="Pending" targetStatus="In Progress" />
      </JobConfirmDialog>,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Untitled job');
  });

  it('makes no request when cancelled', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderStartDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('resolves a successful confirmation with one request', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderStartDialog();
    await user.click(screen.getByRole('button', { name: 'Start Job' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('shows Updating…, blocks duplicates and dismissal while processing', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onConfirm = vi.fn(() => pending.promise);
    const onCancel = vi.fn();
    renderStartDialog({ onConfirm, onCancel });

    const confirm = screen.getByRole('button', { name: 'Start Job' });
    await user.click(confirm);
    const busyButton = await screen.findByRole('button', { name: 'Updating…' });
    expect(busyButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    // Escape and the close control must not dismiss while processing.
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Backend success resolves onConfirm; the caller then closes the dialog,
    // so the dialog itself stays busy and never re-enables mid-flight.
    pending.resolve();
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('keeps the dialog open with a retryable error on failure', async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Only started jobs can be completed.'))
      .mockResolvedValueOnce(undefined);
    renderStartDialog({ onConfirm });

    await user.click(screen.getByRole('button', { name: 'Start Job' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only started jobs can be completed.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start Job' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
  });
});

describe('delete confirmation dialog', () => {
  function renderDeleteDialog(onConfirm: () => Promise<void> = vi.fn(async () => undefined)) {
    render(
      <JobConfirmDialog
        open
        title="Delete Job?"
        confirmLabel="Delete Job"
        busyLabel="Deleting…"
        destructive
        warning={JOB_DELETE_WARNING}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      >
        <JobConfirmSummary jobName="Event badges" jobRef="job-1" />
      </JobConfirmDialog>,
    );
    return onConfirm;
  }

  it('shows the job name, reference, destructive styling, and warning', () => {
    renderDeleteDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Delete Job?');
    expect(dialog).toHaveTextContent('Event badges');
    expect(dialog).toHaveTextContent('Job ID: job-1');
    expect(dialog).toHaveTextContent(JOB_DELETE_WARNING);
    expect(within(dialog).getByRole('button', { name: 'Delete Job' }).className).toContain(
      'btn-danger',
    );
  });

  it('deletes once even under duplicate clicks and shows Deleting…', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onConfirm = renderDeleteDialog(vi.fn(() => pending.promise));

    const del = screen.getByRole('button', { name: 'Delete Job' });
    await user.click(del);
    await user.click(await screen.findByRole('button', { name: 'Deleting…' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    pending.resolve();
  });

  it('surfaces a retryable deletion error', async () => {
    const user = userEvent.setup();
    const onConfirm = renderDeleteDialog(
      vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('Network unavailable.')),
    );
    await user.click(screen.getByRole('button', { name: 'Delete Job' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable.');
    expect(screen.getByRole('button', { name: 'Delete Job' })).toBeEnabled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
