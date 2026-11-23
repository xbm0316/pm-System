import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import stylex from '@stylexjs/unplugin/vite'

export default defineConfig({
  plugins: [stylex(), react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/__local-files': {
        target: 'http://127.0.0.1:4174',
        rewrite: (path) => path.replace(/^\/__local-files/, ''),
      },
    },
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
    proxy: {
      '/__local-files': {
        target: 'http://127.0.0.1:4174',
        rewrite: (path) => path.replace(/^\/__local-files/, ''),
      },
    },
  },
})
