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

/**
 * Use when a request includes an ID which doesn't exist.
 */
export class ItemNotFoundException extends CustomException {
  constructor(message: string) {
    super(message, 404);
  }
}

/**
 * Use when a request is invalid for some reason such as it being malformed but
 * parseable, or taking an inappropriate action.
 */
export class InvalidRequestException extends CustomException {
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * The provided request body/params/query strings are not valid/parseable.
 */
export class ValidationException extends CustomException {
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * The user is not allowed to perform this action.
 */
export class UnauthorizedException extends CustomException {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

/**
 * You cannot access this component/part of the system.
 */
export class ForbiddenException extends CustomException {
  constructor(message = 'Access forbidden') {
    super(message, 403);
  }
}

/**
 * Use this for unexpected system errors which are not a result of the user's
 * inappropriate response/error.
 */
export class InternalSystemError extends CustomException {
  constructor(message: string) {
    super(message, 403);
  }
}
