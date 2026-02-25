import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  base: "/hackz-hackathon-2602/projector/",
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  server: {
    port: 5174,
  },
});
