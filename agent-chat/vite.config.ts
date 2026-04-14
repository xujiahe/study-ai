import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // 优先读 VITE_API_URL，默认指向 autogen（3001）
  const apiUrl = env.VITE_API_URL || "http://localhost:3001";
  const wsUrl = apiUrl.replace(/^http/, "ws");

  return {
    plugins: [vue()],
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiUrl, changeOrigin: true },
        "/ws":  { target: wsUrl, ws: true },
      },
    },
  };
});
