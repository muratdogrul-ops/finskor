/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  /** Tam URL: örn. https://site.netlify.app/nakit_akis.html — boşsa /nakit_akis.html (public) */
  readonly VITE_NAKITFLOW_URL?: string;
  /** Fininsaat ERP iframe kaynağı — boşsa /fininsaat_erp.html (public), NakitFlow ile aynı model */
  readonly VITE_FININSAAT_ERP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  insaatErp?: { platform: string };
}
