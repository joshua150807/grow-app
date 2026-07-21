export type AppErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'USERNAME_TAKEN'
  | 'AVATAR_UPLOAD_NOT_FOUND'
  | 'DEEP_WORK_SESSION_CONFLICT'
  | 'HABIT_COLLECTION_NOT_FOUND'
  | 'HABIT_COLLECTION_CONFLICT'
  | 'EMAIL_TAKEN'
  | 'CODE_INVALID'
  | 'AUTH_EMAIL_MISSING'
  | 'REGISTRATION_STATE_CONFLICT'
  | 'PROFILE_STATE_CONFLICT'
  | 'CREATOR_APPLICATION_EXISTS'
  | 'CREATOR_APPLICATION_NOT_FOUND'
  | 'CREATOR_APPLICATION_ALREADY_REVIEWED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
