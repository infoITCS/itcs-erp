export class AppError extends Error {
  readonly statusCode: number;
  readonly errors?: Record<string, string[]>;
  readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, errors?: Record<string, string[]>) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = statusCode < 500 || statusCode === 501;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "The request conflicts with the current state") {
    super(message, 409);
  }
}

export class ValidationFailedError extends AppError {
  constructor(errors: Record<string, string[]>, message = "Validation failed") {
    super(message, 400, errors);
  }
}

export class NotImplementedError extends AppError {
  constructor(message = "This operation is not available yet") {
    super(message, 501);
  }
}
