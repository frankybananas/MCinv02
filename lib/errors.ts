export class HttpError extends Error {
  public readonly status: number
  public readonly code?: string
  public readonly details?: unknown
  public readonly exposeDetails: boolean

  constructor(status: number, message: string, code?: string, options?: { details?: unknown; exposeDetails?: boolean }) {
    super(message)
    this.name = new.target.name
    this.status = status
    this.code = code
    this.details = options?.details
    this.exposeDetails = options?.exposeDetails ?? false
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, message, code)
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, message, code)
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found', code = 'NOT_FOUND') {
    super(404, message, code)
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', options?: { details?: unknown; exposeDetails?: boolean }) {
    super(400, message, code, options)
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too many requests', code = 'TOO_MANY_REQUESTS') {
    super(429, message, code)
  }
}

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError
}

export function formatHttpError(error: HttpError): Record<string, unknown> {
  const body: Record<string, unknown> = {
    success: false,
    error: error.message,
  }

  if (error.code) {
    body.code = error.code
  }

  if (error.exposeDetails && typeof error.details !== 'undefined') {
    body.details = error.details
  }

  return body
}
