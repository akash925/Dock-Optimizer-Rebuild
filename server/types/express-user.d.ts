import { User as SharedUser } from '../../shared/types/user.js';

declare global {
  namespace Express {
    interface User extends SharedUser {}
  }
} 