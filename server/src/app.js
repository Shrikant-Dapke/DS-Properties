import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customer.routes.js';
import partnerRoutes from './routes/partner.routes.js';
import capitalRoutes from './routes/capital.routes.js';
import loanRoutes from './routes/loan.routes.js';
import plotRoutes from './routes/plot.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import categoryRoutes from './routes/category.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import incomeRoutes from './routes/income.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportRoutes from './routes/report.routes.js';
import changeRequestRoutes from './routes/changeRequest.routes.js';
import approvalRoutes from './routes/approval.routes.js';
import financeRoutes from './routes/finance.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customerRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/capital', capitalRoutes);
app.use('/api/loans', loanRoutes);
  app.use('/api/plots', plotRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/categories', categoryRoutes);
app.use('/api/expenses', expenseRoutes);
  app.use('/api/income', incomeRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/change-requests', changeRequestRoutes);
  app.use('/api/approvals', approvalRoutes);
  app.use('/api/finance', financeRoutes);
  app.use(errorHandler);

  return app;
}
