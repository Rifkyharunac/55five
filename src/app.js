import { compareIssues } from './data.js';
import { newSession, advanceSession, mergeHistory, filterHistory, historyCsv } from './model.js';
import { createStorage, HISTORY_KEY } from './storage.js';
import { fetchSnapshot, createPoller } from './network.js';
import { renderExperiments, setupBacktest } from './experiments-ui.js';
import {
  $,
  text,
  renderSession,
  renderHistory,
  renderRecent,
  renderStats,
  setupTabs,
} from './render.js';

const storage = createStorage(
  () => localStorage,
  () => sessionStorage,
  (message) => {
    text('storageNotice', message);
    $('storageNotice').hidden = false;
  },
);
let history = storage.loadHistory();
let seedHistory = [];
let session = storage.loadSession();
const settings = storage.loadSettings();
let latest = null,
  paused = false,
  connectionState = 'loading',
  toastTimer;

function filteredHistory() {
  return filterHistory(allHistory(), {
    query: $('searchInput').value,
    category: $('categoryFilter').value,
    limit: $('historyLimit').value,
  });
}
function drawHistory() {
  renderHistory(filteredHistory(), allHistory().length);
}
function drawStats() {
  const count = Number($('statsLimit').value);
  renderStats(count ? allHistory().slice(0, count) : allHistory());
}
function allHistory() {
  return mergeHistory(seedHistory, history, Infinity);
}
function drawData() {
  drawHistory();
  drawStats();
  renderRecent(allHistory());
  renderExperiments(allHistory());
}
function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]').content =
    settings.theme === 'light' ? '#f3f5f1' : '#101715';
  $('themeButton').setAttribute(
    'aria-label',
    settings.theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap',
  );
  document.body.classList.toggle('compact', settings.compact);
  $('compactToggle').checked = settings.compact;
}
function toast(message) {
  clearTimeout(toastTimer);
  text('toast', message);
  $('toast').hidden = false;
  toastTimer = setTimeout(() => {
    $('toast').hidden = true;
  }, 4000);
}
function status(state, message = '') {
  connectionState = state;
  $('connection').dataset.state = state;
  const labels = {
    loading: 'Menghubungkan',
    live: 'Terhubung',
    error: 'Koneksi terganggu',
    offline: 'Offline',
    paused: 'Dijeda',
    hidden: 'Tab tidak aktif',
  };
  text('connectionText', labels[state]);
  text('networkNotice', message);
  $('networkNotice').hidden = !message;
  tick();
}
function tick() {
  const connected = connectionState === 'live' && latest && Date.now() - latest.fetchedAt < 15000;
  const remaining =
    connected && latest.expiresAt !== null
      ? Math.max(0, Math.ceil((latest.expiresAt - Date.now()) / 1000))
      : null;
  text('countdown', remaining === null ? '—' : String(remaining).padStart(2, '0'));
  $('countdownProgress').value = remaining ?? 0;
  text(
    'countdownNote',
    remaining === null
      ? paused
        ? 'Pembaruan dijeda'
        : 'Menunggu sinkronisasi'
      : remaining === 0
        ? 'Menunggu periode baru'
        : 'Mengikuti waktu server',
  );
}
const poller = createPoller({
  load: (signal) => fetchSnapshot({ signal }),
  onData(data) {
    if (latest && compareIssues(data.issue, latest.issue) < 0)
      throw new Error('Data periode tertinggal. Mencoba kembali otomatis.');
    // A repeated/cached period must never restart its countdown.
    if (latest?.issue === data.issue && latest.expiresAt !== null && data.expiresAt !== null) {
      data.expiresAt = Math.min(latest.expiresAt, data.expiresAt);
    }
    latest = data;
    text('activePeriod', data.issue.slice(-5));
    text('fullIssue', data.issue);
    text('periodCaption', 'Dikonfirmasi penyedia · tanpa perkiraan periode');
    const nextHistory = mergeHistory(history, data.list);
    if (JSON.stringify(nextHistory) !== JSON.stringify(history)) {
      history = nextHistory;
      storage.saveHistory(history);
      drawData();
    }
    if (advanceSession(session, data, Math.random, allHistory())) {
      storage.saveSession(session);
      renderSession(session);
    }
    text('lastUpdated', new Date(data.fetchedAt).toLocaleTimeString('id-ID'));
    $('lastUpdated').dateTime = new Date(data.fetchedAt).toISOString();
  },
  onStatus(state, error) {
    $('refreshButton').disabled = state === 'loading';
    if (state === 'loading') {
      if (!latest && connectionState === 'loading') status('loading');
      return;
    }
    if (state === 'error') {
      text(
        'periodCaption',
        latest ? 'Data terakhir · menunggu koneksi pulih' : 'Belum ada data terkonfirmasi',
      );
      const message =
        error instanceof SyntaxError
          ? 'Format data belum valid. Mencoba kembali otomatis.'
          : error?.name === 'TimeoutError'
            ? 'Koneksi terlalu lama. Mencoba kembali otomatis.'
            : error instanceof TypeError
              ? 'Layanan belum terjangkau. Mencoba kembali otomatis.'
              : error?.message;
      status('error', message || 'Gagal memuat data. Mencoba kembali otomatis.');
    } else status('live');
  },
});

