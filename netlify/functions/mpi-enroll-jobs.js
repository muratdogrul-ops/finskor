'use strict';

/**
 * MPI async job durumu: Netlify Blobs (varsayılan) veya Supabase mpi_enroll_jobs.
 *
 * Geri alma (kod revert gerekmez): Netlify ortamında MPI_ENROLL_JOB_STORE=supabase
 * İsteğe bağlı: MPI_ENROLL_BLOBS_STORE — Blob store adı (varsayılan mpi-enroll-jobs)
 *
 * Blobs: Normal function’da event.blobs vardır (connectLambda). Background function’da
 * genelde yok — o zaman getStore ortamdan veya SITE_ID + NETLIFY_AUTH_TOKEN ile API erişimi.
 */
const { sbRequest } = require('./vakif-mpi-shared');

function jobStoreKind() {
  const v = (process.env.MPI_ENROLL_JOB_STORE || 'blobs').toLowerCase().trim();
  return v === 'supabase' ? 'supabase' : 'blobs';
}

function blobKey(jobId) {
  return `mpi-job/${jobId}`;
}

function getBlobStore(event) {
  const { connectLambda, getStore } = require('@netlify/blobs');
  const name = (process.env.MPI_ENROLL_BLOBS_STORE || 'mpi-enroll-jobs').trim() || 'mpi-enroll-jobs';

  /* Sync function: event.blobs (base64) + başlıklar — connectLambda ortamı kurar */
  if (event && typeof event === 'object' && event.blobs) {
    try {
      connectLambda(event);
    } catch (e) {
      console.error('MPI Blobs connectLambda', e && e.message ? e.message : e);
    }
  }

  try {
    return getStore(name);
  } catch (firstErr) {
    const siteID = String(process.env.SITE_ID || process.env.NETLIFY_SITE_ID || '').trim();
    const token = String(process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_BLOBS_TOKEN || '').trim();
    if (siteID && token) {
      return getStore({ name, siteID, token });
    }
    const msg = firstErr && firstErr.message ? firstErr.message : String(firstErr);
    throw new Error(
      `${msg} — Background MPI için Netlify ortamına NETLIFY_AUTH_TOKEN (Personal Access Token, Blobs) ekleyin veya MPI_ENROLL_JOB_STORE=supabase.`
    );
  }
}

/* ---------- Supabase ---------- */

async function insertRunningJobSupabase(jobId) {
  try {
    const res = await sbRequest('POST', 'mpi_enroll_jobs', {
      id: jobId,
      status: 'running',
      updated_at: new Date().toISOString(),
    });
    if (res.status !== 201) {
      console.error('mpi_enroll_jobs INSERT başarısız', res.status, res.data);
      return false;
    }
    return true;
  } catch (e) {
    console.error('mpi_enroll_jobs INSERT hata', e);
    return false;
  }
}

async function finishJobOkSupabase(jobId, payload) {
  const res = await sbRequest('PATCH', `mpi_enroll_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    status: 'done',
    result_json: payload,
    error_json: null,
    updated_at: new Date().toISOString(),
  });
  if (res.status !== 200 && res.status !== 204) {
    const detail = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
    throw new Error(`mpi_enroll_jobs finishJobOk HTTP ${res.status}: ${detail.slice(0, 500)}`);
  }
}

async function finishJobErrSupabase(jobId, errPayload) {
  const res = await sbRequest('PATCH', `mpi_enroll_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    status: 'error',
    error_json: errPayload,
    updated_at: new Date().toISOString(),
  });
  if (res.status !== 200 && res.status !== 204) {
    const detail = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
    throw new Error(`mpi_enroll_jobs finishJobErr HTTP ${res.status}: ${detail.slice(0, 500)}`);
  }
}

