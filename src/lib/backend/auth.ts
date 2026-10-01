export async function loadSupabaseAuthUser(_user: unknown) {
  return null;
}

export async function listSupabaseProfiles() {
  return [] as import("@/lib/auth-context").AuthUser[];
}

export async function resolveSupabasePasswordLogin(_password: string) {
  return null;
}
