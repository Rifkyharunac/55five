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
  await mockData(page, () => snapshot(period));
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
  await page.getByRole('tab', { name: 'Simulasi sesi' }).focus();
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
    for (const tab of ['Simulasi sesi', 'Riwayat hasil', 'Statistik', 'Pola', 'Edukasi']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByRole('tab', { name: 'Simulasi sesi' }).click();
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
    for (const tab of ['Simulasi sesi', 'Riwayat hasil', 'Statistik', 'Pola', 'Edukasi']) {
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
  await expect(page.locator('#backtestBody tr')).toHaveCount(4);
  await expect(page.locator('#backtestMeta')).toContainText('160 sampel');
  await page.getByRole('tab', { name: 'Edukasi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backtest bukan janji akurasi' })).toBeVisible();
});
