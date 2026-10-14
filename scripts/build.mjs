import { mkdir, copyFile, cp } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/', root), { recursive: true });
for (const file of ['index.html', 'favicon.svg'])
  await copyFile(new URL(file, root), new URL('dist/' + file, root));
await cp(new URL('src/', root), new URL('dist/src/', root), { recursive: true });
await mkdir(new URL('dist/data/', root), { recursive: true });
await copyFile(new URL('data/riwayat.json', root), new URL('dist/data/riwayat.json', root));
console.log('Static assets built in dist/. API functions remain in api/.');
