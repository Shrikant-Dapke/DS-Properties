import { submitChange } from '../services/governanceService.js';
import { listSettings } from '../services/settingsService.js';
import { buildContext } from './context.js';

export async function getSettings(req, res) {
  const data = await listSettings();
  res.json({ success: true, data });
}

export async function updateSettings(req, res) {
  const ctx = buildContext(req);
  const key = req.params.key;
  const result = await submitChange({
    entityType: 'app_setting',
    entityId: key,
    operation: 'update',
    proposedState: req.body,
    ctx,
  });
  res.json({ success: true, data: result });
}