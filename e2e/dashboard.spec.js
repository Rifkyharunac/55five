import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/data/riwayat.json', (route) => route.fulfill({ json: [] }));
});

const id = (n) => `2026101410005${String(n).padStart(4, '0')}`;
function snapshot(period = 20) {
  const now = Date.now();
  return {
    issue: id(period),
    periode: String(period),
    source: 'live',
    fetchedAt: now,
    serverTime: now,
    expiresAt: now + 25000,
    list: Array.from({ length: 10 }, (_, i) => ({
      issueNumber: id(period - 1 - i),
      hasil: i % 10,
      number: String(i % 10),
      colour: '',
    })),
  };
}
async function mockData(page, getData = () => snapshot()) {
  await page.route('**/api', (route) => route.fulfill({ json: getData() }));
}

test('archive refreshes every 30 minutes and retains data on a failed refresh', async ({
  page,
}) => {
  await page.clock.install({ time: new Date() });
  let archive = [{ p: id(1), h: 1 }];
  let fail = false;
  let requests = 0;
  await page.route('**/data/riwayat.json', (route) => {
    requests++;
    return fail ? route.fulfill({ status: 503 }) : route.fulfill({ json: archive });
  });
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  await page.getByRole('tab', { name: 'Pola', exact: true }).click();
  await expect(page.locator('#patternMeta')).toContainText('11 hasil');
  archive = [...archive, { p: id(2), h: 2 }];
  await page.clock.fastForward(30 * 60 * 1000);
  await expect(page.locator('#patternMeta')).toContainText('12 hasil');
  fail = true;
  await page.clock.fastForward(30 * 60 * 1000);
  await expect(page.locator('#seedNotice')).toBeVisible();
  await expect(page.locator('#patternMeta')).toContainText('12 hasil');
  fail = false;
  archive = [...archive, { p: id(3), h: 3 }];
  await page.clock.fastForward(30 * 60 * 1000);
  await expect(page.locator('#patternMeta')).toContainText('13 hasil');
  await expect(page.locator('#seedNotice')).toBeHidden();
  expect(requests).toBe(4);
});

test('a repeated provider period does not restart the countdown', async ({ page }) => {
  await page.clock.install({ time: new Date() });
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  const initial = Number(await page.locator('#countdown').textContent());
  await page.clock.fastForward(5000);
  await page.getByRole('button', { name: 'Perbarui', exact: true }).click();
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  expect(Number(await page.locator('#countdown').textContent())).toBeLessThan(initial - 3);
});

