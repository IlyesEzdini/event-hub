// Supabase Auth requires an email-formatted identifier. Managers and the admin
// log in with a plain "username" (per the product requirement), so we derive a
// stable, deterministic internal email from the username. This mapping is used
// both when an account is created (see services/managers.ts) and when logging in,
// so it must never change shape.
const USERNAME_DOMAIN = 'members.eventhub.internal'

export function usernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  return `${normalized}@${USERNAME_DOMAIN}`
}

export function isStrongEnough(password: string): boolean {
  return password.length >= 6
}
