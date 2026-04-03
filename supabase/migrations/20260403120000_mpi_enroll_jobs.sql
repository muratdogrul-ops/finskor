-- MPI enrollment async sonuç (Netlify background + polling). Service role ile yazılır.
CREATE TABLE IF NOT EXISTS public.mpi_enroll_jobs (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending',
  result_json jsonb,
  error_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpi_enroll_jobs_status ON public.mpi_enroll_jobs (status, updated_at);

ALTER TABLE public.mpi_enroll_jobs ENABLE ROW LEVEL SECURITY;
