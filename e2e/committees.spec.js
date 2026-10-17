// The committees page: the recommended order before any save, and what a real save marks as done.
import { test, expect } from './fixtures.js';
import fs from 'node:fs';

const BETA = 'test/fixtures/beta-update6.sav';

test('without a save the ten committees are listed in order and the first is next', async ({ page }) => {
  await page.goto('#/committees');
  await expect(page.getByRole('heading', { name: 'Committees', level: 1 })).toBeVisible();
  const committees = page.getByRole('list').first().getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(committees).toHaveCount(10);
  await expect(committees.first().getByRole('heading')).toHaveText('Habitat Care');
  await expect(page.getByRole('listitem', { name: 'Habitat Care' }).getByText('Do next')).toBeVisible();
  await expect(page.getByText('Import a save to see which committees are already launched')).toBeVisible();
});

test('a member links to its profession page', async ({ page }) => {
  await page.goto('#/committees');
  await page.getByRole('listitem', { name: 'Deck Operations' }).getByRole('link', { name: /Door Jammer/ }).click();
  await expect(page).toHaveURL(/#\/p\//);
  await expect(page.getByRole('heading', { name: /Door Jammer/ })).toBeVisible();
});

test('importing the save marks Habitat Care launched and moves on to Culture & Memory', async ({ page }) => {
  test.skip(!fs.existsSync(BETA), `${BETA} missing; save journeys need local fixtures`);
  await page.goto('#/import');
  await page.getByLabel('Save file').setInputFiles(BETA);
  await expect(page.getByRole('status')).toContainText('Imported', { timeout: 90_000 });

  await page.getByRole('link', { name: 'Committees' }).click();
  const habitat = page.getByRole('listitem', { name: 'Habitat Care' });
  await expect(habitat.getByText('Launched')).toBeVisible();
  await expect(habitat.getByText('In orbit')).toHaveCount(4);
  await expect(habitat.getByText('game: Active')).toBeVisible();
  await expect(habitat.getByRole('list', { name: 'Habitat Care quests' })).toContainText('Seats of Care Forms the committee');
  await expect(habitat.getByRole('listitem').filter({ hasText: 'Seats of Care' }).getByText('Done')).toBeVisible();
  await expect(habitat.getByRole('listitem').filter({ hasText: 'The Forbidden Fruit' }).getByText('In progress')).toBeVisible();
  await expect(page.getByRole('listitem', { name: 'Culture & Memory' }).getByText('Do next')).toBeVisible();
  await expect(page.getByText('1 of 10 launched')).toBeVisible();
  const advice = page.getByRole('region', { name: 'Advice from your save' });
  await expect(advice).toContainText('The Forbidden Fruit is in progress');
  await expect(advice).toContainText('Project Jonah is in progress');

  // 36 open seats plus Platform Omega, planned together from this save.
  const council = page.getByRole('region', { name: 'Plan for every remaining human' });
  await council.getByRole('button', { name: 'Plan them all' }).click();
  await expect(council.getByText('37 of 37')).toBeVisible({ timeout: 60_000 });
  await expect(council.getByRole('table', { name: 'Nutrients to gather' }).getByRole('row', { name: /Protein/ })).toBeVisible();
  await expect(council.getByRole('list', { name: 'Foods to craft' }).getByRole('listitem').first()).toBeVisible();
  await expect(council.getByText('Platform Omega (Maintenance Engineer)')).toBeVisible();
});
