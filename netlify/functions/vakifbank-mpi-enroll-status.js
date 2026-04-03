/**
 * MPI async job durumu — hızlı GET; tamamlandığında Set-Cookie (finskor_mpi) + ACS alanları.
 */
'use strict';

const { fetchMpiEnrollJob } = require('./mpi-enroll-jobs');
const { buildMpiSessionCookie } = require('./vakif-mpi-shared');

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

function statusCors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: statusCors(origin), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: statusCors(origin), body: 'Method Not Allowed' };
  }

  /* Netlify / API Gateway sorgu anahtarlarını küçük harfe indirger → jobId okunmazsa poll 2 dk boşa döner */
  const qp = event.queryStringParameters || {};
  const jobId = String(qp.jobId || qp.jobid || '').trim();
  if (!jobId || !UUID_RE.test(String(jobId))) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...statusCors(origin) },
      body: JSON.stringify({ ok: false, message: 'jobId (UUID) gerekli' }),
    };
  }

  let row;
  try {
    row = await fetchMpiEnrollJob(jobId);
  } catch (e) {
    console.error('mpi status fetch', e);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', ...statusCors(origin) },
      body: JSON.stringify({ ok: false, message: 'Durum okunamadı (Supabase).' }),
    };
  }

  if (!row) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...statusCors(origin) },
      body: JSON.stringify({ pending: true, unknown: true }),
    };
  }

  if (row.status === 'running' || row.status === 'pending') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...statusCors(origin) },
      body: JSON.stringify({ pending: true }),
    };
  }

  if (row.status === 'error') {
    const err = row.error_json;
    const out =
      err && typeof err === 'object' ? err : { ok: false, message: err ? String(err) : 'MPI hata' };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...statusCors(origin) },
      body: JSON.stringify({ ...out, ok: false }),
    };
  }

  if (row.status === 'done' && row.result_json && row.result_json.ok && row.result_json.encCtx) {
    const r = row.result_json;
    const cookie = buildMpiSessionCookie(r.encCtx);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...statusCors(origin),
        'Set-Cookie': cookie,
      },
      body: JSON.stringify({
        ok: true,
        acsUrl: r.acsUrl,
        paReq: r.paReq,
        md: r.md,
        termUrl: r.termUrl,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...statusCors(origin) },
    body: JSON.stringify({ pending: true }),
  };
};
