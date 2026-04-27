import { useState } from "react";
import { loginRequest } from "../api/client";

type Props = { onLoggedIn: () => void };

export function LoginForm({ onLoggedIn }: Props) {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await loginRequest(email.trim(), sifre);
      onLoggedIn();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 400 }}>
      <h2>Giriş</h2>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <label>
        E-posta
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: "block", width: "100%", marginBottom: 8 }} />
      </label>
      <label>
        Şifre
        <input type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} required style={{ display: "block", width: "100%", marginBottom: 8 }} />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? "…" : "Giriş"}
      </button>
    </form>
  );
}
