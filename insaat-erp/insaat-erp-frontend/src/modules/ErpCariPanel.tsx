import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

export function ErpCariPanel() {
  const [cari, setCari] = useState<unknown[] | null>(null);
  const [stok, setStok] = useState<unknown[] | null>(null);
  const [kb, setKb] = useState<unknown | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      try {
        const [a, b, c] = await Promise.all([
          apiGet<{ data: unknown[] }>("/erp/cari"),
          apiGet<{ data: unknown[] }>("/erp/stok"),
          apiGet<{ data: { kasalar: unknown[]; bankalar: unknown[] } }>("/erp/kasa-banka"),
        ]);
        setCari(a.data);
        setStok(b.data);
        setKb(c.data);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "ERP uç noktaları yanıt vermiyor (migration 004 gerekir)");
        setCari([]);
        setStok([]);
        setKb(null);
      }
    })();
  }, []);

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;
  if (!cari || !stok) return <p>Yükleniyor…</p>;

  return (
    <div>
      <h3>Cari (örnek liste)</h3>
      <pre style={{ maxHeight: 200, overflow: "auto" }}>{JSON.stringify(cari, null, 2)}</pre>
      <h3>Stok kalemleri</h3>
      <pre style={{ maxHeight: 200, overflow: "auto" }}>{JSON.stringify(stok, null, 2)}</pre>
      <h3>Kasa / banka</h3>
      <pre style={{ maxHeight: 200, overflow: "auto" }}>{JSON.stringify(kb, null, 2)}</pre>
    </div>
  );
}
