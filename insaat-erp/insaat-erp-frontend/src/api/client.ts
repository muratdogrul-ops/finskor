const rawBase =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE) || "";

/** Masaüstü: VITE_API_BASE (örn. http://127.0.0.1:3000). Web: boş → aynı kök / Vite proxy. */
export function apiPath(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = rawBase.replace(/\/+$/, "");
  if (base) return `${base}/api/v1${p}`;
  return `/api/v1${p}`;
}

export function authHeaders(): HeadersInit {
  const t = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(apiPath(path), { headers: authHeaders() });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message || r.statusText);
  }
  return (await r.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(apiPath(path), { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message || r.statusText);
  }
  return (await r.json()) as T;
}

export async function loginRequest(email: string, sifre: string) {
  const r = await fetch(apiPath("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, sifre }),
  });
  const j = (await r.json()) as { success: boolean; data?: { token: string }; message?: string };
  if (!r.ok || !j.success || !j.data?.token) {
    throw new Error(j.message || "Giriş başarısız");
  }
  localStorage.setItem("token", j.data.token);
  return j.data;
}
