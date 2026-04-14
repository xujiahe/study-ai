import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // 优先读 VITE_API_URL，默认指向 autogen（3001）
  const apiUrl = env.VITE_API_URL || "http://localhost:3001";
  const wsUrl = apiUrl.replace(/^http/, "ws");

  const ragUrl = env.VITE_RAG_URL || "http://localhost:3003";

  return {
    plugins: [vue()],
    server: {
      port: 5173,
      proxy: {
        "/rag/documents": { target: ragUrl, changeOrigin: true, rewrite: (p) => p.replace(/^\/rag/, "") },
        "/rag/retrieve":  { target: ragUrl, changeOrigin: true, rewrite: (p) => p.replace(/^\/rag/, "") },
        "/api": { target: apiUrl, changeOrigin: true },
        "/ws":  { target: wsUrl, ws: true },
      },
    },
  };
});
