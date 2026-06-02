import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/airdrop-token-claim/",
  root: "demo",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
