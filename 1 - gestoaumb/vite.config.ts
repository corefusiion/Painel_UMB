import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/webhook": {
        target: "http://127.0.0.1:3002",
        changeOrigin: true,
      },
      "/status-webhook": {
        target: "http://127.0.0.1:3002",
        rewrite: (path) => path.replace(/^\/status-webhook/, "/status"),
        changeOrigin: true,
      },
      "/purge-test": {
        target: "http://127.0.0.1:3002",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
