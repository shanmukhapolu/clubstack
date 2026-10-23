import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Extra hosts can be supplied at runtime with
    // __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS (needed by remote previews).
    allowedHosts: [],
  },
})
