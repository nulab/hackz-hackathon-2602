import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  base: "/hackz-hackathon-2602/admin/",
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      "/peerjs": { target: "http://localhost:3000", ws: true },
    },
  },
});
