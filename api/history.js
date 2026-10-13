// GET /api/history — riwayat hasil Win Go 30s (bulk, sekali panggil).
// Mengambil beberapa halaman GetNoaverageEmerdList sekaligus lalu menggabung
// dan mendedup berdasarkan issueNumber. Dipakai frontend untuk membangun
// riwayat lokal (localStorage) saat pertama dibuka; update berikutnya cukup
// lewat /api biasa tiap 2 detik.

const BACKEND = "https://newapi.55lottertttapi.com/api/webapi/GetNoaverageEmerdList";

// Ambil kredensial body yang sama seperti api/index.js
const BASE_BODY = {
  typeId: 30,
  language: 0,
  random: "b631eb26bac6403e99093913e5bb48c5",
  signature: "A6203E85132E5FE26B5F43DDF1ECDD07",
  timestamp: 1737252405
};

const PAGES = 10;      // 10 halaman ...
const PAGE_SIZE = 10;  // ... @10 baris = ~100 ronde terbaru

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    const jobs = [];
    for (let pageNo = 1; pageNo <= PAGES; pageNo++) {
      jobs.push(
        fetch(BACKEND, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...BASE_BODY, pageSize: PAGE_SIZE, pageNo })
        })
          .then((r) => r.json())
          .catch(() => null)
      );
    }

    const pages = await Promise.all(jobs);

    const seen = new Set();
    const list = [];
    for (const j of pages) {
      for (const e of j?.data?.list || []) {
        if (!e?.issueNumber || seen.has(e.issueNumber)) continue;
        seen.add(e.issueNumber);
        const hasil = parseInt(String(e.number).split(",").pop(), 10);
        if (Number.isNaN(hasil)) continue;
        list.push({
          issueNumber: e.issueNumber,
          number: e.number,
          hasil,
          colour: e.colour || ""
        });
      }
    }

    // Terbaru dulu (issueNumber format tetap, string compare aman)
    list.sort((a, b) => String(b.issueNumber).localeCompare(String(a.issueNumber)));

    return res.status(200).json({ count: list.length, list });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
