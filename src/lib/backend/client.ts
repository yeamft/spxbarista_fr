import { isExpressApiConfigured } from "@/lib/api/express-client";

/** Express + Mongo is the production backend. */
export const isBackendConfigured = isExpressApiConfigured();

/**
 * Legacy flag name used throughout the store for "remote sync enabled".
 * Now means Express API is configured (VITE_API_URL).
 */
export const isSupabaseConfigured = isBackendConfigured;

/** Removed — Express API client is used instead. */
export const supabase = null;

export function requireSupabase(): never {
  throw new Error("Remote Supabase backend has been removed. Use the Express API (VITE_API_URL).");
}
