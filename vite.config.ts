import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 相对路径：同一份构建产物可用于 GitHub Pages 子路径、Electron 与 Capacitor
  base: './',
  plugins: [react()],
  // ffmpeg.wasm 内部自己创建 Worker，不能被预构建
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1024 },
});
