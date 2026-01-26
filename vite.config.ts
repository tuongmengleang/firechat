import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import tailwindcss from '@tailwindcss/vite'
import eruda from 'vite-plugin-eruda'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
      vue(),
      eruda({
          // 1. Enable by default in 'dev', but require a flag in 'production'
          debug: process.env.NODE_ENV === 'development' || process.env.VITE_USE_ERUDA === 'true',
      }),
      AutoImport({
          // Auto import functions from Vue, Vue Router, etc.
          imports: [
              'vue',
              'vue-router',
              'pinia'
          ],
          dts: 'src/auto-imports.d.ts', // Generates TypeScript declarations
      }),
      Components({
          // Auto import components from your src/components folder
          dirs: ['src/components'],
          extensions: ['vue'],
          dts: 'src/components.d.ts', // Generates TypeScript declarations
      }),
      tailwindcss(),
  ],
    resolve: {
      alias: {
          '@': fileURLToPath(new URL('./src', import.meta.url)),
      }
    },
})
