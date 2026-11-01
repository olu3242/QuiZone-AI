import "server-only";
import { guardian } from "./supabase";
import { actingHousehold, explorerLocked } from "./household";
import type { Snapshot } from "./types";
export async function snapshot(): Promise<Snapshot> {
  const { db } = await guardian();
  const h = { data: await actingHousehold(db) };
  const locked = await explorerLocked(db);
  const isGuardian = h.data?.role === "guardian" && !locked;
  const { data: staff, error: staffError } = await db.rpc("qz_is_staff");
  if (staffError) throw new Error("The QuiZone database is not ready.");
  const staffView = Boolean(staff) && !locked;
  // Operator kill switches; a missing map means "all on" for older databases.
  const { data: flags } = await db.rpc("qz_flags");
  const { data: consent } = await db.rpc("qz_consent_status");
  const { data: qUsage } = await db.rpc("qz_q_usage");
  const hid = h.data?.id;
  const results = await Promise.all([
    db.from("challenges").select("*,versions:challenge_versions(*)"),
    ...(hid
      ? [
          db
            .from("child_profiles")
            .select("*")
            .eq("household_id", hid)
            .order("created_at"),
          db
            .from("guardian_permissions")
            .select("*")
            .eq("household_id", hid)
            .single(),
          db
            .from("game_sessions")
            .select("*")
            .eq("household_id", hid)
            .order("created_at", { ascending: false })
            .limit(100),
          db
            .from("score_events")
            .select(
              "child_id,points,skill,session_id,game_sessions!inner(household_id)",
            )
            .eq("game_sessions.household_id", hid),
          db
            .from("passport_entries")
            .select(
              "child_id,country,session_id,game_sessions!inner(household_id)",
            )
            .eq("game_sessions.household_id", hid),
          db
            .from("moderation_cases")
            .select("id,reason,status,created_at")
            .eq("household_id", hid),
          db
            .from("game_nights")
            .select("*")
            .eq("household_id", hid)
            .gte("scheduled_at", new Date().toISOString())
            .order("scheduled_at"),
          db
            .from("ai_evaluations")
            .select("id,output,created_at,game_sessions!inner(household_id)")
            .eq("game_sessions.household_id", hid)
            .order("created_at", { ascending: false })
            .limit(20),
        ]
      : []),
    ...(staffView
      ? [
          db
            .from("moderation_cases")
            .select("id,reason,status,created_at")
            .order("created_at", { ascending: false })
            .limit(100),
        ]
      : []),
  ]);
  if (results.some((r) => r.error))
    throw new Error("Could not load family data. Please try again.");
  const rows = results.map((r) => r.data);
  const [catalog, earned, family] = await Promise.all([
    db.from("badges").select("code,scope,name,description,sort").order("sort"),
    hid
      ? db
          .from("child_badges")
          .select("child_id,badge_code,awarded_at")
          .in(
            "child_id",
            ((rows[1] as { id: string }[] | null) ?? []).map((c) => c.id),
          )
      : Promise.resolve({ data: [], error: null }),
    hid
      ? db
          .from("household_badges")
          .select("badge_code,awarded_at")
          .eq("household_id", hid)
      : Promise.resolve({ data: [], error: null }),
  ]);
  // Household adults: everyone sees who's in the family; only the guardian sees invites.
  const [members, invites, notices, builds] = await Promise.all([
    hid
      ? db
          .from("household_members")
          .select("user_id,display_name,joined_at")
          .eq("household_id", hid)
          .order("joined_at")
      : Promise.resolve({ data: [], error: null }),
    hid && isGuardian
      ? db
          .from("household_invites")
          .select("id,created_at,expires_at")
          .eq("household_id", hid)
          .is("used_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    // Family inbox: guardian only (RLS also hides it from members and locked sessions).
    hid && isGuardian
      ? db
          .from("family_notifications")
          .select("id,kind,title,body,link,created_at,read_at")
          .eq("household_id", hid)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
    // BuildZone portfolio: saved designs from this household's sessions.
    hid
      ? db
          .from("build_submissions")
          .select(
            "session_id,roof,access,seating,lighting,mural,total_cost,game_sessions!inner(household_id)",
          )
          .eq("game_sessions.household_id", hid)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (
    catalog.error ||
    earned.error ||
    family.error ||
    members.error ||
    invites.error ||
    notices.error ||
    builds.error
  )
    throw new Error("Could not load family data. Please try again.");
  return {
    household: h.data,
    members: members.data ?? [],
    invites: invites.data ?? [],
    notifications: notices.data ?? [],
    builds: (builds.data ?? []).map(
      ({ game_sessions: _, ...b }: Record<string, unknown>) => b,
    ),
    children: hid ? rows[1] : [],
    permissions: hid ? rows[2] : null,
    challenges: rows[0],
    sessions: hid ? rows[3] : [],
    scores: hid ? rows[4] : [],
    passport: hid ? rows[5] : [],
    reports: hid ? rows[6] : [],
    schedules: hid ? rows[7] : [],
    qLogs: hid && !locked ? rows[8] : [],
    admin: staffView,
    locked,
    flags: (flags as Record<string, boolean> | null) ?? {},
    consent: locked ? null : ((consent as Snapshot["consent"]) ?? null),
    qUsage: (qUsage as Snapshot["qUsage"]) ?? null,
    badges: catalog.data ?? [],
    childBadges: earned.data ?? [],
    familyBadges: family.data ?? [],
    cases: staffView ? rows[rows.length - 1] : [],
  } as Snapshot;
}
