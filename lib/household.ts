import type { SupabaseClient } from "@supabase/supabase-js";
import "server-only";

export type ActingHousehold = {
  id: string;
  name: string;
  role: "guardian" | "member";
  displayName: string | null;
};

// The caller's household and role, resolved in the database from auth.uid() — never
// from client input. Guardians own one household; members belong to at most one.
export async function actingHousehold(
  db: SupabaseClient,
): Promise<ActingHousehold | null> {
  const { data, error } = await db.rpc("qz_household");
  if (error) throw new Error("The QuiZone database is not ready.");
  return (data as ActingHousehold | null) ?? null;
}

export const LOCKED_MESSAGE =
  "Explorer mode is on. A grown-up can unlock it with their password.";

// Whether this Auth session is in Explorer mode. Enforced in the database too; this
// keeps guardian-only routes (including Supabase Auth calls) closed as well.
export async function explorerLocked(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc("qz_locked");
  if (error) throw new Error("The QuiZone database is not ready.");
  return Boolean(data);
}