async function fetchMpiEnrollJobSupabase(jobId) {
  let res;
  try {
    res = await sbRequest(
      'GET',
      `mpi_enroll_jobs?id=eq.${encodeURIComponent(jobId)}&select=status,result_json,error_json,updated_at`
    );
  } catch (e) {
    console.error('mpi_enroll_jobs GET ağ hatası', e);
    return null;
  }
  if (res.status === 401 || res.status === 403) {
    console.error(
      'mpi_enroll_jobs GET yetkisiz',
      res.status,
      '— SUPABASE_URL ile proje kökü veya SUPABASE_SERVICE_KEY eşleşmesini kontrol edin.'
    );
    return null;
  }
  if (res.status !== 200 || !Array.isArray(res.data)) {
    if (res.status !== 200) {
      console.error('mpi_enroll_jobs GET beklenmeyen HTTP', res.status, res.data);
    }
    return null;
  }
  return res.data[0] || null;
}

/* ---------- Netlify Blobs ---------- */

async function insertRunningJobBlobs(jobId, event) {
  try {
    const store = getBlobStore(event);
    await store.setJSON(blobKey(jobId), {
      status: 'running',
      result_json: null,
      error_json: null,
      updated_at: new Date().toISOString(),
    });
    return true;
  } catch (e) {
    console.error('mpi_enroll_jobs (Netlify Blobs) yazılamadı', e);
    return false;
  }
}

async function finishJobOkBlobs(jobId, payload, event) {
  const store = getBlobStore(event);
  await store.setJSON(blobKey(jobId), {
    status: 'done',
    result_json: payload,
    error_json: null,
    updated_at: new Date().toISOString(),
  });
}

async function finishJobErrBlobs(jobId, errPayload, event) {
  const store = getBlobStore(event);
  await store.setJSON(blobKey(jobId), {
    status: 'error',
    result_json: null,
    error_json: errPayload,
    updated_at: new Date().toISOString(),
  });
}

async function fetchMpiEnrollJobBlobs(jobId, event) {
  try {
    const store = getBlobStore(event);
    const row = await store.get(blobKey(jobId), { type: 'json' });
    if (!row) return null;
    return {
      status: row.status,
      result_json: row.result_json,
      error_json: row.error_json,
      updated_at: row.updated_at,
    };
  } catch (e) {
    console.error('mpi_enroll_jobs (Netlify Blobs) okunamadı', e);
    return null;
  }
}

/* ---------- Ortak API (event: Blobs için zorunlu) ---------- */

/** @returns {Promise<boolean>} */
async function insertRunningJob(jobId, event) {
  if (jobStoreKind() === 'supabase') return insertRunningJobSupabase(jobId);
  return insertRunningJobBlobs(jobId, event);
}

async function finishJobOk(jobId, payload, event) {
  if (jobStoreKind() === 'supabase') return finishJobOkSupabase(jobId, payload);
  return finishJobOkBlobs(jobId, payload, event);
}

async function finishJobErr(jobId, errPayload, event) {
  if (jobStoreKind() === 'supabase') return finishJobErrSupabase(jobId, errPayload);
  return finishJobErrBlobs(jobId, errPayload, event);
}

async function fetchMpiEnrollJob(jobId, event) {
  if (jobStoreKind() === 'supabase') return fetchMpiEnrollJobSupabase(jobId);
  return fetchMpiEnrollJobBlobs(jobId, event);
}

/** mpi-jobs-health için */
async function healthCheckBlobStore(event) {
  try {
    const store = getBlobStore(event);
    const id = `health-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const key = `mpi-health/${id}`;
    await store.setJSON(key, { t: 1 });
    const v = await store.get(key, { type: 'json' });
    await store.delete(key);
    return v && v.t === 1 ? 'ok' : 'fail';
  } catch (e) {
    console.error('mpi blobs health', e);
    return `fail: ${String(e.message || e).slice(0, 200)}`;
  }
}

module.exports = {
  insertRunningJob,
  finishJobOk,
  finishJobErr,
  fetchMpiEnrollJob,
  jobStoreKind,
  healthCheckBlobStore,
};
