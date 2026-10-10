import { issueId, normalizeResults, serverRemaining } from '../logic.mjs';
const base = 'https://newapi.55lottertttapi.com/api/webapi/';
async function upstream(path, body) {
  const response = await fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(7000), cache: 'no-store'
  });
  if (!response.ok) throw new Error('Sumber data tidak merespons');
  const json = await response.json();
  if (json.code !== 0 || !json.data) throw new Error('Sumber data menolak permintaan');
  return json.data;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Gunakan GET' });
  }
  try {
    const started = performance.now();
    // Keep the known upstream request/signature pairs together.
    const [current, recent] = await Promise.all([
      upstream('GetGameIssue', { typeId: 30, language: 0,
        random: '166b81d9568e4123a83a2c7fdb80b7d9', signature: '5DB43C344C7381B72B5262FFB3572444', timestamp: 1737252405 }),
      upstream('GetNoaverageEmerdList', { pageSize: 10, pageNo: 1, typeId: 30, language: 0,
        random: 'b631eb26bac6403e99093913e5bb48c5', signature: 'A6203E85132E5FE26B5F43DDF1ECDD07', timestamp: 1737252405 })
    ]);
    const issue = issueId(current.issueNumber);
    const remaining = serverRemaining(current);
    if (!issue || remaining === null) throw new Error('Waktu atau periode server tidak valid');
    if (!Array.isArray(recent.list)) throw new Error('Daftar hasil tidak tersedia');
    const list = normalizeResults(recent.list);
    if (recent.list.length && !list.length) throw new Error('Hasil server tidak valid');
    return res.status(200).json({ issue, periode: issue.slice(-5),
      remainingMs: Math.max(0, remaining - (performance.now() - started)),
      list: list.map(r => ({ ...r, hasil: r.number })) });
  } catch (error) {
    console.error('Upstream data unavailable:', error.name);
    return res.status(502).json({ error: 'Data server belum tersedia. Akan mencoba lagi otomatis.' });
  }
}
