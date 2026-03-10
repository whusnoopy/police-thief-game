import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "localhost",
    port: 4173,
    strictPort: true,
  },
});
