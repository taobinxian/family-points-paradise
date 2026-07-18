import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET =
  process.env.VITE_API_TARGET || `http://localhost:${process.env.PORT || 8787}`

// https://vitejs.dev/config/
export default defineConfig({
  // 部署到子路径时用 APP_BASE 指定（如 /jifen/），默认根路径
  base: process.env.APP_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
})
