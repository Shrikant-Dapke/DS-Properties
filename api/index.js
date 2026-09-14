// Vercel serverless adapter (single-project deployment from the repo root).
//
// Same Express app as `backend/server.js` uses locally — no logic is
// duplicated or rewritten here. Migrations never run per request; apply them
// explicitly with `npm run migrate` (see `backend/scripts/migrate.js`).
import app from '../backend/src/app.js';

export default app;
