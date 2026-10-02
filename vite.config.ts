import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function geminiDevServerPlugin(): Plugin {
  return {
    name: 'gemini-dev-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/api/health' && (req.method === 'GET' || req.method === 'POST')) {
          try {
            const { testGeminiConnection } = await import('./server/geminiService');
            const result = await testGeminiConnection();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = result.ok ? 200 : 500;
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: err?.message || 'Health check failed' }));
          }
          return;
        }
        if ((url === '/api/encourage' || url === '/api/gemini/encourage') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const input = JSON.parse(body || '{}');
              const { generateEncouragement } = await import('./server/geminiService');
              const result = await generateEncouragement(input);
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              console.error('API Error in dev server:', err);
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err?.message || 'Gemini 처리 중 문제가 발생했습니다.' }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiDevServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
