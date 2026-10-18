import type { SupabaseClient } from "@supabase/supabase-js";
import "server-only";
import type { AppAction } from "./validation";
// Independent API authorization, in addition to RLS and transactional RPC checks.
export async function authorize(
  db: SupabaseClient,
  userId: string,
  input: AppAction,
) {
  if (["draft", "publish", "review"].includes(input.action)) {
    const { data, error } = await db.rpc("qz_is_staff", {
      required_role: input.action === "review" ? null : "admin",
    });
    if (error || !data) throw new Error("Staff permission is required.");
    return;
  }
  if (input.action === "household") return;
  const { data: house, error } = await db
    .from("households")
    .select("id")
    .eq("guardian_id", userId)
    .single();
  if (error || !house) throw new Error("Create a guardian household first.");
  if ("session" in input.data) {
    const { data: session, error } = await db
      .from("game_sessions")
      .select("id,household_id")
      .eq("id", input.data.session)
      .eq("household_id", house.id)
      .single();
    if (error || !session)
      throw new Error("Session not found or permission denied.");
  }
  if (input.action === "create") {
    const { data: children, error } = await db
      .from("child_profiles")
      .select("id,age")
      .eq("household_id", house.id)
      .in("id", input.data.children);
    if (
      error ||
      !children ||
      children.length !== new Set(input.data.children).size
    )
      throw new Error("All players must belong to your household.");
    const { data: version, error: versionError } = await db
      .from("challenge_versions")
      .select("min_age,max_age,challenges(mode)")
      .eq("challenge_id", input.data.challenge)
      .eq("status", "published")
      .eq("age_reviewed", true)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    if (
      versionError ||
      !version ||
      children.some((c) => c.age < version.min_age || c.age > version.max_age)
    )
      throw new Error(
        "This challenge is unavailable for the selected players.",
      );
    const { data: permissions } = await db
      .from("guardian_permissions")
      .select("world")
      .eq("household_id", house.id)
      .single();
    const mode = (version.challenges as unknown as { mode: string }).mode;
    if (mode === "world" && !permissions?.world)
      throw new Error("A guardian must enable WorldZone first.");
  }
}
