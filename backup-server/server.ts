import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Setup local SQLite database for Gateway metadata (clients, tokens, backup logs)
const db = new Database('./gateway_metadata.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    api_token TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    records_count INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(client_id) REFERENCES clients(client_id)
  );
`);

// Setup S3 / MinIO Storage Client
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000', // MinIO or S3 endpoint
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin'
  },
  forcePathStyle: true // Needed for MinIO
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'enterprise-backups';

// Configure Multer for memory storage of uploaded backup payload
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to authenticate client via API Token
const authenticateClient = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente ou inválido.' });
  }

  const token = authHeader.split(' ')[1];
  const client = db.prepare('SELECT * FROM clients WHERE api_token = ? AND is_active = 1').get(token) as any;

  if (!client) {
    return res.status(403).json({ error: 'Token de API inválido ou cliente inativo.' });
  }

  (req as any).client = client;
  next();
};

// ==================== API ROUTES ====================

// 1. Register a new client (Admin route)
app.post('/api/v1/admin/clients', (req: Request, res: Response) => {
  try {
    const { clientName, adminSecret } = req.body;
    if (adminSecret !== (process.env.ADMIN_SECRET || 'super_secret_admin_key')) {
      return res.status(403).json({ error: 'Segredo de administrador inválido.' });
    }

    const clientId = 'cli_' + Math.random().toString(36).substring(2, 9);
    const apiToken = 'bk_tok_' + crypto.randomBytes(32).toString('hex');

    db.prepare('INSERT INTO clients (client_id, client_name, api_token) VALUES (?, ?, ?)').run(
      clientId,
      clientName,
      apiToken
    );

    res.json({
      success: true,
      message: 'Cliente cadastrado com sucesso no servidor de backup.',
      clientId,
      apiToken
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Upload Backup (Client endpoint)
app.post('/api/v1/backups/upload', authenticateClient, upload.single('backupFile'), async (req: Request, res: Response) => {
  try {
    const client = (req as any).client;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo de backup enviado.' });
    }

    // Parse backup package to verify metadata & checksum
    let backupPackage: any;
    try {
      backupPackage = JSON.parse(file.buffer.toString('utf-8'));
    } catch {
      return res.status(400).json({ error: 'O arquivo enviado não é um JSON válido.' });
    }

    const { metadata, data } = backupPackage;
    if (!metadata || !data) {
      return res.status(400).json({ error: 'Estrutura de backup corporativo inválida.' });
    }

    const checksum = metadata.checksum || crypto.createHash('sha256').update(file.buffer).digest('hex');
    const recordsCount = metadata.totalTransactions || (data.transactions || []).length;
    const backupId = 'bk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const storagePath = `${client.client_id}/${backupId}.json`;

    // Upload to MinIO / S3 Object Storage
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storagePath,
        Body: file.buffer,
        ContentType: 'application/json'
      })
    );

    // Save record in SQLite database
    db.prepare(
      'INSERT INTO backup_records (id, client_id, file_name, file_size, checksum, records_count, storage_path) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      backupId,
      client.client_id,
      file.originalname || `backup_${backupId}.json`,
      file.size,
      checksum,
      recordsCount,
      storagePath
    );

    res.json({
      success: true,
      message: 'Backup corporativo armazenado com sucesso na nuvem.',
      backupId,
      checksum,
      recordsCount
    });
  } catch (err: any) {
    console.error('Backup upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. List Backups for Client
app.get('/api/v1/backups', authenticateClient, (req: Request, res: Response) => {
  try {
    const client = (req as any).client;
    const records = db.prepare(
      'SELECT id, file_name, file_size, checksum, records_count, created_at FROM backup_records WHERE client_id = ? ORDER BY created_at DESC'
    ).all(client.client_id);

    res.json({ success: true, backups: records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Download Specific Backup
app.get('/api/v1/backups/:id/download', authenticateClient, async (req: Request, res: Response) => {
  try {
    const client = (req as any).client;
    const backupId = req.params.id;

    const record = db.prepare(
      'SELECT * FROM backup_records WHERE id = ? AND client_id = ?'
    ).get(backupId, client.client_id) as any;

    if (!record) {
      return res.status(404).json({ error: 'Registro de backup não encontrado.' });
    }

    const s3Response = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: record.storage_path
      })
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${record.file_name}"`);

    if (s3Response.Body) {
      (s3Response.Body as any).pipe(res);
    } else {
      res.status(500).json({ error: 'Erro ao ler arquivo do storage.' });
    }
  } catch (err: any) {
    console.error('Backup download error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Enterprise Backup Gateway running on port ${PORT}`);
});
