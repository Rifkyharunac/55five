import { ProviderError } from './provider.js';

const messages = {
  UPSTREAM_TIMEOUT: 'Penyedia data terlalu lama merespons. Silakan coba lagi.',
  UPSTREAM_UNAVAILABLE: 'Penyedia data belum dapat dihubungi.',
  UPSTREAM_INVALID: 'Format data penyedia tidak valid.',
  UPSTREAM_REJECTED: 'Permintaan ditolak penyedia. Konfigurasi akses perlu diperiksa.',
  UPSTREAM_TRANSITION: 'Periode sedang berganti. Data akan diperbarui kembali.',
  CONFIGURATION_ERROR: 'Konfigurasi penyedia belum valid.',
};

export function createHandler(load) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Metode tidak diizinkan.', code: 'METHOD_NOT_ALLOWED' });
    }
    try { return res.status(200).json(await load()); }
    catch (error) {
      const code = error instanceof ProviderError ? error.code : 'UPSTREAM_UNAVAILABLE';
      const status = code === 'UPSTREAM_TIMEOUT' ? 504 : code === 'CONFIGURATION_ERROR' ? 503 : 502;
      console.warn(JSON.stringify({ event: 'provider_error', code, status }));
      return res.status(status).json({ error: messages[code], code });
    }
  };
}
