// "Load latest save" in the top bar: without a usable remembered folder it asks for the save folder and loads the
// newest world save in it, skipping the key-bindings file that sits beside the saves.
import { test, expect } from './fixtures.js';
import fs from 'node:fs';
import path from 'node:path';

const BETA = 'test/fixtures/beta-update6.sav';
const PREBETA = 'test/fixtures/prebeta.sav';

test('load latest save picks the newest world save in the chosen folder', async ({ page }, info) => {
  test.skip(!fs.existsSync(BETA) || !fs.existsSync(PREBETA), 'save journeys need local fixtures');
  // SaveGames/ with the key-bindings file (newest of all) and a steam-id folder holding an older and a newer save.
  const root = info.outputPath('SaveGames');
  const steam = path.join(root, '123');
  fs.mkdirSync(steam, { recursive: true });
  const put = (src, dest, minutesAgo) => {
    const file = path.join(dest);
    if (src) fs.copyFileSync(src, file); else fs.writeFileSync(file, 'bindings');
    const t = new Date(Date.now() - minutesAgo * 60_000);
    fs.utimesSync(file, t, t);
  };
  put(PREBETA, path.join(steam, '123_0.sav'), 60);
  put(BETA, path.join(steam, '123_AutoSave_0.sav'), 10);
  put(null, path.join(root, 'EnhancedInputUserSettings.sav'), 1);

  await page.goto('#/import');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load latest save' }).click();
  await (await chooser).setFiles(root);
  await expect(page.getByRole('status')).toContainText('Imported', { timeout: 90_000 });
  // The beta autosave (Oodle) won, not the older prebeta slot (zlib) or the bindings file.
  const last = page.getByRole('region', { name: 'Last import' });
  await expect(last).toContainText('123_AutoSave_0.sav');
  await expect(last).toContainText('oodle-kraken');
});
