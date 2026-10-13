// GET /api/history — riwayat hasil Win Go 30s terbaru.
// Catatan: backend 55five hanya mengembalikan 10 ronde terakhir untuk
// endpoint GetNoaverageEmerdList (pageNo > 1 kosong, pageSize > 10 ditolak),
// jadi endpoint ini mengembalikan 10 ronde terbaru dalam format standar
// { issueNumber, number, hasil, colour }. Riwayat bulk yang sebenarnya
// berasal dari data/riwayat.json (snapshot studi, di-seed saat start).

const BACKEND = "https://newapi.55lottertttapi.com/api/webapi/GetNoaverageEmerdList";

// Kredensial body yang sama seperti api/index.js
const BASE_BODY = {
  typeId: 30,
  language: 0,
  random: "b631eb26bac6403e99093913e5bb48c5",
  signature: "A6203E85132E5FE26B5F43DDF1ECDD07",
  timestamp: 1737252405
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    const r = await fetch(BACKEND, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...BASE_BODY, pageSize: 10, pageNo: 1 })
    });
    const j = await r.json().catch(() => null);

    const seen = new Set();
    const list = [];
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

    // Terbaru dulu (issueNumber format tetap, string compare aman)
    list.sort((a, b) => String(b.issueNumber).localeCompare(String(a.issueNumber)));

    return res.status(200).json({ count: list.length, list });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
