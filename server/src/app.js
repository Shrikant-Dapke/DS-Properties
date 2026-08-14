import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customer.routes.js';
import plotRoutes from './routes/plot.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import categoryRoutes from './routes/category.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/plots', plotRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/categories', categoryRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
