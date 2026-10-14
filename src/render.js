import { category, colors } from './data.js';
import { INITIAL_BALANCE, STAKE, statistics } from './model.js';

export const $ = (id) => document.getElementById(id);
export function text(id, value) {
  if ($(id).textContent !== String(value)) $(id).textContent = value;
}
const number = (value) => value.toLocaleString('id-ID');
function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}
function cell(row, content) {
  const td = element('td');
  td.append(content);
  row.append(td);
  return td;
}

export function renderSession(session) {
  const total = session.win + session.lose;
  text('scTotal', number(total));
  text('scWin', `${number(session.win)} WIN`);
  text('scLose', `${number(session.lose)} LOSE`);
  text('scRate', total ? `${((100 * session.win) / total).toFixed(1).replace('.', ',')}%` : '—');
  text('scSaldo', number(INITIAL_BALANCE + STAKE * (session.win - session.lose)));
  text('sessionMeta', `Sesi tab ini · ${number(session.missed)} terlewat · total tetap tersimpan`);
  text('sessionCount', `${Math.min(30, session.rows.length)} catatan terbaru`);
  $('sessionEmpty').hidden = session.rows.length > 0;
  const fragment = document.createDocumentFragment();
  for (const entry of session.rows.slice(0, 30)) {
    const tr = element('tr');
    const issue = cell(tr, entry.issue.slice(-5));
    issue.append(element('small', entry.issue));
    cell(tr, entry.prediction);
    cell(tr, entry.result === null ? '—' : `${entry.result} · ${category(entry.result)}`);
    const labels = { win: 'WIN', lose: 'LOSE', pending: 'Menunggu', missed: 'Terlewat' };
    cell(tr, element('span', labels[entry.status], `badge ${entry.status}`));
    fragment.append(tr);
  }
  $('sessionBody').replaceChildren(fragment);
}

export function renderHistory(history, storedCount) {
  const fragment = document.createDocumentFragment();
  for (const entry of history) {
    const tr = element('tr');
    cell(tr, entry.p);
    cell(
      tr,
      element('span', String(entry.h), `result-digit ${entry.h % 2 ? 'color-green' : 'color-red'}`),
    );
    cell(tr, category(entry.h));
    cell(tr, colors(entry.h).join(' + '));
    fragment.append(tr);
  }
  $('historyBody').replaceChildren(fragment);
  $('historyEmpty').hidden = history.length > 0;
  $('historyEmpty').querySelector('h3').textContent = storedCount
    ? 'Tidak ada hasil yang cocok'
    : 'Belum ada hasil';
  $('historyEmpty').querySelector('p').textContent = storedCount
    ? 'Coba ubah pencarian atau kategori.'
    : 'Hasil akan tersedia setelah layanan terhubung.';
  text('historyCount', `${history.length} ditampilkan / ${storedCount} tersimpan`);
  $('exportButton').disabled = history.length === 0;
}

export function renderRecent(history) {
  const fragment = document.createDocumentFragment();
  for (const entry of history.slice(0, 10)) {
    const color = entry.h % 2 ? 'green' : 'red';
    const node = element(
      'span',
      String(entry.h),
      `ball ${color}${[0, 5].includes(entry.h) ? ' violet' : ''}`,
    );
    node.title = `${entry.p} · ${category(entry.h)} · ${colors(entry.h).join(' + ')}`;
    node.setAttribute('aria-label', node.title + ` · angka ${entry.h}`);
    fragment.append(node);
  }
  if (!history.length) fragment.append(element('p', 'Menunggu hasil terbaru…', 'muted'));
  $('recentResults').replaceChildren(fragment);
  text('lastResult', history.length ? `${history[0].h} · ${category(history[0].h)}` : '—');
  text(
    'lastResultPeriod',
    history.length ? `Periode ${history[0].p}` : 'Belum ada periode terkonfirmasi.',
  );
}

export function renderStats(history) {
  const stats = statistics(history);
  text(
    'statsMeta',
    stats.total
      ? `Berdasarkan ${number(stats.total)} hasil yang tersimpan, terbaru dahulu.`
      : 'Belum ada data untuk dianalisis.',
  );
  const chart = document.createDocumentFragment();
  const max = Math.max(1, ...stats.frequency);
  stats.frequency.forEach((count, digit) => {
    const column = element('div', undefined, 'frequency-column');
    column.setAttribute('aria-label', `Angka ${digit}: ${count} kali`);
    const bar = element('div', undefined, `frequency-bar${digit % 2 ? '' : ' red'}`);
    bar.style.height = `${(count / max) * 115}px`;
    bar.setAttribute('aria-hidden', 'true');
    column.append(
      element('span', String(count), 'frequency-number'),
      bar,
      element('span', String(digit), 'frequency-label'),
    );
    chart.append(column);
  });
  $('frequencyChart').replaceChildren(chart);
  text('bigValue', stats.big);
  text('smallValue', stats.small);
  const percent = stats.total ? Math.round((100 * stats.big) / stats.total) : 0;
  $('sizeRatio').value = percent;
  text(
    'ratioText',
    stats.total ? `${percent}% besar · ${100 - percent}% kecil` : 'Belum ada sampel',
  );
  text('streakValue', stats.total ? `${stats.streak.category} × ${stats.streak.count}` : '—');
  text(
    'streakNote',
    stats.total
      ? `Terpanjang: besar ${stats.maxBig} / kecil ${stats.maxSmall}`
      : 'Belum ada sampel',
  );
  const colorClasses = { Hijau: 'color-green', Merah: 'color-red', Ungu: 'color-violet' };
  $('colorSummary').replaceChildren(
    ...Object.entries(stats.colors).map(([label, count]) =>
      element('span', `${label} · ${count}`, `badge ${colorClasses[label]}`),
    ),
  );
}

export function setupTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function select(tab, focus = false) {
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      $(item.getAttribute('aria-controls')).hidden = !selected;
    }
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const next = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index + tabs.length - 1) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      }[event.key];
      if (next !== undefined) {
        event.preventDefault();
        select(tabs[next], true);
      }
    });
  });
}