test('loads live data without runtime errors and settles a new period once across reload', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  let period = 20;
  await mockData(page, () => ({
    ...snapshot(period),
    list: snapshot(period).list.map((r) => ({ ...r, hasil: 8, number: '8' })),
  }));
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  await expect(page.locator('#sessionBody tr')).toHaveCount(1);
  period = 21;
  await page.getByRole('button', { name: 'Perbarui', exact: true }).click();
  await expect(page.locator('#scTotal')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  await expect(page.locator('#scTotal')).toHaveText('1');
  await expect(page.locator('#sessionBody tr')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('recovers automatically from a failed first request', async ({ page }) => {
  let calls = 0;
  await page.route('**/api', (route) =>
    ++calls === 1
      ? route.fulfill({ status: 502, json: { error: 'Unavailable' } })
      : route.fulfill({ json: snapshot() }),
  );
  await page.goto('/');
  await expect(page.locator('#networkNotice')).toBeVisible();
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  await expect(page.locator('#networkNotice')).toBeHidden();
});

test('history search, categories, and CSV use the same filtered results', async ({ page }) => {
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  await page.getByRole('tab', { name: 'Riwayat hasil' }).click();
  await expect(page.locator('#historyBody tr')).toHaveCount(10);
  await page.getByLabel('Kategori', { exact: true }).selectOption('Besar');
  await expect(page.locator('#historyBody tr')).toHaveCount(5);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor CSV' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString();
  expect(csv.split('\r\n')).toHaveLength(6);
  expect(csv).toContain(id(14));
  expect(csv).not.toContain('Kecil');
  await page.getByLabel('Cari periode').fill('999999999');
  await expect(page.locator('#historyEmpty')).toContainText('Tidak ada hasil yang cocok');
  await expect(page.getByRole('button', { name: 'Ekspor CSV' })).toBeDisabled();
});

test('themes and density persist while keyboard navigation activates the right panel', async ({
  page,
}) => {
  await mockData(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Aktifkan tema terang' }).click();
  await page.getByRole('switch', { name: /Tampilan ringkas/ }).check();
  await page.getByRole('tab', { name: 'Prediksi' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Statistik' })).toBeFocused();
  await expect(page.locator('#view-stats')).toBeVisible();
  await expect(page.locator('#frequencyChart .frequency-column')).toHaveCount(10);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('switch', { name: /Tampilan ringkas/ })).toBeChecked();
});

test('reset requires confirmation, resets session, and retains history', async ({ page }) => {
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#sessionBody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Jeda pembaruan' }).click();
  await page.locator('#resetButton').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  await expect(page.locator('#sessionBody tr')).toHaveCount(1);
  await page.locator('#resetButton').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mulai sesi baru' }).click();
  await expect(page.locator('#sessionBody tr')).toHaveCount(0);
  await expect(page.locator('#scSaldo')).toHaveText('1.000');
  await page.getByRole('tab', { name: 'Riwayat hasil' }).click();
  await expect(page.locator('#historyBody tr')).toHaveCount(10);
});

test('offline state retains history and resumes when connection returns', async ({
  page,
  context,
}) => {
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  await context.setOffline(true);
  await expect(page.locator('#connectionText')).toHaveText('Offline');
  await expect(page.locator('#countdown')).toHaveText('—');
  await page.getByRole('tab', { name: 'Riwayat hasil' }).click();
  await expect(page.locator('#historyBody tr')).toHaveCount(10);
  await context.setOffline(false);
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
});

test('corrupt and blocked storage never prevent the dashboard from loading', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('five55_session_v2', '{broken');
    localStorage.setItem(
      'five55_history_v1',
      JSON.stringify([
        { p: '20261014100050001', h: 5 },
        { p: 'bad', h: 300 },
      ]),
    );
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'QuotaExceededError');
    };
  });
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  await expect(page.locator('#storageNotice')).toBeVisible();
  await expect(page.locator('#sessionBody tr')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Riwayat hasil' }).click();
  await expect(page.locator('#historyBody tr')).toHaveCount(11);
});

test('external site only loads on demand and can be closed', async ({ page }) => {
  let externalRequests = 0;
  await mockData(page);
  await page.route('https://55x4mqd.com/**', (route) => {
    externalRequests++;
    return route.fulfill({
      contentType: 'text/html',
      body: '<html lang="id"><title>Situs eksternal</title><p>Konten uji</p></html>',
    });
  });
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  expect(externalRequests).toBe(0);
  await page.getByRole('button', { name: 'Tampilkan dalam panel' }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.getByRole('button', { name: 'Tutup panel' }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('#embedButton')).toBeFocused();
});

test('all panels fit mobile and desktop widths without page overflow', async ({ page }, info) => {
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const tab of ['Prediksi', 'Riwayat hasil', 'Statistik', 'Pola', 'Edukasi']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByRole('tab', { name: 'Prediksi' }).click();
    await page.screenshot({ path: info.outputPath(`dashboard-${width}.png`), fullPage: true });
  }
});

test('dark and light views pass automated accessibility checks', async ({ page }) => {
  test.setTimeout(60000);
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.getByRole('button', { name: 'Aktifkan tema terang' }).click();
    for (const tab of ['Prediksi', 'Riwayat hasil', 'Statistik', 'Pola', 'Edukasi']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    }
  }
});

