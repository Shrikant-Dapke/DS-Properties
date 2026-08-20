import { listSettings, updateSetting } from '../services/settingsService.js';
import { buildContext } from './context.js';

export async function getSettings(req, res) {
  const data = await listSettings();
  res.json({ success: true, data });
}

export async function updateSettings(req, res) {
  const ctx = buildContext(req);
  const key = req.params.key;
  const row = await updateSetting(key, req.body.value, ctx);
  res.json({ success: true, data: row });
}