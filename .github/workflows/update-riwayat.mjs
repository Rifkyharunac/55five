// Preserve the repository archive; append only validated results from the provider.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { provider } from '../../server/provider.js';
import { mergeHistory } from '../../src/model.js';
const file = new URL('../../data/riwayat.json', import.meta.url);
const previous = JSON.parse(await readFile(file, 'utf8'));
if (!Array.isArray(previous)) throw new Error('Existing archive is not an array');
const normalized = mergeHistory(previous, [], Infinity);
if (normalized.length !== previous.length)
  throw new Error('Existing archive contains invalid or duplicate records; refusing to overwrite');
const { list } = await provider.history();
const combined = mergeHistory(normalized, list, Infinity).reverse();
if (combined.length === previous.length) {
  console.log('Tidak ada ronde baru.');
} else {
  const temporary = new URL('../../data/riwayat.json.tmp', import.meta.url);
  await writeFile(temporary, JSON.stringify(combined));
  await rename(temporary, file);
  console.log(`Ditambah ${combined.length - previous.length} ronde, total ${combined.length}.`);
}
