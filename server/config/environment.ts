/* -------------------------------------------------------------------------- */
/*  Dock Optimizer – Unified Environment / Secrets Loader                     */
/* -------------------------------------------------------------------------- */

import dotenv from "dotenv";

/* ────────────────────────────── 1.  Load .env  ──────────────────────────── */

dotenv.config();

/* ────────────────────────────── 2.  Types  ──────────────────────────────── */

export interface Config {
  environment: "production" | "development" | "test";
  port: number;

  database: { url?: string; ssl: boolean | Record<string, unknown> };
  email: { apiKey?: string; fromEmail: string };
  aws: {
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
    region: string;
  };
  redis: { url?: string; enabled: boolean };

  session: { secret: string; secure: boolean; maxAge: number };

  app: { baseUrl: string; logLevel: string };

  isDopplerAvailable: boolean;
}

export interface HealthStatus {
  status: "healthy" | "degraded";
  timestamp: string;
  environment: string;
  port: number;
  doppler: boolean;
  services: {
    database: boolean;
    email: boolean;
    aws: boolean;
    redis: boolean;
  };
  missing: string[];
  missingOptional: string[];
}

/* ────────────────────────────── 3.  Helper  ─────────────────────────────── */

function str(v?: string) {
  return v?.trim() || undefined;
}

/* ────────────────────────────── 4.  Build Config  ───────────────────────── */

function buildConfig(): Config {
  const isProd = process.env.NODE_ENV === "production";

  const config: Config = {
    environment:
      (process.env.NODE_ENV as Config["environment"]) || "development",
    /** IMPORTANT:  Replit injects PORT → default to that, else 5001 **/
    port: Number(process.env.PORT ?? 5001),

    database: {
      url: str(process.env.DATABASE_URL),
      ssl: isProd ? { rejectUnauthorized: false } : false,
    },

    email: {
      apiKey: str(process.env.SENDGRID_API_KEY),
      fromEmail:
        str(process.env.SENDGRID_FROM_EMAIL) ?? "noreply@dockoptimizer.com",
    },

    aws: {
      accessKeyId: str(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: str(process.env.AWS_SECRET_ACCESS_KEY),
      bucket: str(process.env.AWS_S3_BUCKET),
      region: str(process.env.AWS_REGION) ?? "us-east-1",
    },

    redis: {
      url: str(process.env.REDIS_URL),
      enabled: Boolean(str(process.env.REDIS_URL)),
    },

    session: {
      secret:
        str(process.env.SESSION_SECRET) ??
        "dock-optimizer-fallback-secret-change-in-production",
      secure: isProd,
      maxAge: 24 * 60 * 60 * 1000, // 24 h
    },

    app: {
      baseUrl: str(process.env.BASE_URL) ?? "https://dockoptimizer.replit.app",
      logLevel: str(process.env.LOG_LEVEL) ?? "info",
    },

    isDopplerAvailable: Boolean(
      process.env.DOPPLER_TOKEN || process.env.DOPPLER_PROJECT,
    ),
  };

  console.log(
    config.isDopplerAvailable
      ? "✅ Doppler configuration detected"
      : "⚠️  Doppler not configured – falling back to raw env vars",
  );

  return config;
}

export const config = buildConfig();

/* ────────────────────────────── 5.  Validation  ─────────────────────────── */

export function validateEnvironment() {
  const REQUIRED = ["DATABASE_URL", "SENDGRID_API_KEY"] as const;
  const OPTIONAL = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_BUCKET",
    "REDIS_URL",
  ] as const;

  const missing = REQUIRED.filter((k) => !process.env[k]);
  const missingOptional = OPTIONAL.filter((k) => !process.env[k]);

  if (missing.length) {
    const msg = `Missing critical env vars: ${missing.join(", ")}`;
    if (config.environment === "production") throw new Error(msg);
    console.warn("⚠️ " + msg);
  }

  if (missingOptional.length) {
    console.warn("ℹ️ Optional env vars not set: " + missingOptional.join(", "));
  }

  return { missing, missingOptional, isValid: missing.length === 0 };
}

/* ────────────────────────────── 6.  Health Helper  ──────────────────────── */

export function getHealthStatus(): HealthStatus {
  const { isValid, missing, missingOptional } = validateEnvironment();

  return {
    status: isValid ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    environment: config.environment,
    port: config.port,
    doppler: config.isDopplerAvailable,

    services: {
      database: Boolean(config.database.url),
      email: Boolean(config.email.apiKey),
      aws: Boolean(config.aws.accessKeyId && config.aws.secretAccessKey),
      redis: config.redis.enabled,
    },

    missing,
    missingOptional,
  };
}
