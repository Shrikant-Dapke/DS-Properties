export function success(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function fail(res, message = 'Error', status = 500, errors = null) {
  const payload = { success: false, message };
  if (errors !== null) payload.errors = errors;
  return res.status(status).json(payload);
}
