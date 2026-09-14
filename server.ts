import 'dotenv/config';
import express from 'express';
import path from 'path';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON payload parser
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // API Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), app: 'Gestão Financeira Supermercado' });
  });

  // Mount API routes
  app.use('/api', apiRouter);

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    let localIp = 'localhost';
    try {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
          if (net.family === 'IPv4' && !net.internal) {
            localIp = net.address;
            break;
          }
        }
        if (localIp !== 'localhost') break;
      }
    } catch {}

    console.log(`\n============================================================`);
    console.log(`[Supermercado Financeiro] Servidor ativo e rodando!`);
    console.log(`> Neste computador:  http://localhost:${PORT}`);
    console.log(`> Na rede local:     http://${localIp}:${PORT}`);
    console.log(`============================================================\n`);
  });
}

startServer();
