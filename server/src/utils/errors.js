export class AppError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}
