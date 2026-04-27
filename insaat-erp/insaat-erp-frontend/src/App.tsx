import { useState, useCallback } from "react";
import { LoginForm } from "./modules/LoginForm";
import { SantiyeList } from "./modules/SantiyeList";
import { HakedisList } from "./modules/HakedisList";
import { HakedisCreateForm } from "./modules/HakedisCreateForm";
import { ErpCariPanel } from "./modules/ErpCariPanel";
import { apiGet } from "./api/client";

type Tab = "santiyeler" | "hakedis" | "hakedis-yeni" | "erp";

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [tab, setTab] = useState<Tab>("santiyeler");
  const [selectedSantiyeId, setSelectedSantiyeId] = useState("");

  const onLoggedIn = useCallback(() => {
    setToken(localStorage.getItem("token"));
    void (async () => {
      try {
        const r = await apiGet<{ data: { id: string }[] }>("/santiyeler?limit=1");
        if (r.data[0]) setSelectedSantiyeId(r.data[0].id);
      } catch {
        setSelectedSantiyeId("");
      }
    })();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  if (!token) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>İnşaat ERP (demo modüller)</h1>
        <LoginForm onLoggedIn={onLoggedIn} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 960, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>İnşaat ERP</h1>
        <button type="button" onClick={logout}>
          Çıkış
        </button>
      </header>
      <nav style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(
          [
            ["santiyeler", "Şantiyeler"],
            ["hakedis", "Hakediş listesi"],
            ["hakedis-yeni", "Hakediş ekle (CRUD)"],
            ["erp", "Cari / stok / kasa"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} disabled={tab === k} style={{ fontWeight: tab === k ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "santiyeler" && <SantiyeList />}
      {tab === "hakedis" && <HakedisList />}
      {tab === "hakedis-yeni" && (
        <div>
          <label>
            Şantiye UUID (listeden kopyala veya otomatik: ilk kayıt)
            <input
              value={selectedSantiyeId}
              onChange={(e) => setSelectedSantiyeId(e.target.value)}
              style={{ display: "block", width: "100%", marginBottom: 8 }}
            />
          </label>
          <HakedisCreateForm
            santiyeId={selectedSantiyeId}
            onCreated={() => {
              setTab("hakedis");
            }}
          />
        </div>
      )}
      {tab === "erp" && <ErpCariPanel />}
    </div>
  );
}
