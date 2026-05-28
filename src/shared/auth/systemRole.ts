import "server-only";
import { z } from "zod";

export type SystemRoleResponse = { role: "admin" | null };

// Future system-role values (super_admin, auditor) extend this union here.
const responseSchema = z.object({
  role: z.union([z.literal("admin"), z.null()]),
});

const FETCH_TIMEOUT_MS = 5000;

// Throws on any failure. The caller is responsible for the fail-closed
// translation: never fall back to IdP claims, store null on the session.
export async function fetchSystemRole(
  userId: string,
  baseUrl: string,
): Promise<SystemRoleResponse> {
  const url = `${baseUrl}/me/system-role`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Custos-User-Id": userId,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`system-role fetch failed: ${message}`);
  }

  if (!res.ok) {
    throw new Error(`system-role fetch returned ${res.status}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`system-role response was not JSON: ${message}`);
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`system-role response violates contract: ${parsed.error.message}`);
  }
  return { role: parsed.data.role };
}
