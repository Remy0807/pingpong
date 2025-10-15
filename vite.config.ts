import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "https://pingpong-vu5r.onrender.com",
    },
  },
  build: {
    outDir: "dist",
  },
});
