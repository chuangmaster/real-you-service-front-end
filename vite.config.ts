import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Vite's default host binds IPv6 loopback (::1) only; VS Code's port
    // forwarding / dev tunnels connect over IPv4 (127.0.0.1) and can't reach
    // that, causing a 502 at the tunnel relay. Binding all interfaces fixes it.
    host: true,
    // Allows the Vite dev server to accept requests forwarded through a
    // VS Code dev tunnel or ngrok (needed to test the /order LIFF page from
    // inside the LINE app, since LIFF requires an HTTPS endpoint).
    allowedHosts: ['.devtunnels.ms', '.ngrok-free.dev', '.ngrok-free.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '^/product/.+/share$': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/product\/(.+)\/share$/, '/api/public/inventory/$1/share'),
      }
    }
  }
})
