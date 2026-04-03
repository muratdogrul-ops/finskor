/**
 * MPI async kuyruk teşhisi — tarayıcıdan GET.
 * Örnek: https://SITENIZ.netlify.app/.netlify/functions/mpi-jobs-health
 *
 * job_store=blobs → Netlify Blobs okuma/yazma
 * job_store=supabase → Supabase mpi_enroll_jobs (eski yol)
 */
'use strict';

const crypto = require('crypto');
const { sbRequest } = require('./vakif-mpi-shared');
const { sbHost } = require('./sb-config');
const { jobStoreKind, healthCheckBlobStore } = require('./mpi-enroll-jobs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const host = sbHost();
  const store = jobStoreKind();
  const out = {
    job_store: store,
    rollback_env: 'MPI_ENROLL_JOB_STORE=supabase',
    supabase_api_host: host,
    mpi_blobs_read_write: null,
    mpi_enroll_jobs_select: null,
    mpi_enroll_jobs_insert_delete: null,
    hint: null,
  };

  if (store === 'blobs') {
    out.mpi_blobs_read_write = await healthCheckBlobStore(event);
    out.mpi_blobs_pat_configured = Boolean(
      String(process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_BLOBS_TOKEN || '').trim()
    );
    if (out.mpi_blobs_read_write !== 'ok') {
      out.hint =
        'Blobs başarısızsa Netlify’da Blobs özelliği / deploy bağlamı kontrol edin. Geçici çözüm: ortamda MPI_ENROLL_JOB_STORE=supabase (Supabase mpi_enroll_jobs tablosu gerekir).';
    } else if (!out.mpi_blobs_pat_configured) {
      out.background_hint =
        'mpi-jobs-health sync çalıştı; vakifbank-mpi-enroll-worker-background ayrı çağrıda event.blobs olmayabilir. Kart akışı boşsa Netlify’da NETLIFY_AUTH_TOKEN (PAT) tanımlayın veya MPI_ENROLL_JOB_STORE=supabase.';
    }
  } else {
    const sel = await sbRequest('GET', 'mpi_enroll_jobs?select=id&limit=1');
    if (sel.status === 200 && Array.isArray(sel.data)) {
      out.mpi_enroll_jobs_select = 'ok';
    } else if (sel.status === 401 || sel.status === 403) {
      out.mpi_enroll_jobs_select = 'auth_failed';
      out.hint =
        'JWT bu API hostu ile eşleşmiyor. Netlify’da SUPABASE_SERVICE_KEY doğru projeden mi? İsteğe bağlı SUPABASE_URL=https://PROJE_REF.supabase.co ekleyin.';
    } else {
      out.mpi_enroll_jobs_select = 'fail';
      out.select_http = sel.status;
      out.select_detail = typeof sel.data === 'object' ? sel.data : String(sel.data || '').slice(0, 300);
      out.hint =
        sel.status === 404 || (typeof sel.data === 'object' && sel.data && String(sel.data.message || '').includes('schema'))
          ? 'Tablo yok veya şema önbelleğinde yok. Supabase SQL Editor’da 20260403120000_mpi_enroll_jobs.sql çalıştırın.'
          : 'Supabase REST yanıtı beklenmiyor; select_http ve select_detail’e bakın.';
    }

    if (out.mpi_enroll_jobs_select === 'ok') {
      const testId = crypto.randomUUID();
      const ins = await sbRequest('POST', 'mpi_enroll_jobs', {
        id: testId,
        status: 'pending',
        updated_at: new Date().toISOString(),
      });
      if (ins.status === 201) {
        const del = await sbRequest('DELETE', `mpi_enroll_jobs?id=eq.${encodeURIComponent(testId)}`, null);
        out.mpi_enroll_jobs_insert_delete = [200, 204].includes(del.status) ? 'ok' : `delete_http_${del.status}`;
      } else {
        out.mpi_enroll_jobs_insert_delete = `insert_http_${ins.status}`;
        out.insert_detail = typeof ins.data === 'object' ? ins.data : String(ins.data || '').slice(0, 300);
      }
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(out, null, 2),
  };
};
