import type { DbShim, MediaShim, Store } from "./store";

export interface Env {
  /** SQLite-backed Durable Object (jobs, events, drafts, sessions, blobs, render queue). */
  STORE: DurableObjectNamespace<Store>;
  /** Workers AI binding (flux-1-schnell images, optional LLM script fallback). */
  AI: Ai;
  /** Set per request by bindEnv() — D1-compatible / R2-like views over STORE. */
  DB: DbShim;
  MEDIA: MediaShim;
  ASSETS: Fetcher;
  BOT_TOKEN: string;
  /** Sent by Telegram in X-Telegram-Bot-Api-Secret-Token (set via setWebhook secret_token). */
  TG_WEBHOOK_SECRET: string;
  /** Shared HMAC secret with the GitHub Actions render workflow. */
  CALLBACK_SECRET: string;
  /** HMAC key for signed media links. */
  SESSION_SECRET: string;
  /** Optional cached getMe JSON so the bot does not call getMe on each update. */
  BOT_INFO?: string;
  /** Telegram numeric id of the owner. Empty → the first private /start claims ownership (stored once). */
  OWNER_ID: string;
  GITHUB_REPO: string;
  GITHUB_REF: string;
  PUBLIC_URL: string;
  FACTORY_ENABLED: string;
  DAILY_CAP: string;
}

export const enabled = (env: Env) => (env.FACTORY_ENABLED ?? "true").toLowerCase() === "true";
export const ownerId = (env: Env) => Number(env.OWNER_ID || 0);
