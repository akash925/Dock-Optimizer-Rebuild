import { User as SharedUser } from '../../shared/types/user';

declare global {
  namespace Express {
    interface User extends SharedUser {}
  }
} 