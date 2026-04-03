/**
 * Netlify Background Function — MPI enrollment (uzun banka çağrısı).
 * İstemci 202 alır; sonuç Supabase mpi_enroll_jobs + vakifbank-mpi-enroll-status ile okunur.
 * URL: /.netlify/functions/vakifbank-mpi-enroll-worker-background
 */
'use strict';

const { runMpiEnroll, corsHeaders } = require('./vakifbank-mpi-enroll');
const { insertRunningJob, finishJobOk, finishJobErr } = require('./mpi-enroll-jobs');

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

async function persistJobOk(jobId, payload) {
  try {
    await finishJobOk(jobId, payload);
  } catch (e) {
    console.error('finishJobOk başarısız', e);
    try {
      await finishJobErr(jobId, {
        ok: false,
        code: 'JOB_PERSIST_FAILED',
        message: 'MPI tamamlandı ama sonuç kaydedilemedi: ' + String(e.message || e),
      });
    } catch (e2) {
      console.error('finishJobErr (yedek) başarısız', e2);
    }
  }
}

async function persistJobErr(jobId, payload) {
  try {
    await finishJobErr(jobId, payload);
  } catch (e) {
    console.error('finishJobErr başarısız', e);
  }
}

function encFromLambdaHeaders(headers) {
  if (!headers) return null;
  const sc = headers['Set-Cookie'] || headers['set-cookie'];
  const one = Array.isArray(sc) ? sc[0] : String(sc || '');
  const m = one.match(/finskor_mpi=([^;]+)/);
  return m ? m[1].trim() : null;
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 202, headers: corsHeaders(origin), body: '{}' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    const m = String(event.body || '').match(/"jobId"\s*:\s*"([^"]+)"/);
    const jid = m && UUID_RE.test(m[1]) ? m[1] : null;
    if (jid) await persistJobErr(jid, { ok: false, message: 'Geçersiz JSON gövdesi' });
    return { statusCode: 202, headers: corsHeaders(origin), body: '{}' };
  }

  const jobId = body.jobId;
  if (!jobId || !UUID_RE.test(String(jobId))) {
    return { statusCode: 202, headers: corsHeaders(origin), body: '{}' };
  }

  const dbOk = await insertRunningJob(jobId);
  if (!dbOk) {
    console.error(
      'MPI arka plan: mpi_enroll_jobs yazılamadı. Netlify’da SUPABASE_SERVICE_KEY tanımlayın ve Supabase’de migration 20260403120000_mpi_enroll_jobs.sql çalıştırın.'
    );
    return { statusCode: 202, headers: corsHeaders(origin), body: '{}' };
  }

  try {
    const res = await runMpiEnroll(event);
    const txt = res.body || '';
    let j;
    try {
      j = JSON.parse(txt);
    } catch {
      await persistJobErr(jobId, {
        ok: false,
        message: 'Sunucu yanıtı JSON değil',
        rawHead: String(txt).slice(0, 400),
      });
      return { statusCode: 202, headers: corsHeaders(origin), body: JSON.stringify({ jobId }) };
    }

    if (res.statusCode === 200 && j.ok) {
      const encCtx = encFromLambdaHeaders(res.headers || {});
      if (!encCtx) {
        await persistJobErr(jobId, { ok: false, message: 'MPI oturum çerezi oluşturulamadı.' });
      } else {
        await persistJobOk(jobId, {
          ok: true,
          acsUrl: j.acsUrl,
          paReq: j.paReq,
          md: j.md,
          termUrl: j.termUrl,
          encCtx,
        });
      }
    } else {
      const errPayload =
        typeof j === 'object' && j !== null
          ? { ...j }
          : { ok: false, message: 'Bilinmeyen hata' };
      if (res.statusCode && res.statusCode !== 200) errPayload.httpStatus = res.statusCode;
      await persistJobErr(jobId, errPayload);
    }
  } catch (e) {
    console.error('mpi worker', e);
    await persistJobErr(jobId, { ok: false, message: String(e.message || e) });
  }

  return { statusCode: 202, headers: corsHeaders(origin), body: JSON.stringify({ accepted: true, jobId }) };
};
