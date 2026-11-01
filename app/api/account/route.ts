import { NextResponse, type NextRequest } from "next/server";
import { guardian } from "@/lib/supabase";
import { sameOrigin } from "@/lib/http";
import { publicError } from "@/lib/errors";
import { accountSchema } from "@/lib/validation";

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status, headers: noStore });

// GET: guardian data export. Every read is household-scoped explicitly and by RLS.
export async function GET() {
  try {
    const { db, user } = await guardian();
    const { data: house, error } = await db
      .from("households")
      .select("id,name,consented_at,created_at")
      .eq("guardian_id", user.id)
      .single();
    if (error || !house) return fail("Create a household first.", 404);
    const budget = await db.rpc("qz_rate", { bucket: "export" });
    if (budget.error) {
      const e = publicError(budget.error, "account:export");
      return fail(e.error, e.status);
    }
    const audit = await db.rpc("qz_command", {
      command: "export",
      payload: {},
    });
    if (audit.error) return fail("Could not prepare your export.");
    const hid = house.id;
    const sessions = await db
      .from("game_sessions")
      .select(
        "id,code,state,created_at,expires_at,completed_at,total_score,challenge_versions(version,challenges(title,mode))",
      )
      .eq("household_id", hid)
      .order("created_at");
    const ids = (sessions.data || []).map((s) => s.id);
    const [
      perm,
      kids,
      players,
      answers,
      builds,
      scores,
      stamps,
      cases,
      nights,
      hints,
      events,
    ] = await Promise.all([
      db
        .from("guardian_permissions")
        .select("world,q,minutes,safezone")
        .eq("household_id", hid)
        .single(),
      db
        .from("child_profiles")
        .select("id,nickname,age,avatar,interest,created_at,archived_at")
        .eq("household_id", hid)
        .order("created_at"),
      db
        .from("session_players")
        .select("session_id,child_id")
        .in("session_id", ids),
      db
        .from("player_answers")
        .select(
          "session_id,step_id,choice,allocation,design,points,feedback,created_at",
        )
        .in("session_id", ids)
        .order("created_at"),
      db.from("build_submissions").select("*").in("session_id", ids),
      db
        .from("score_events")
        .select("session_id,child_id,points,skill,created_at")
        .in("session_id", ids),
      db
        .from("passport_entries")
        .select("session_id,child_id,country,created_at")
        .in("session_id", ids),
      db
        .from("moderation_cases")
        .select("id,session_id,reason,status,created_at")
        .eq("household_id", hid),
      db
        .from("game_nights")
        .select("scheduled_at,mode,created_at")
        .eq("household_id", hid),
      db
        .from("ai_evaluations")
        .select("session_id,provider,model,prompt_version,output,created_at")
        .in("session_id", ids),
      db
        .from("audit_events")
        .select("action,reference_id,detail,created_at")
        .eq("household_id", hid)
        .order("created_at"),
    ]);
    const parts = [
      sessions,
      perm,
      kids,
      players,
      answers,
      builds,
      scores,
      stamps,
      cases,
      nights,
      hints,
      events,
    ];
    if (parts.some((p) => p.error))
      return fail("Could not prepare your export.");
    // SafeZone: every row is household-scoped by RLS; moderator notes are staff-only
    // and deliberately excluded. Cards and choices resolve to the text the child chose.
    const kidIds = (kids.data || []).map((k) => k.id);
    const [szRegs, szSaid, szVotes, szReports, szNotes] = await Promise.all([
      db
        .from("town_hall_registrations")
        .select(
          "child_id,handle,status,consented_at,withdrawn_at,removed_reason,town_halls(title,starts_at,state)",
        )
        .eq("household_id", hid),
      db
        .from("town_hall_contributions")
        .select("child_id,status,created_at,town_hall_options(kind,text)")
        .in("child_id", kidIds),
      db
        .from("town_hall_votes")
        .select("child_id,choice,created_at,town_hall_polls(question,options)")
        .in("child_id", kidIds),
      db
        .from("safezone_reports")
        .select("reason,severity,status,created_at")
        .eq("household_id", hid),
      db
        .from("safezone_notifications")
        .select("kind,message,created_at")
        .eq("household_id", hid)
        .order("created_at"),
    ]);
    const [childBadges, familyBadges, consents] = await Promise.all([
      db
        .from("consent_records")
        .select("version,accepted_at")
        .eq("household_id", hid)
        .order("version"),
      db
        .from("child_badges")
        .select("child_id,badge_code,awarded_at")
        .in("child_id", kidIds),
      db
        .from("household_badges")
        .select("badge_code,awarded_at")
        .eq("household_id", hid),
    ]);
    if (
      [
        szRegs,
        szSaid,
        szVotes,
        szReports,
        szNotes,
        childBadges,
        familyBadges,
        consents,
      ].some((p) => p.error)
    )
      return fail("Could not prepare your export.");
    const body = {
      exportedAt: new Date().toISOString(),
      format: "quizone-household-export/v2",
      account: { email: user.email, createdAt: user.created_at },
      household: house,
      permissions: perm.data,
      children: kids.data,
      sessions: sessions.data,
      sessionPlayers: players.data,
      answers: answers.data,
      buildSubmissions: builds.data,
      scoreEvents: scores.data,
      passportEntries: stamps.data,
      safetyReports: cases.data,
      scheduledGameNights: nights.data,
      guidedHints: hints.data,
      auditTrail: events.data,
      badges: { children: childBadges.data, family: familyBadges.data },
      consentRecords: consents.data,
      safezone: {
        townHallRegistrations: szRegs.data,
        contributions: szSaid.data,
        votes: szVotes.data,
        reports: szReports.data,
        notifications: szNotes.data,
      },
    };
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        ...noStore,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="quizone-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Please sign in again.",
      401,
    );
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Request origin not allowed.", 403);
  let session: Awaited<ReturnType<typeof guardian>>;
  try {
    session = await guardian();
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Please sign in again.",
      401,
    );
  }
  const parsed = accountSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return fail(parsed.error.issues.map((i) => i.message).join(" "));
  const { db, user } = session;
  const input = parsed.data;
  if (input.action === "change-password") {
    // Re-verify the current password so a borrowed, signed-in device can't take over.
    const budget = await db.rpc("qz_rate", { bucket: "reauth" });
    if (budget.error) {
      const e = publicError(budget.error, "account:reauth");
      return fail(e.error, e.status);
    }
    const check = await db.auth.signInWithPassword({
      email: user.email!,
      password: input.current,
    });
    if (check.error) return fail("Your current password is incorrect.");
    if (input.current === input.next)
      return fail("Choose a password you haven't used here.");
    const { error } = await db.auth.updateUser({ password: input.next });
    if (error) return fail("Could not change your password. Try again.");
    await db.auth.signOut({ scope: "others" });
    return NextResponse.json(
      { message: "Password changed. Other devices were signed out." },
      { headers: noStore },
    );
  }
  if (input.action === "signout-all") {
    const { error } = await db.auth.signOut({ scope: "global" });
    if (error) return fail("Could not sign out every device. Try again.");
    return NextResponse.json({ redirect: "/login" }, { headers: noStore });
  }
  const { error } = await db.rpc("qz_command", {
    command: "account_delete",
    payload: { confirm: input.confirm },
  });
  if (error) {
    const e = publicError(error, "account:delete");
    return fail(e.error, e.status);
  }
  // The identity no longer exists; clear this device's cookies regardless of API outcome.
  await db.auth.signOut({ scope: "local" }).catch(() => undefined);
  return NextResponse.json({ redirect: "/" }, { headers: noStore });
}
