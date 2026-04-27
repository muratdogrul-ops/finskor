import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

type Row = { id: string; no: string; tutar: number; durum: string; santiye_adi?: string };

export function HakedisList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet<{ success: boolean; data: Row[] }>("/hakedisler?limit=30");
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
      <h3>Hakedişler (son 30)</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">No</th>
            <th align="left">Şantiye</th>
            <th align="right">Tutar</th>
            <th align="left">Durum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id}>
              <td>{h.no}</td>
              <td>{h.santiye_adi ?? "—"}</td>
              <td align="right">{h.tutar}</td>
              <td>{h.durum}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
