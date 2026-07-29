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
      // Mirrors nginx.conf's Linespider map + `/order` location: only LINE's
      // link-preview crawler gets proxied to the backend's server-rendered
      // order-share HTML; everyone else (including the real LIFF in-app
      // browser) falls through to bypass() and gets the normal SPA.
      '^/order$': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        bypass: (req) => {
          const userAgent = req.headers['user-agent'] || ''
          if (!/Linespider/i.test(userAgent)) {
            return req.url
          }
        },
        rewrite: (path) => path.replace(/^\/order/, '/api/public/orders/share'),
      },
      '^/product/.+/share$': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/product\/(.+)\/share$/, '/api/public/inventory/$1/share'),
      }
    }
  }
})
