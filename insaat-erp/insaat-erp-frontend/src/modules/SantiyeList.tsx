import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

type Santiye = { id: string; ad: string; il?: string; durum?: string };

export function SantiyeList() {
  const [rows, setRows] = useState<Santiye[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet<{ success: boolean; data: Santiye[] }>("/santiyeler");
        setRows(r.data);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Liste alınamadı");
        setRows([]);
      }
    })();
  }, []);

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;
  if (!rows) return <p>Yükleniyor…</p>;

  return (
    <div>
      <h3>Şantiyeler</h3>
      <ul>
        {rows.map((s) => (
          <li key={s.id}>
            {s.ad} {s.il ? `— ${s.il}` : ""} {s.durum ? `(${s.durum})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
