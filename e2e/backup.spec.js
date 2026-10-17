// Settings → Backup: everything lives in browser storage, so a backup must round-trip through a file.
import { test, expect } from './fixtures.js';
import fs from 'node:fs';

test('an exported backup restores an edit made after it', async ({ page }, info) => {
  await page.goto('#/data/settings');
  const downloadP = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const file = info.outputPath('backup.json');
  await (await downloadP).saveAs(file);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(doc.professions).toHaveLength(40);

  // Change a rule, then restore the backup taken before it.
  const capacity = page.getByLabel('Pod capacity (kg)');
  await capacity.fill('123');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('Settings saved');

  page.once('dialog', (d) => d.accept());
  await page.getByLabel('Backup file').setInputFiles(file);
  await expect(page.getByRole('status')).toContainText('Backup restored');
  await expect(capacity).toHaveValue('100');
});
