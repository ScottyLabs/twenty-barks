import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In production the server serves this app from its own origin. The dev server proxies /api to the local server to keep that same-origin setup.
const devApiTarget = "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": { target: devApiTarget, changeOrigin: true },
    },
  },
});
