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
    chunkSizeWarningLimit: 600, // Raise limit slightly to avoid noise
    esbuild: mode === 'production' ? {
      drop: ['console', 'debugger'],
    } : {},
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          'vendor-charts': ['recharts'],
          'vendor-dates': ['date-fns'],
          'vendor-motion': ['framer-motion'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-revenuecat': ['@revenuecat/purchases-capacitor', '@revenuecat/purchases-js'],
        },
      },
    },
  },
}));
