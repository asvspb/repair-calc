import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => {
  return {
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, './shared'),
      },
    },
    build: {
      // Сохраняем console.log в production для отладки
      minify: 'esbuild',
    },
    esbuild: {
      // Не удалять console.log при минификации
      drop: [],
    },
    server: {
      port: 3993,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ"file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
