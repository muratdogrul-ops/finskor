'use strict';

const { sbRequest } = require('./vakif-mpi-shared');

/** @returns {Promise<boolean>} true = satır oluştu; false = kart akışı poll edilemez (SERVICE_KEY + migration şart) */
async function insertRunningJob(jobId) {
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

async function finishJobOk(jobId, payload) {
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

async function finishJobErr(jobId, errPayload) {
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

async function fetchMpiEnrollJob(jobId) {
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

module.exports = { insertRunningJob, finishJobOk, finishJobErr, fetchMpiEnrollJob };
