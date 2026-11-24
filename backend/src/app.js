import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import employerRoutes from './modules/employers/employer.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import workerRoutes from './modules/workers/worker.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/employers', employerRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
