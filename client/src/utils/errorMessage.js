export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;

  // Network error / backend unreachable
  if (!err.response) {
    return 'Cannot reach the server. Please check that the backend is running.';
  }

  const { status, data } = err.response;

  if (status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  if (status === 400 || status === 422 || status === 403) {
    if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
      return data.errors.map((e) => e.msg || e.message || String(e)).join(' ');
    }
    if (data?.message) return data.message;
    return fallback;
  }

  if (status >= 500) {
    return 'Something went wrong on the server. Please try again.';
  }

  return data?.message || fallback;
}
