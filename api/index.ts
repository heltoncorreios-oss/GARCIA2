import express from 'express';
import { apiRouter } from '../server/routes.js';

const app = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'Gestão Financeira Supermercado' });
});

// Route handlers for both /api and root paths in Vercel Serverless Function
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
