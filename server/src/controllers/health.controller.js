import { success } from '../utils/response.js';
import { getHealth } from '../services/health.service.js';

export function healthCheck(req, res) {
  const health = getHealth();
  success(res, health, 'Health check successful');
}
