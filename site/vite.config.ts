import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built assets resolve correctly whatever subpath
  // GitHub Pages serves this repo under (e.g. username.github.io/repo/).
  base: './',
  plugins: [react()],
})
