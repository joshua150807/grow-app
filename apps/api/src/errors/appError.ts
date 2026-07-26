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
  | 'TRAINING_PLAN_NOT_FOUND'
  | 'TRAINING_PLAN_VERSION_CONFLICT'
  | 'TRAINING_PLAN_VALIDATION_ERROR'
  | 'TRAINING_PLAN_STATUS_CONFLICT'
  | 'TRAINING_SCHEDULE_CONFLICT'
  | 'TRAINING_EXERCISE_NOT_AVAILABLE'
  | 'TRAINING_EXERCISE_NOT_FOUND'
  | 'TRAINING_EXERCISE_VALIDATION_ERROR'
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
