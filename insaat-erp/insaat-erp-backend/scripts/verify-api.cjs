/**
 * Konsolda: hangi API süreci? (surum, /meta, /health)
 *   node scripts/verify-api.cjs
 *   node scripts/verify-api.cjs http://127.0.0.1:4000
 */
const base = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");

async function get(path) {
  const u = new URL(path, base);
  const r = await fetch(u, { headers: { Accept: "application/json" } });
  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = t;
  }
  return { status: r.status, body: j };
}

const meta = await get("/meta");
const health = await get("/health");
console.log("Adres:", base);
console.log("GET /meta  →", meta.status, meta.body);
console.log("GET /health →", health.status, health.body);
if (meta.status !== 200) {
  console.error("\nHATA: /meta 200 dönmedi. Eski baska proje, yanlis PORT, veya bu kod derlenmiyor.");
  process.exit(1);
}
if (meta.body && meta.body.uygulama === "insaat-erp-backend" && String(meta.body.surum) === "2") {
  console.log("\nOK: insaat-erp-backend surum=2 buna yönleniyor.\n");
} else {
  console.warn("\nDİKKAT: Cevap beklenen /meta sürümü değil. Çalışan süreç farklı olabilir.\n");
}
