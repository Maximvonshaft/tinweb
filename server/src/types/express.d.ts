import type { RequestUser } from '../core/types.js';

declare global {
  namespace Express {
    interface Request {
      currentUser?: RequestUser;
      accessToken?: string;
    }
  }
}
