import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-server-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && (req.url === '/api' || req.url.startsWith('/api/'))) {
            try {
              const { default: app } = await server.ssrLoadModule('./server/index.ts');
              return app(req, res, next);
            } catch (err) {
              console.error('[Vite API Middleware] Error invoking server route:', err);
              next(err);
            }
          } else {
            next();
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
