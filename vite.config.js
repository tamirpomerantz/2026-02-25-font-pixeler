import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// BASE_PATH must match your GitHub Pages URL: https://<user>.github.io/<repo-name>/
// In CI we set it from the repo name; locally default to /font-pixeler/
const base = process.env.BASE_PATH || '/font-pixeler/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
