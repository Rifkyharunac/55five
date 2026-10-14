import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
let failed = false;
for (const folder of ['api', 'server', 'src', 'scripts', 'tests', 'e2e']) {
  let files;
  try {
    files = await readdir(folder);
  } catch {
    continue;
  }
  for (const file of files.filter((name) => /\.(m?js)$/.test(name))) {
    const result = spawnSync(process.execPath, ['--check', `${folder}/${file}`], {
      stdio: 'inherit',
    });
    if (result.status !== 0) failed = true;
  }
}
if (failed) process.exit(1);
console.log('JavaScript syntax checks passed.');
