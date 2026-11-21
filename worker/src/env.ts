export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  BOT_TOKEN: string;
  /** Sent by Telegram in X-Telegram-Bot-Api-Secret-Token (set via setWebhook secret_token). */
  TG_WEBHOOK_SECRET: string;
  /** Fine-grained token: actions:write on GITHUB_REPO only. */
  GITHUB_TOKEN: string;
  /** Shared HMAC secret with the GitHub Actions render workflow. */
  CALLBACK_SECRET: string;
  /** HMAC key for signed media links. */
  SESSION_SECRET: string;
  /** Optional cached getMe JSON so the bot does not call getMe on each update. */
  BOT_INFO?: string;
  OWNER_ID: string;
  GITHUB_REPO: string;
  GITHUB_REF: string;
  PUBLIC_URL: string;
  FACTORY_ENABLED: string;
  DAILY_CAP: string;
}

export const enabled = (env: Env) => (env.FACTORY_ENABLED ?? "true").toLowerCase() === "true";
export const ownerId = (env: Env) => Number(env.OWNER_ID || 0);
