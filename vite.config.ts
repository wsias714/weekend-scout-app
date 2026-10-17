import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves a project site from /<repo>/. The workflow sets DEPLOY_TARGET.
const base = process.env.DEPLOY_TARGET === "gh-pages" ? "/weekend-scout-app/" : "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Weekend Scout",
        short_name: "Scout",
        description: "Friday review of weekend ideas for the family.",
        theme_color: "#1f3a2e",
        background_color: "#f6f3ec",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,png,svg}"] },
    }),
  ],
});
