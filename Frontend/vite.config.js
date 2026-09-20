import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend (Phong's FastAPI app) chưa bật CORSMiddleware.
      // Thay vì đụng code Backend, mình để Vite dev server làm proxy:
      // browser gọi "/api/recommend" (cùng origin với localhost:5173,
      // không bị CORS chặn) -> Vite forward request đó sang
      // http://127.0.0.1:8000/recommend ở phía server (server-to-server
      // không bị CORS chi phối, CORS chỉ áp dụng cho browser).
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
