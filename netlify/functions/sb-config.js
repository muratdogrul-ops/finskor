'use strict';
/**
 * Netlify ortamında SUPABASE_SERVICE_KEY kullanın (RLS açıkken güvenilir).
 * Yoksa SUPABASE_ANON_KEY; ikisi de yoksa mevcut anon (yerel / geriye dönük).
 *
 * Host: önce SUPABASE_URL; yoksa JWT içindeki `ref` → {ref}.supabase.co (yanlış projeye
 * istek atılıp mpi_enroll_jobs’un boş kalması / 2 dk poll zaman aşımı önlenir).
 */
const DEFAULT_HOST = 'clmqfckposcaqjmbrmuq.supabase.co';
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbXFmY2twb3NjYXFqbWJybXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjE3MDcsImV4cCI6MjA4ODUzNzcwN30.hbCPb5IMcnNcwUXyDkcUrzFKXPUgJrG1XmLXl_aI8T8';

/** Supabase JWT payload’daki proje ref’i (host ile anahtar eşlemesi için) */
function refFromSupabaseJwt(jwt) {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '==='.slice((b64.length + 3) % 4);
    const payload = JSON.parse(Buffer.from(pad, 'base64').toString('utf8'));
    const ref = payload.ref;
    if (ref && typeof ref === 'string' && /^[a-z0-9]{15,40}$/i.test(ref)) return ref;
  } catch (_) {
    /* ignore */
  }
  return null;
}

function sbHost() {
  const u = process.env.SUPABASE_URL;
  if (u && /^https?:\/\//i.test(u)) {
    try {
      return new URL(u).hostname;
    } catch (_) {
      /* ignore */
    }
  }
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_ANON;
  const ref = refFromSupabaseJwt(key);
  if (ref) return `${ref}.supabase.co`;
  return DEFAULT_HOST;
}

function sbKey() {
  return process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_ANON;
}

module.exports = { sbHost, sbKey };
