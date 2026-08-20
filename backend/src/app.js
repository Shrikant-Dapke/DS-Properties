import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import xss from 'xss';
import { config } from './config/environment.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { NotFoundError } from './utils/errors.js';

const app = express();

app.set('trust proxy', config.trustProxy ? 1 : false);

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger());

// Sanitize free-form string fields on incoming bodies.
// Credential fields are excluded: trimming or HTML-encoding a password would
// silently corrupt it (e.g. a valid password with leading/trailing spaces).
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string' && !/password/i.test(key)) {
        req.body[key] = xss(req.body[key].trim());
      }
    }
  }
  next();
});

app.use(config.apiPrefix, routes);

// 404 for unknown API routes
app.use((req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

app.use(errorHandler);

export default app;