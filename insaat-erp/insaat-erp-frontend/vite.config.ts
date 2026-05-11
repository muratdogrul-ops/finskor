import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const electron = mode === "electron" || env.VITE_ELECTRON === "1";
  return {
    base: electron ? "./" : (env.VITE_APP_BASE || "/"),
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": { target: "http://127.0.0.1:3000", changeOrigin: true } },
    },
  };
});
