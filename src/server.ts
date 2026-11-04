import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import finishedGoodsRoutes from './routes/finishedGoodsRoutes.js';
import rawMaterialsRoutes from './routes/rawMaterialsRoutes.js';
import packingMaterialsRoutes from './routes/packingMaterialsRoutes.js';
import bomRoutes from './routes/bomRoutes.js';
import blendRoutes from './routes/blendRoutes.js';
import bomRunRoutes from './routes/bomRunRoutes.js';
import stockTransactionRoutes from './routes/stockTransactionRoutes.js';
import planningRoutes from './routes/planningRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import userRoutes from './routes/userRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';

import { User } from './models/User.js';
import { seedDatabase } from './seeds/seedData.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  
  // Mask password in URI for safe display
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

  res.json({
    status: 'ONLINE',
    system: 'Fadna Production Stock & Planning System',
    timestamp: new Date().toISOString(),
    database: {
      status: states[dbState] || 'Unknown',
      readyState: dbState,
      configuredUri: maskedUri ? maskedUri : 'NONE (Defaulting to localhost:27017)'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/finished-goods', finishedGoodsRoutes);
app.use('/api/raw-materials', rawMaterialsRoutes);
app.use('/api/packing-materials', packingMaterialsRoutes);
app.use('/api/boms', bomRoutes);
app.use('/api/blends', blendRoutes);
app.use('/api/bom-runs', bomRunRoutes);
app.use('/api/stock-transactions', stockTransactionRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);

// Static Client Serving (Production bundle support)
const clientDist = path.resolve(process.cwd(), '../client/dist');
const localClientDist = path.resolve(process.cwd(), 'client/dist');
const resolvedDist = fs.existsSync(clientDist) ? clientDist : fs.existsSync(localClientDist) ? localClientDist : null;

if (resolvedDist) {
  app.use(express.static(resolvedDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(resolvedDist, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Start listening immediately
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Fadna Production Backend running on port ${PORT}`);
  console.log(`📡 API Base: http://localhost:${PORT}/api`);
  if (resolvedDist) {
    console.log(`🖥️  Frontend UI served at: http://localhost:${PORT}`);
  }
  console.log(`=======================================================`);
});

// Connect to MongoDB in background
connectDB().then(async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Server] No users detected. Running automated Fadna dataset seed...');
      await seedDatabase();
    }
  } catch (err: any) {
    console.warn('[Server] Auto-seed check notice:', err.message);
  }
}).catch((err) => {
  console.warn('[Server] Background DB connection notice:', err.message);
});
