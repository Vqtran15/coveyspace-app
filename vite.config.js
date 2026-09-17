import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      manifest: false,
      registerType: 'prompt',
      injectRegister: null,
      devOptions: { enabled: false },
      // Exclude heavy admin/optional chunks from the SW precache so all
      // users don't download them on install (~1 MB saved).
      // These chunks are loaded on-demand via lazy() when actually needed.
      injectManifest: {
        globIgnores: [
          'assets/*ChurchSettings*',
          'assets/*emoji-picker*',
          'assets/*GuideTab*',
          'assets/*AdminPage*',
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react'
          if (id.includes('node_modules/react-router')) return 'vendor-router'
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
        },
      },
    },
  },
})
