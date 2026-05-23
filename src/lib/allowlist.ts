/**
 * True if email is in the comma-separated allowlist.
 * Case-insensitive, trimmed. Fail-closed: empty allowlist denies everyone.
 */
export function isEmailAllowed(
  email: string | undefined | null,
  csv: string | undefined | null,
): boolean {
  if (!email) return false;
  const allowed = (csv ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  // Fail-closed: an empty allowlist must deny everyone, otherwise a missing
  // env var would silently open OIDC sign-in to the world.
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}
