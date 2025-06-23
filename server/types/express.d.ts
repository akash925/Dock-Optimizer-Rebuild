import type { Request } from "express";
import type { User }   from "@shared/types";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
    isAuthenticated?: () => boolean;
  }
} 