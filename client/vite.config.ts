import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const runtimeEnv = loadEnv(mode, process.cwd(), '')
  const appBasePath = runtimeEnv.VITE_APP_BASE_PATH || '/'
  const apiProxyTarget = String(runtimeEnv.VITE_API_PROXY_TARGET || '').trim()

  return {
    base: appBasePath,
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used.
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      ...(apiProxyTarget
        ? {
            proxy: {
              '/api': {
                target: apiProxyTarget,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  }
})
