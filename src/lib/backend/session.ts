import { getApiToken, setApiToken } from "@/lib/api/express-client";

export function clearSupabaseAuthSyncPause() {}
export function pauseSupabaseAuthSync(_ms?: number) {}
export function isSupabaseAuthSyncPaused() {
  return false;
}
export function isSupabaseAuthError(_error: unknown) {
  return false;
}

/** Returns Express JWT when present (used by order sync gates). */
export async function ensureSupabaseAccessToken() {
  return getApiToken();
}

export function clearBackendAuthToken() {
  setApiToken(null);
}
