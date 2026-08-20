import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger.js';

export function requestLogger() {
  return pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/v1/health',
    },
    customProps: (req) => ({
      userId: req.user?.id,
    }),
    serializers: {
      req(req) {
        req.body = undefined;
        return req;
      },
    },
  });
}