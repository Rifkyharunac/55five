// Ambil 10 ronde terbaru Win Go 30s dari backend 55five, gabung ke
// data/riwayat.json (dedupe berdasarkan periode, urut kronologis).
// Dipakai workflow .github/workflows/update-riwayat.yml tiap 30 menit.
// Format file dipertahankan: JSON compact satu baris, [{p, h}].
// Bila backend gagal / tidak ada ronde baru, file tidak diubah & exit 0.

import { readFileSync, writeFileSync } from "node:fs";

const BACKEND = "https://newapi.55lottertttapi.com/api/webapi/GetNoaverageEmerdList";
// Body yang sama seperti api/index.js
const BODY = {
  typeId: 30,
  language: 0,
  random: "b631eb26bac6403e99093913e5bb48c5",
  signature: "A6203E85132E5FE26B5F43DDF1ECDD07",
  timestamp: 1737252405,
  pageSize: 10,
  pageNo: 1
};

const FILE = "data/riwayat.json";

const res = await fetch(BACKEND, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(BODY)
});
if (!res.ok) {
  console.error("Backend error, HTTP", res.status);
  process.exit(1);
}
const j = await res.json().catch(() => null);
const list = j?.data?.list || [];
if (!list.length) {
  console.log("Backend tidak mengembalikan ronde — file tidak diubah.");
  process.exit(0);
}

const data = JSON.parse(readFileSync(FILE, "utf8"));
const seen = new Set(data.map((e) => e.p));
let added = 0;
for (const e of list) {
  const hasil = parseInt(String(e.number).split(",").pop(), 10);
  if (!e?.issueNumber || seen.has(e.issueNumber) || Number.isNaN(hasil)) continue;
  seen.add(e.issueNumber);
  data.push({ p: e.issueNumber, h: hasil });
  added++;
}
data.sort((a, b) => (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));

if (added > 0) {
  writeFileSync(FILE, JSON.stringify(data));
  console.log(`Ditambah ${added} ronde baru, total ${data.length}.`);
} else {
  console.log("Tidak ada ronde baru.");
}
