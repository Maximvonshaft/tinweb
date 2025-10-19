export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const createNotFoundError = (message: string, code = 'NOT_FOUND') =>
  new AppError(404, code, message);

export const createBadRequestError = (message: string, code = 'BAD_REQUEST') =>
  new AppError(400, code, message);

export const createUnauthorizedError = (message: string, code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const createForbiddenError = (message: string, code = 'FORBIDDEN') =>
  new AppError(403, code, message);

export const createConflictError = (message: string, code = 'CONFLICT') =>
  new AppError(409, code, message);