function syncPolling() {
  $('pauseButton').setAttribute('aria-pressed', String(paused));
  text('pauseButton', paused ? '▶ Lanjutkan pembaruan' : 'Ⅱ Jeda pembaruan');
  if (paused || document.hidden || !navigator.onLine) {
    poller.stop();
    $('refreshButton').disabled = false;
    if (!navigator.onLine)
      status(
        'offline',
        'Anda sedang offline. Data tersimpan tetap tersedia; pembaruan akan dilanjutkan saat terhubung.',
      );
    else status(paused ? 'paused' : 'hidden');
    text(
      'periodCaption',
      latest ? 'Data terakhir · pembaruan sedang dijeda' : 'Pembaruan data sedang dijeda',
    );
  } else {
    poller.start();
  }
}

$('refreshButton').addEventListener('click', () => {
  paused = false;
  syncPolling();
});
$('pauseButton').addEventListener('click', () => {
  paused = !paused;
  syncPolling();
});
document.addEventListener('visibilitychange', syncPolling);
window.addEventListener('online', syncPolling);
window.addEventListener('offline', syncPolling);
window.addEventListener('pagehide', () => poller.stop());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) syncPolling();
});
$('themeButton').addEventListener('click', () => {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  applySettings();
  storage.saveSettings(settings);
});
$('compactToggle').addEventListener('change', () => {
  settings.compact = $('compactToggle').checked;
  applySettings();
  storage.saveSettings(settings);
});
for (const id of ['searchInput', 'categoryFilter', 'historyLimit'])
  $(id).addEventListener('input', drawHistory);
$('statsLimit').addEventListener('change', drawStats);
window.addEventListener('storage', (event) => {
  if (event.key === HISTORY_KEY) {
    history = mergeHistory(history, storage.loadHistory());
    drawData();
  }
});
$('exportButton').addEventListener('click', () => {
  const rows = filteredHistory();
  if (!rows.length) return;
  const url = URL.createObjectURL(
    new Blob([historyCsv(rows)], { type: 'text/csv;charset=utf-8;' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `55five-riwayat-${Date.now()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${rows.length} hasil diekspor sesuai filter.`);
});
$('resetButton').addEventListener('click', () => {
  $('resetDialog').returnValue = '';
  $('resetDialog').showModal();
});
$('resetDialog').addEventListener('close', () => {
  if ($('resetDialog').returnValue !== 'confirm') return;
  session = newSession();
  storage.saveSession(session);
  renderSession(session);
  toast('Sesi baru dimulai. Riwayat hasil tetap tersimpan.');
});
function toggleEmbed(show) {
  $('externalPanel').hidden = !show;
  $('embedButton').setAttribute('aria-expanded', String(show));
  text('embedButton', show ? 'Sembunyikan panel' : 'Tampilkan dalam panel');
  $('embedContainer').replaceChildren();
  if (show) {
    const frame = document.createElement('iframe');
    frame.title = 'Situs eksternal 55five';
    frame.src = 'https://55x4mqd.com/#/home/';
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute(
      'sandbox',
      'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox',
    );
    $('embedContainer').append(frame);
    $('externalPanel').scrollIntoView({ block: 'start' });
    $('closeEmbedButton').focus({ preventScroll: true });
  } else $('embedButton').focus();
}
$('embedButton').addEventListener('click', () => toggleEmbed($('externalPanel').hidden));
$('closeEmbedButton').addEventListener('click', () => toggleEmbed(false));

applySettings();
setupTabs();
setupBacktest(allHistory, toast);
renderSession(session);
drawData();
setInterval(tick, 250);
try {
  const response = await fetch('/data/riwayat.json', {
    signal: AbortSignal.timeout(5000),
    cache: 'no-cache',
  });
  if (!response.ok) throw new Error('Archive unavailable');
  const archive = await response.json();
  if (!Array.isArray(archive)) throw new Error('Invalid archive');
  seedHistory = mergeHistory(archive, [], Infinity);
  drawData();
} catch {
  text(
    'seedNotice',
    'Arsip awal belum tersedia. Riwayat lokal dan pembaruan langsung tetap dapat digunakan.',
  );
  $('seedNotice').hidden = false;
}
syncPolling();
