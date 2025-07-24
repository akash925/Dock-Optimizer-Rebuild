/**
 * Single source-of-truth Redis client for the application.
 *
 *  – Pulls the singleton + helpers from `src/utils/redis`
 *  – Exposes a backwards-compat layer for old `getRedisInstance` imports
 */

import {
  redis,
  getRedis,
  checkRedisHealth,
  shutdownRedis,
  getRedisConfigStatus,
  getBullMQRedisUrl,
} from "./src/utils/redis";

/* -------------------------------------------------------------------------- */
/*                               Legacy wrapper                               */
/* -------------------------------------------------------------------------- */
/**
 * @deprecated — migrate call-sites to `getRedis()` instead.
 * Temporary shim so old code like
 *   import { getRedisInstance } from "../../redis";
 * keeps working until refactor is complete.
 */
 
export const getRedisInstance = () => getRedis();

/* -------------------------------------------------------------------------- */
/*                               Public exports                               */
/* -------------------------------------------------------------------------- */
export {
  redis,
  getRedis,
  checkRedisHealth,
  shutdownRedis,
  getRedisConfigStatus,
  getBullMQRedisUrl,
};
