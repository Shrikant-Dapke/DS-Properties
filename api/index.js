// Vercel serverless adapter (single-project deployment from the repo root).
// The backend is ESM, while Vercel loads this serverless entrypoint as CommonJS.
// Dynamic import bridges the two module systems without changing backend logic.
let appPromise;

module.exports = async function handler(req, res) {
  appPromise ??= import('../backend/src/app.js').then(({ default: app }) => app);
  const app = await appPromise;
  return app(req, res);
};
