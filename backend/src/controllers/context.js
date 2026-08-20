export function buildContext(req) {
  return {
    userId: req.user?.id ?? null,
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}