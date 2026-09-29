import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'EventHub',
        short_name: 'EventHub',
        description: 'Event and interview management platform',
        theme_color: '#3a56e8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',

        icons: [
          {
            src: '/image.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/image.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})