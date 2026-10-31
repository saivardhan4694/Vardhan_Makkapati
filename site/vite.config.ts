import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// GitHub Pages can't send response headers, so the Content-Security-Policy
// ships as a <meta> tag. Build only: the dev server injects inline scripts
// (React refresh) that this policy would block.
function csp(agentApiUrl: string): Plugin {
  const connect = ["'self'", "https://challenges.cloudflare.com"]
  if (agentApiUrl) connect.push(new URL(agentApiUrl).origin)
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    // GSAP and React write inline style attributes.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const agentApiUrl = (process.env.VITE_AGENT_API_URL ?? env.VITE_AGENT_API_URL ?? '').trim()
  return {
    // Relative base so the built assets resolve correctly whatever subpath
    // GitHub Pages serves this repo under (e.g. username.github.io/repo/).
    base: './',
    plugins: [react(), csp(agentApiUrl)],
  }
})
