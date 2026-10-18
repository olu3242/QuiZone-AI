import "server-only";
import { z } from "zod";
import { guardian } from "./supabase";
import type { Answer, Challenge, Session, Step, Version } from "./types";
export type GameData = {
  serverNow: number;
  session: Session;
  version: Version & { challenges: Challenge };
  steps: Step[];
  answers: Answer[];
  players: { child_profiles: { nickname: string; avatar: string } }[];
};
export async function gameData(rawId: string): Promise<GameData> {
  const id = z.string().uuid().parse(rawId);
  const { db, user } = await guardian();
  const { data: house } = await db
    .from("households")
    .select("id")
    .eq("guardian_id", user.id)
    .single();
  if (!house) throw new Error("Permission denied.");
  const { data: session, error } = await db
    .from("game_sessions")
    .select("*")
    .eq("id", id)
    .eq("household_id", house.id)
    .single();
  if (error || !session) throw new Error("Session not found.");
  const [v, s, a, p] = await Promise.all([
    db
      .from("challenge_versions")
      .select("*,challenges(*)")
      .eq("id", session.challenge_version_id)
      .single(),
    db
      .from("challenge_steps")
      .select("*")
      .eq("version_id", session.challenge_version_id)
      .order("ordinal"),
    db
      .from("player_answers")
      .select("*")
      .eq("session_id", id)
      .order("created_at"),
    db
      .from("session_players")
      .select("child_profiles(nickname,avatar)")
      .eq("session_id", id),
  ]);
  if (v.error || s.error || a.error || p.error)
    throw new Error("Could not load saved session.");
  return {
    serverNow: Date.now(),
    session,
    version: v.data,
    steps: s.data,
    answers: a.data,
    players: p.data,
  } as unknown as GameData;
}
