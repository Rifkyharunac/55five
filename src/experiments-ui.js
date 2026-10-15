import { category } from './data.js';
import { analyzePatterns } from './experiments.js';
import { $, text } from './render.js';

export function renderExperiments(history) {
  const patterns = analyzePatterns(history);
  text(
    'patternMeta',
    `${history.length} hasil tersedia · indikator memakai hingga 100 sampel terbaru.`,
  );
  const strip = history
    .slice(0, 20)
    .reverse()
    .map((row) => {
      const item = document.createElement('span');
      item.className = `pattern-chip ${row.h >= 5 ? 'big' : 'small'}`;
      item.textContent = `${row.h} ${row.h >= 5 ? 'B' : 'K'}`;
      item.title = `${row.p} · ${category(row.h)}`;
      return item;
    });
  $('patternStrip').replaceChildren(...strip);
  text(
    'patternStreak',
    history.length ? `${patterns.streak.category} × ${patterns.streak.count}` : '—',
  );
  text(
    'patternDragon',
    patterns.dragon ? `${patterns.dragon.category} × ${patterns.dragon.count}` : 'Tidak ada',
  );
  text(
    'dragonNote',
    patterns.dragon ? `${patterns.dragon.ago} sampel lalu` : 'Belum ada rangkaian ≥ 4',
  );
  text(
    'patternAlternating',
    patterns.alternating10 ? '10 / 10 selang-seling' : `Maksimal × ${patterns.longestAlternating}`,
  );
  $('backtestButton').disabled =
    history.length <= 100 || $('backtestButton').getAttribute('aria-busy') === 'true';
  text(
    'backtestHint',
    history.length <= 100
      ? 'Perlu lebih dari 100 hasil untuk melewati warmup.'
      : 'Bandingkan 4 metode pada maksimal 2.000 hasil terbaru.',
  );
}

export function setupBacktest(getHistory, toast) {
  let running = false;
  $('backtestButton').addEventListener('click', () => {
    if (running) return;
    running = true;
    $('backtestButton').setAttribute('aria-busy', 'true');
    $('backtestButton').disabled = true;
    text('backtestButton', 'Menghitung…');
    const history = getHistory().slice(0, 2000);
    let worker, timer;
    function finish() {
      clearTimeout(timer);
      worker?.terminate();
      running = false;
      $('backtestButton').setAttribute('aria-busy', 'false');
      $('backtestButton').disabled = getHistory().length <= 100;
      text('backtestButton', 'Jalankan backtest');
    }
    try {
      worker = new Worker(new URL('./backtest-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        finish();
        if (data.error) {
          toast(data.error);
          return;
        }
        const rows = data.result.comparison.map((result) => {
          const tr = document.createElement('tr');
          for (const value of [
            result.method,
            result.total,
            result.correct,
            result.abstained,
            result.accuracy === null ? '—' : `${result.accuracy}%`,
          ]) {
            const td = document.createElement('td');
            td.textContent = String(value);
            tr.append(td);
          }
          return tr;
        });
        $('backtestBody').replaceChildren(...rows);
        text(
          'backtestMeta',
          `${data.result.rounds} sampel · warmup ${data.result.warmup} · seed ${data.result.seed}. Hasil historis bukan jaminan.`,
        );
        $('backtestResult').hidden = false;
      };
      worker.onerror = () => {
        finish();
        toast('Backtest gagal dimuat. Coba kembali.');
      };
      timer = setTimeout(() => {
        finish();
        toast('Backtest melebihi batas waktu. Coba sampel lebih kecil melalui skrip lokal.');
      }, 15000);
      worker.postMessage(history);
    } catch {
      finish();
      toast('Browser belum dapat menjalankan backtest.');
    }
  });
}
