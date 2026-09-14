// Vercel serverless adapter (backend-standalone deployments).
//
// Exposes the existing Express app unchanged: all controllers, services,
// governance, and auth behave exactly as under `server.js`. `server.js`
// remains the local-development entrypoint (it calls `app.listen`); Vercel
// invokes this exported app once per request instead.
//
// Deliberately does NOT run migrations on startup: schema changes are applied
// explicitly by the owner with `npm run migrate` against the target database.
// See `backend/vercel.json` for the `/api/v1/*` rewrite and the root
// `vercel.json` for the single-project (frontend + API, same-domain) setup.
import app from '../src/app.js';

export default app;
