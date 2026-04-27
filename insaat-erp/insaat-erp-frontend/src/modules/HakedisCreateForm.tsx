import { useState } from "react";
import { apiPost } from "../api/client";

type Props = { santiyeId: string; onCreated?: () => void };

/** Basit hakediş oluştur (CRUD — gerçek API). no/dönem/ tutar doldur. */
export function HakedisCreateForm({ santiyeId, onCreated }: Props) {
  const [no, setNo] = useState("");
  const [tip, setTip] = useState("ara");
  const [tutar, setTutar] = useState(0);
  const [donemBas, setDonemBas] = useState(() => new Date().toISOString().slice(0, 10));
  const [donemBit, setDonemBit] = useState(() => new Date().toISOString().slice(0, 10));
  const [avans, setAvans] = useState(0);
  const [kesinti, setKesinti] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    try {
      await apiPost("/hakedisler", {
        santiye_id: santiyeId,
        no,
        tip,
        donem_baslangic: donemBas,
        donem_bitis: donemBit,
        tutar,
        notlar: "UI’den",
        avans_tutari: avans,
        kesinti_tutari: kesinti,
        kalemler: [],
      });
      setOk(true);
      onCreated?.();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Kayıt hatası");
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 480 }}>
      <h4>Yeni hakediş</h4>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {ok && <p style={{ color: "green" }}>Oluşturuldu</p>}
      <label>
        No
        <input value={no} onChange={(e) => setNo(e.target.value)} required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Tip
        <input value={tip} onChange={(e) => setTip(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Dönem baş
        <input type="date" value={donemBas} onChange={(e) => setDonemBas(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Dönem bit
        <input type="date" value={donemBit} onChange={(e) => setDonemBit(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Tutar (KDV hariç)
        <input type="number" value={tutar} onChange={(e) => setTutar(Number(e.target.value))} style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Avans
        <input type="number" value={avans} onChange={(e) => setAvans(Number(e.target.value))} style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Kesinti
        <input type="number" value={kesinti} onChange={(e) => setKesinti(Number(e.target.value))} style={{ display: "block", width: "100%" }} />
      </label>
      <p style={{ fontSize: 12, color: "#555" }}>Şantiye: {santiyeId || "— (listeden bir şantiye seçin)"}</p>
      <button type="submit" disabled={!santiyeId}>
        Kaydet
      </button>
    </form>
  );
}
