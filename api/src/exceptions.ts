// Base class for custom exceptions
export class CustomException extends Error {
  status: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.status = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ItemNotFoundException extends CustomException {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ValidationException extends CustomException {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedException extends CustomException {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

export class ForbiddenException extends CustomException {
  constructor(message = 'Access forbidden') {
    super(message, 403);
  }
}

export class InternalSystemError extends CustomException {
  constructor(message = 'Unexpected internal system error occurred.') {
    super(message, 403);
  }
}
