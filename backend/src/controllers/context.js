export function buildContext(req) {
  return {
    userId: req.user?.id ?? null,
    // Server-resolved role from the authenticated user row (never client
    // input). Drives the developer-bypass vs partner-governance fork.
    role: req.user?.role ?? null,
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}
