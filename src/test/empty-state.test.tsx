import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../components/EmptyState';

describe('EmptyState', () => {
  it('exposes its title as a heading so the region is reachable', () => {
    render(<EmptyState icon={<span />} title="No Jobs In The Pipeline" subtitle="Create one." />);

    expect(
      screen.getByRole('heading', { name: 'No Jobs In The Pipeline' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Create one.')).toBeInTheDocument();
  });

  it('marks a danger-toned state as an alert', () => {
    render(<EmptyState icon={<span />} tone="danger" title="Unable to Load Jobs" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to Load Jobs');
    expect(screen.getByRole('heading', { name: 'Unable to Load Jobs' })).toBeInTheDocument();
  });
});
