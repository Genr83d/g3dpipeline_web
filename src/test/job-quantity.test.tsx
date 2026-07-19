import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampJobQuantity,
  JOB_CATEGORY_QUANTITY_CONFIG,
  jobQuantityConfig,
  normalizeJobQuantity,
  validateJobQuantity,
} from '../lib/jobCategories';
import { JobForm, type JobFormValues } from '../components/JobForm';
import type { JobCategory } from '../types';

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

describe('job category quantity config', () => {
  it('drives physical categories with Quantity, min 1, max 999', () => {
    for (const category of ['manufacturing', 'repair', 'miscellaneous'] as JobCategory[]) {
      expect(jobQuantityConfig(category)).toEqual({
        usesQuantity: true,
        quantityLabel: 'Quantity',
        quantityRequired: true,
        minimumQuantity: 1,
        maximumQuantity: 999,
      });
    }
  });

  it('gives Design "Number of deliverables" with max 99', () => {
    expect(jobQuantityConfig('design')).toEqual({
      usesQuantity: true,
      quantityLabel: 'Number of deliverables',
      quantityRequired: true,
      minimumQuantity: 1,
      maximumQuantity: 99,
    });
  });

  it('disables quantity for Software development and normalizes to 1', () => {
    const config = jobQuantityConfig('softwareDevelopment');
    expect(config.usesQuantity).toBe(false);
    expect(config.quantityRequired).toBe(false);
    expect(normalizeJobQuantity('softwareDevelopment', 400)).toBe(1);
    expect(normalizeJobQuantity('manufacturing', 400)).toBe(400);
    expect(Object.keys(JOB_CATEGORY_QUANTITY_CONFIG)).toHaveLength(5);
  });

  it('rejects blank, zero, negative, decimal, and non-numeric quantities', () => {
    expect(validateJobQuantity('manufacturing', '')).toBe('Quantity is required.');
    expect(validateJobQuantity('manufacturing', '   ')).toBe('Quantity is required.');
    expect(validateJobQuantity('manufacturing', 0)).toBe('Quantity must be at least 1.');
    expect(validateJobQuantity('manufacturing', -3)).toBe('Quantity must be at least 1.');
    expect(validateJobQuantity('manufacturing', 2.5)).toBe('Quantity must be a whole number.');
    expect(validateJobQuantity('manufacturing', 'abc')).toBe('Quantity must be a whole number.');
    expect(validateJobQuantity('design', '')).toBe('Number of deliverables is required.');
  });

  it('enforces category maximums but allows 100-unit physical batches', () => {
    expect(validateJobQuantity('manufacturing', 100)).toBeNull();
    expect(validateJobQuantity('manufacturing', 999)).toBeNull();
    expect(validateJobQuantity('manufacturing', 1000)).toBe('Quantity cannot exceed 999.');
    expect(validateJobQuantity('design', 99)).toBeNull();
    expect(validateJobQuantity('design', 100)).toBe('Number of deliverables cannot exceed 99.');
    expect(validateJobQuantity('softwareDevelopment', 1)).toBeNull();
    expect(validateJobQuantity('softwareDevelopment', 2)).not.toBeNull();
  });

  it('clamps stepper values into the configured range', () => {
    expect(clampJobQuantity('manufacturing', 0)).toBe(1);
    expect(clampJobQuantity('manufacturing', 1000)).toBe(999);
    expect(clampJobQuantity('design', 500)).toBe(99);
    expect(clampJobQuantity('design', Number.NaN)).toBe(1);
  });
});

function renderForm(onSubmit = vi.fn(async (_values: JobFormValues) => undefined)) {
  render(
    <JobForm submitLabel="Add job" onSubmit={onSubmit} onCancel={vi.fn()} />,
  );
  return onSubmit;
}

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Job Name'), 'Pin order');
  await user.type(screen.getByLabelText('Name of Receiver'), 'Receiver');
  const due = screen.getByLabelText('Deadline');
  await user.clear(due);
  await user.type(due, '2099-06-15');
}

describe('JobForm quantity behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the configured label, max hint, and stepper controls', () => {
    renderForm();
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
    expect(screen.getByText('Max 999')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeInTheDocument();
  });

  it('uses the Design label and max after switching category', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByLabelText('Job Type'), 'design');
    expect(screen.getByLabelText('Number of deliverables')).toBeInTheDocument();
    expect(screen.getByText('Max 99')).toBeInTheDocument();
  });

  it('hides the quantity field for Software development and submits quantity 1', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();
    await user.selectOptions(screen.getByLabelText('Job Type'), 'softwareDevelopment');
    expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      category: 'softwareDevelopment',
      quantity: 1,
    });
  });

  it('re-shows a required, labelled quantity when leaving Software development', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();
    await user.selectOptions(screen.getByLabelText('Job Type'), 'softwareDevelopment');
    await user.selectOptions(screen.getByLabelText('Job Type'), 'design');
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Number of deliverables is required.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects zero, negative, decimal, over-limit, and non-numeric input without coercing', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();
    await fillBasics(user);
    const qty = screen.getByLabelText('Quantity');
    const submit = screen.getByRole('button', { name: 'Add job' });

    for (const [value, message] of [
      ['0', 'Quantity must be at least 1.'],
      ['-4', 'Quantity must be at least 1.'],
      ['2.5', 'Quantity must be a whole number.'],
      ['1000', 'Quantity cannot exceed 999.'],
    ] as const) {
      await user.clear(qty);
      await user.type(qty, value);
      await user.click(submit);
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
    }
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a 100-unit manufacturing batch', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();
    await fillBasics(user);
    const qty = screen.getByLabelText('Quantity');
    await user.clear(qty);
    await user.type(qty, '100');
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ quantity: 100 });
  });

  it('disables increase at the maximum and clamps rapid increments', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByLabelText('Job Type'), 'design');
    const qty = screen.getByLabelText('Number of deliverables');
    await user.clear(qty);
    await user.type(qty, '97');
    const increase = screen.getByRole('button', {
      name: 'Increase number of deliverables',
    });
    // Rapid repeated clicks must never push the value past the maximum.
    for (let i = 0; i < 10 && !(increase as HTMLButtonElement).disabled; i += 1) {
      await user.click(increase);
    }
    expect(qty).toHaveValue(99);
    expect(increase).toBeDisabled();
  });

  it('disables decrease at the minimum', async () => {
    const user = userEvent.setup();
    renderForm();
    const qty = screen.getByLabelText('Quantity');
    await user.clear(qty);
    await user.type(qty, '1');
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    await user.clear(qty);
    await user.type(qty, '2');
    const decrease = screen.getByRole('button', { name: 'Decrease quantity' });
    expect(decrease).toBeEnabled();
    await user.click(decrease);
    expect(qty).toHaveValue(1);
    expect(decrease).toBeDisabled();
  });
});
