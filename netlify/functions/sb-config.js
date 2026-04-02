'use strict';
/**
 * Netlify ortamında SUPABASE_SERVICE_KEY kullanın (RLS açıkken güvenilir).
 * Yoksa SUPABASE_ANON_KEY; ikisi de yoksa mevcut anon (yerel / geriye dönük).
 */
const DEFAULT_HOST = 'clmqfckposcaqjmbrmuq.supabase.co';
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbXFmY2twb3NjYXFqbWJybXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjE3MDcsImV4cCI6MjA4ODUzNzcwN30.hbCPb5IMcnNcwUXyDkcUrzFKXPUgJrG1XmLXl_aI8T8';

function sbHost() {
  const u = process.env.SUPABASE_URL;
  if (u && /^https?:\/\//i.test(u)) {
    try {
      return new URL(u).hostname;
    } catch (_) {
      /* ignore */
    }
  }
  return DEFAULT_HOST;
}

function sbKey() {
  return process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_ANON;
}

module.exports = { sbHost, sbKey };
