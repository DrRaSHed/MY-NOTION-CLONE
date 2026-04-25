import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import pageRoutes from './routes/pages.js';
import blockRoutes from './routes/blocks.js';
import databaseRoutes from './routes/databases.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pages', pageRoutes);
app.use('/api/v1/blocks', blockRoutes);
app.use('/api/v1/databases', databaseRoutes);

// Error handler
app.use(errorHandler);

export default app;
