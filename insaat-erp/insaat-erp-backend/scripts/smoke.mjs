/**
 * Sıfırdan kurulum sonrası: API ayakta mı? ( /health )
 *   node scripts/smoke.mjs
 *   SMOKE_BASE=https://ornek.com npm run test:smoke
 */
const base = (process.env.SMOKE_BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
const u = new URL("/health", base);
const r = await fetch(u);
if (!r.ok) {
  console.error("smoke FAIL status", r.status, u.href);
  process.exit(1);
}
const j = await r.json();
if (j.status !== "ok" && j.status !== "degraded") {
  console.error("smoke FAIL body", j);
  process.exit(1);
}
console.log("smoke ok", u.href, j);
