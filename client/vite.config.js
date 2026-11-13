import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin API calls in dev so the httpOnly SameSite=strict cookie just works.
    proxy: { "/api": { target: "http://localhost:5000", changeOrigin: false } },
    headers: {
      // Needed for the Google sign-in popup to return the credential.
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  build: { sourcemap: false },
});

