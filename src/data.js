export function issueId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) value = String(value);
  return typeof value === 'string' && /^\d{8,32}$/.test(value) ? value : null;
}

export function compareIssues(a, b) {
  return a.length - b.length || a.localeCompare(b);
}

const MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

// Nomor urut periode di-reset tiap hari oleh penyedia, jadi 5 digit terakhir
// saja bisa terlihat "mundur" saat sesi melewati tengah malam.
// Label tanggal ini membuat urutan antar-hari jelas di log sesi.
export function issueDayLabel(value) {
  const id = issueId(value);
  if (!id || id.length < 8) return '';
  const day = Number(id.slice(6, 8));
  const month = Number(id.slice(4, 6));
  if (!(day >= 1 && day <= 31 && month >= 1 && month <= 12)) return id.slice(0, 8);
  return `${day} ${MONTHS_ID[month - 1]}`;
}

export function digit(value) {
  if (typeof value === 'string' && /^\d$/.test(value)) value = Number(value);
  return Number.isInteger(value) && value >= 0 && value <= 9 ? value : null;
}

export function normalizeResult(row) {
  if (!row || typeof row !== 'object') return null;
  const issueNumber = issueId(row.issueNumber);
  const number = typeof row.number === 'number' ? String(row.number) : row.number;
  if (!issueNumber || typeof number !== 'string' || !/^\d(?:,\d)*$/.test(number)) return null;
  const hasil = digit(number.split(',').at(-1));
  if (hasil === null || (row.hasil !== undefined && digit(row.hasil) !== hasil)) return null;
  return {
    issueNumber,
    number,
    hasil,
    colour: typeof row.colour === 'string' ? row.colour.slice(0, 40) : '',
  };
}

export function category(value) {
  return digit(value) === null ? null : Number(value) < 5 ? 'Kecil' : 'Besar';
}

export function colors(value) {
  if (digit(value) === null) return [];
  const n = Number(value);
  return [n % 2 ? 'Hijau' : 'Merah', ...([0, 5].includes(n) ? ['Ungu'] : [])];
}
