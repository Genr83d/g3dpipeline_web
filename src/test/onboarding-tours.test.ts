import { describe, expect, it } from 'vitest';
import { placeTooltip } from '../onboarding/placement';
import { tutorialsForRole } from '../onboarding/tours';
import type { UserRole } from '../types';

const ROLES: UserRole[] = ['staff', 'awf', 'manager', 'admin'];

// Every source file, so a tour cannot point at an anchor nobody renders.
const sources = Object.values(
  import.meta.glob(['../**/*.tsx', '!../test/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
).join('\n');

function anchorsIn(selector: string): string[] {
  return [...selector.matchAll(/data-tour="([^"]+)"/g)].map((match) => match[1]);
}

describe('tour content', () => {
  it.each(ROLES)('every %s step points at an anchor the app renders', (role) => {
    for (const tutorial of tutorialsForRole(role)) {
      for (const step of tutorial.steps) {
        const selectors = [step.target, step.waitFor?.selector, step.within?.selector];
        for (const anchor of selectors.flatMap((selector) => (selector ? anchorsIn(selector) : []))) {
          const rendered =
            sources.includes(`data-tour="${anchor}"`) ||
            sources.includes(`'${anchor}'`) ||
            sources.includes(`tour: '${anchor}'`);
          expect(rendered, `${tutorial.id} › ${step.title} › ${anchor}`).toBe(true);
        }
      }
    }
  });

  it.each(ROLES)('every %s form step can find its way back to the step that opens it', (role) => {
    for (const tutorial of tutorialsForRole(role)) {
      tutorial.steps.forEach((step, index) => {
        if (step.within?.ifClosed !== 'back') return;
        const opener = tutorial.steps
          .slice(0, index)
          .some((earlier) => earlier.waitFor?.selector === step.within!.selector);
        expect(opener, `${tutorial.id} › ${step.title}`).toBe(true);
      });
    }
  });

  it('guides each role only to pages it can open', () => {
    const routes = (role: UserRole) =>
      tutorialsForRole(role).flatMap((tutorial) => tutorial.steps.map((step) => step.route ?? ''));
    expect(routes('awf')).not.toContain('/inventory');
    expect(routes('awf')).not.toContain('/maintenance');
    expect(routes('staff')).not.toContain('/reports');
    expect(routes('manager')).not.toContain('/settings/users');
    expect(routes('manager')).toContain('/reports');
    expect(routes('admin')).toContain('/settings/users');
  });

  it('covers hazards for everyone and reports for management', () => {
    for (const role of ROLES) {
      const ids = tutorialsForRole(role).map((tutorial) => tutorial.id);
      expect(ids).toContain('hazards');
      expect(ids.includes('operations-report')).toBe(role === 'manager' || role === 'admin');
    }
  });

  it('no longer describes buttons the app does not have', () => {
    const text = ROLES.flatMap((role) =>
      tutorialsForRole(role).flatMap((tutorial) => tutorial.steps.map((step) => step.body)),
    ).join('\n');
    expect(text).not.toMatch(/Update repair process progress/);
    expect(text).not.toMatch(/Repair job type adds a process list/);
  });
});

describe('placeTooltip', () => {
  const viewport = { width: 1280, height: 800 };
  const tooltip = { width: 360, height: 240 };

  it('centres without a target', () => {
    expect(placeTooltip(null, tooltip, viewport)).toEqual({ top: 280, left: 460 });
  });

  it('goes below a target near the top', () => {
    expect(placeTooltip({ top: 40, left: 600, width: 100, height: 40 }, tooltip, viewport)).toEqual({
      top: 94,
      left: 470,
    });
  });

  it('goes above a target near the bottom', () => {
    const place = placeTooltip({ top: 700, left: 600, width: 100, height: 40 }, tooltip, viewport);
    expect(place.top).toBe(700 - 14 - 240);
  });

  it('goes beside a tall target, such as a form section', () => {
    const place = placeTooltip({ top: 100, left: 200, width: 600, height: 600 }, tooltip, viewport);
    expect(place.left).toBe(814);
    expect(place.top).toBe(280);
  });

  it('stays on screen beside a target at the edge', () => {
    const place = placeTooltip({ top: 40, left: 1240, width: 30, height: 30 }, tooltip, viewport);
    expect(place.left).toBe(1280 - 360 - 12);
  });

  it('docks opposite a target that fills a phone screen', () => {
    const phone = { width: 390, height: 844 };
    const card = { width: 366, height: 280 };
    expect(placeTooltip({ top: 200, left: 12, width: 366, height: 600 }, card, phone).top).toBe(12);
    expect(placeTooltip({ top: 60, left: 12, width: 366, height: 600 }, card, phone).top).toBe(
      844 - 280 - 12,
    );
  });
});
