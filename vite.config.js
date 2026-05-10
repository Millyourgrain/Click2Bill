import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Fix case sensitivity (Utils vs utils) for Linux/Vercel builds
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — cached separately, rarely changes
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Firebase SDK — large and stable
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          // UI icons
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
