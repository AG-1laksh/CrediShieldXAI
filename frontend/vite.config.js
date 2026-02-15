import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('jspdf')) {
            return 'jspdf-vendor';
          }

          if (id.includes('html2canvas') || id.includes('dompurify')) {
            return 'html-capture';
          }

          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts-vendor';
          }

          if (id.includes('@react-oauth/google')) {
            return 'google-auth';
          }

          return 'vendor';
        },
      },
    },
  },
})
