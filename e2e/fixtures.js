// Every journey's page: an uncaught error or console.error in the app fails the journey even if its
// assertions passed, the way a traceback in the server log fails an omniarr journey.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
    await use(page);
    expect(errors, 'errors in the page').toEqual([]);
  },
});

export { expect };
