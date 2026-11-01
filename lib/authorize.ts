import type { SupabaseClient } from "@supabase/supabase-js";
import "server-only";
import { actingHousehold, explorerLocked, LOCKED_MESSAGE } from "./household";
import {
  adminActions,
  explorerActions,
  guardianOnlyActions,
  moderatorActions,
  type AppAction,
} from "./validation";
// Independent API authorization, in addition to RLS and transactional RPC checks.
export async function authorize(db: SupabaseClient, input: AppAction) {
  if (
    !(explorerActions as readonly string[]).includes(input.action) &&
    (await explorerLocked(db))
  )
    throw new Error(LOCKED_MESSAGE);
  if (["draft", "publish", "review"].includes(input.action)) {
    const { data, error } = await db.rpc("qz_is_staff", {
      required_role: input.action === "review" ? null : "admin",
    });
    if (error || !data) throw new Error("Staff permission is required.");
    return;
  }
  if ((adminActions as readonly string[]).includes(input.action)) {
    const { data, error } = await db.rpc("qz_is_staff", {
      required_role: "admin",
    });
    if (error || !data)
      throw new Error("Content tools require an administrator role.");
    return;
  }
  if ((moderatorActions as readonly string[]).includes(input.action)) {
    const { data, error } = await db.rpc("qz_is_staff", {
      required_role: null,
    });
    if (error || !data)
      throw new Error("A SafeZone moderator role is required.");
    return;
  }
  // Joining needs no household yet; the database checks the code and the caller.
  if (input.action === "household" || input.action === "member_join") return;
  const house = await actingHousehold(db);
  if (!house) throw new Error("Create a guardian household first.");
  if (
    house.role !== "guardian" &&
    ((guardianOnlyActions as readonly string[]).includes(input.action) ||
      input.action.startsWith("sz_"))
  )
    throw new Error("Only the household's guardian can do this.");
  if ("child" in input.data) await ownsChild(db, house.id, input.data.child);
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
      .is("archived_at", null)
      .in("id", input.data.children);
    if (
      error ||
      !children ||
      children.length !== new Set(input.data.children).size
    )
      throw new Error(
        "All players must be active explorers in your household.",
      );
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

export async function ownsChild(
  db: SupabaseClient,
  householdId: string,
  childId: string,
) {
  const { data: child, error } = await db
    .from("child_profiles")
    .select("id")
    .eq("id", childId)
    .eq("household_id", householdId)
    .single();
  if (error || !child)
    throw new Error("Explorer not found or permission denied.");
}