test('archive seeds analytics and worker backtest completes without blocking the dashboard', async ({
  page,
}) => {
  const archive = Array.from({ length: 150 }, (_, i) => ({
    p: `2026101310005${String(i).padStart(4, '0')}`,
    h: i % 10,
  }));
  await page.route('**/data/riwayat.json', (route) => route.fulfill({ json: archive }));
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#connectionText')).toHaveText('Terhubung');
  await page.getByRole('tab', { name: 'Pola', exact: true }).click();
  await expect(page.locator('#patternStrip span')).toHaveCount(20);
  await page.getByRole('button', { name: 'Jalankan backtest' }).click();
  await expect(page.locator('#backtestBody tr')).toHaveCount(5);
  await expect(page.locator('#backtestBody tr').first().locator('td')).toHaveCount(5);
  await expect(page.locator('#backtestBody')).toContainText('mayoritas-all');
  await expect(page.locator('#backtestMeta')).toContainText('160 sampel');
  await page.getByRole('tab', { name: 'Edukasi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backtest bukan janji akurasi' })).toBeVisible();
});

test('primary shows one direction and one loss even when the random comparison wins', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.9;
  });
  let period = 40;
  await mockData(page, () => ({
    ...snapshot(period),
    list: snapshot(period).list.map((r) => ({
      ...r,
      hasil: period === 40 ? 1 : 8,
      number: period === 40 ? '1' : '8',
    })),
  }));
  await page.goto('/');
  const first = page.locator('#sessionBody tr').first();
  await expect(first.locator('td').nth(1)).toContainText('Kecil');
  await expect(first.locator('details')).not.toHaveAttribute('open', '');
  await expect(first.locator('td').nth(1)).not.toContainText('suara');
  period = 41;
  await page.getByRole('button', { name: 'Perbarui', exact: true }).click();
  await expect(page.locator('#scLose')).toHaveText('1 LOSE');
  await expect(page.locator('#scWin')).toHaveText('0 WIN');
  await expect(page.locator('#scSaldo')).toHaveText('990');
  const settled = page.locator('#sessionBody tr').nth(1);
  await expect(settled.locator('.badge')).toHaveCount(1);
  await expect(settled.locator('.badge')).toHaveText('LOSE');
  await settled.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(settled.locator('details')).toHaveAttribute('open', '');
  await expect(settled.locator('details')).toContainText('acak: Besar');
  await page.reload();
  await expect(page.locator('#scSaldo')).toHaveText('990');
});

test('unclear primary is not scored and does not change the balance', async ({ page }) => {
  let period = 20;
  await mockData(page, () => snapshot(period));
  await page.goto('/');
  await expect(page.locator('#sessionBody tr').first()).toContainText('Tidak ada arah');
  period++;
  await page.getByRole('button', { name: 'Perbarui', exact: true }).click();
  await expect(page.locator('#sessionMeta')).toContainText('1 tanpa arah');
  await expect(page.locator('#scTotal')).toHaveText('0');
  await expect(page.locator('#scSaldo')).toHaveText('1.000');
  await expect(page.locator('#sessionBody tr').nth(1).locator('.badge')).toHaveText(
    'Tidak dinilai',
  );
});

test('legacy sessions remain visible without being rescored as primary', async ({ page }) => {
  const legacy = {
    version: 3,
    currentIssue: id(19),
    createdAt: Date.now(),
    rounds: 1,
    win: 3,
    lose: 1,
    missed: 0,
    methods: {
      'pola-6': { win: 1, lose: 0 },
      'mayoritas-30': { win: 1, lose: 0 },
      'mayoritas-all': { win: 1, lose: 0 },
      acak: { win: 0, lose: 1 },
    },
    rows: [
      {
        issue: id(19),
        picks: {
          'pola-6': 'Besar',
          'mayoritas-30': 'Besar',
          'mayoritas-all': 'Besar',
          acak: 'Kecil',
        },
        status: 'scored',
        result: 8,
      },
    ],
  };
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('five55_session_v2'))
      sessionStorage.setItem('five55_session_v2', JSON.stringify(value));
  }, legacy);
  await mockData(page);
  await page.goto('/');
  await expect(page.locator('#legacySessionNotice')).toBeVisible();
  await expect(page.locator('#sessionBody')).toContainText('Versi lama');
  await expect(page.locator('#scTotal')).toHaveText('0');
  await expect(page.locator('#scSaldo')).toHaveText('1.000');
  await page.reload();
  await expect(page.locator('#legacySessionNotice')).toBeVisible();
  await expect(page.locator('#sessionBody')).toContainText('Arsip lama');
  await expect(page.locator('#scTotal')).toHaveText('0');
});
