import type { AuthUser } from './types.js';
import { AppError } from '../errors/appError.js';

const ADMIN_ROLES = new Set(['admin', 'ceo']);

export function requireAdminOrCeo(user: AuthUser): void {
  if (!user.role || !ADMIN_ROLES.has(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Admin or CEO access is required.');
  }
}
