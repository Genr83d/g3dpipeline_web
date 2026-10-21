import { test, expect, storageStatePath, waitForWorkspace } from '../support/fixtures';
import { tutorialsForRole } from '../../src/onboarding/tours';
import type { UserRole } from '../../src/types';

/** P2. Every guide in Help, for every role, walked step by step in the real
 *  app: each step that points at something must find it on screen. This is
 *  what keeps the guides honest as the screens change. */

const ROLES: UserRole[] = ['staff', 'awf', 'manager', 'admin'];

for (const role of ROLES) {
  test.describe(`${role} guides`, () => {
    test.use({ storageState: storageStatePath(role), suppressOnboarding: false });

    for (const tutorial of tutorialsForRole(role)) {
      test(`${tutorial.title} points at real controls`, async ({ page }) => {
        // Walking a dozen pages takes a while on a cold emulator.
        test.slow();
        // From the header link, as people do: AWF accounts are sent to Jobs
        // on arrival, so a deep link to Help would not stick.
        await page.goto('/');
        await waitForWorkspace(page);
        const autoTour = page.getByTestId('onboarding-tooltip');
        await expect(autoTour).toBeVisible();
        await autoTour.getByRole('button', { name: 'Exit tutorial' }).click();
        await expect(autoTour).toBeHidden();
        await page.getByRole('link', { name: 'Help and walkthroughs' }).click();

        const launcher =
          tutorial.id === 'application' ? 'Restart application walkthrough' : tutorial.title;
        await page.getByRole('button', { name: new RegExp(`^${launcher}`) }).click();

        const tour = page.getByTestId('onboarding-tooltip');
        for (const [index, step] of tutorial.steps.entries()) {
          const where = `${tutorial.id} step ${index + 1}: ${step.title}`;
          await expect(tour, where).toContainText(`Step ${index + 1} of ${tutorial.steps.length}`);
          await expect(tour.getByRole('heading', { name: step.title }), where).toBeVisible();
          if (step.target) {
            await expect(page.getByTestId('onboarding-highlight'), where).toBeVisible();
          }

          if (step.waitFor) {
            // Do what the step asks: click the control it points at.
            await page.locator(step.target!).first().click();
          } else if (step.within?.hint) {
            // Leave the form without saving anything.
            await page.getByRole('dialog', { name: 'Add job', exact: true }).getByRole('button', { name: 'Cancel' }).click();
          } else {
            await tour.getByRole('button', { name: index === tutorial.steps.length - 1 ? 'Finish' : 'Next' }).click();
          }
        }
        await expect(page.getByTestId('onboarding-tooltip')).toBeHidden();
      });
    }
  });
}
