import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Remove console statements in production
    minify: 'esbuild',
    target: 'es2015',
    esbuild: mode === 'production' ? {
      drop: ['console', 'debugger'],
    } : {},
  },
}));
