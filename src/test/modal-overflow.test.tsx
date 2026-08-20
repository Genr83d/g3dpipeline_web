import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../components/Modal';

vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));

function scrollRegion(): HTMLElement {
  return screen.getByRole('dialog').lastElementChild as HTMLElement;
}

/** The Add/Edit Job form is tall enough to outgrow a short viewport. The
 *  overlay is position: fixed, so an uncapped panel would spill past both
 *  edges with nothing to scroll — the panel has to cap itself and scroll
 *  inside instead. */
describe('modal overflow', () => {
  it('caps the panel to the viewport and scrolls its body', () => {
    render(
      <Modal open title="Edit job" onClose={vi.fn()}>
        <p>Job sections</p>
        <button type="button">Save changes</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(dialog.className).toContain('flex-col');

    const body = scrollRegion();
    expect(body.className).toContain('overflow-y-auto');
    // min-h-0 is what actually lets a flex child shrink enough to scroll.
    expect(body.className).toContain('min-h-0');
    expect(within(body).getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('keeps the title and close button pinned outside the scrolling body', () => {
    render(
      <Modal open title="Edit job" onClose={vi.fn()}>
        <p>Job sections</p>
      </Modal>,
    );

    const body = scrollRegion();
    expect(within(body).queryByRole('heading', { name: 'Edit job' })).not.toBeInTheDocument();
    expect(within(body).queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit job' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });
});
