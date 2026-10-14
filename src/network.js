import { issueId, normalizeResult, compareIssues } from './data.js';

export async function fetchSnapshot({ fetchImpl = fetch, signal } = {}) {
  const started = performance.now();
  const timeout = AbortSignal.timeout(12000);
  const response = await fetchImpl('/api', {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const messages = {
      502: 'Penyedia data belum siap. Mencoba kembali otomatis.',
      503: 'Konfigurasi layanan perlu diperiksa.',
      504: 'Respons penyedia terlalu lama. Mencoba kembali otomatis.',
    };
    throw new Error(
      messages[response.status] || 'Data belum dapat dimuat. Mencoba kembali otomatis.',
    );
  }
  const data = await response.json();
  const issue = issueId(data?.issue);
  if (
    !issue ||
    !Array.isArray(data.list) ||
    !data.list.length ||
    data.list.length > 100 ||
    !Number.isFinite(data.fetchedAt) ||
    !Number.isFinite(data.serverTime) ||
    data.serverTime < data.fetchedAt ||
    data.serverTime - data.fetchedAt > 15000 ||
    !(
      data.expiresAt === null ||
      (Number.isFinite(data.expiresAt) &&
        data.expiresAt >= data.fetchedAt &&
        data.expiresAt <= data.fetchedAt + 30000)
    )
  ) {
    throw new Error('Data yang diterima tidak valid. Mencoba kembali otomatis.');
  }
  const list = data.list.map(normalizeResult);
  if (list.some((row) => !row || compareIssues(row.issueNumber, issue) >= 0)) {
    throw new Error('Data periode belum konsisten. Mencoba kembali otomatis.');
  }
  const remaining =
    data.expiresAt === null
      ? null
      : Math.max(0, data.expiresAt - data.serverTime - (performance.now() - started));
  const fetchedAt = Date.now();
  return {
    ...data,
    issue,
    list,
    fetchedAt,
    expiresAt: remaining === null ? null : fetchedAt + remaining,
  };
}

export function createPoller({
  load,
  onData,
  onStatus,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let timer,
    active = false,
    stopped = false,
    failures = 0,
    generation = 0,
    controller;
  async function refresh() {
    if (active || stopped) return;
    cancel(timer);
    active = true;
    const token = generation;
    controller = new AbortController();
    onStatus('loading');
    try {
      const data = await load(controller.signal);
      if (stopped || token !== generation) return;
      onData(data);
      failures = 0;
      onStatus('live');
    } catch (error) {
      if (stopped || token !== generation) return;
      failures++;
      onStatus('error', error);
    } finally {
      active = false;
      if (!stopped)
        timer = schedule(
          refresh,
          token !== generation ? 0 : Math.min(30000, 2000 * 2 ** Math.min(failures, 4)),
        );
    }
  }
  return {
    refresh,
    stop() {
      stopped = true;
      generation++;
      cancel(timer);
      controller?.abort();
    },
    start() {
      stopped = false;
      return refresh();
    },
  };
}
