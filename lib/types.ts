export type Child = {
  id: string;
  nickname: string;
  age: number;
  avatar: string;
  interest: string;
};
export type Challenge = {
  id: string;
  title: string;
  mode: string;
  description: string;
  minutes: number;
  country: string | null;
  versions: Version[];
};
export type Version = {
  id: string;
  status: string;
  scenario: string;
  min_age: number;
  max_age: number;
  version: number;
};
export type Step = {
  kind: "choice" | "allocation" | "blueprint";
  id: string;
  ordinal: number;
  prompt: string;
  options: string[];
  hint: string;
};
export type Session = {
  id: string;
  code: string;
  state: string;
  created_at: string;
  expires_at: string;
  challenge_version_id: string;
  total_score: number;
  completed_at: string | null;
};
export type Answer = {
  id: string;
  step_id: string;
  choice: number | null;
  allocation: Record<string, number> | null;
  design: Record<string, boolean> | null;
  points: number;
  feedback: string;
};
export type Snapshot = {
  household: { id: string; name: string } | null;
  children: Child[];
  permissions: { world: boolean; q: boolean; minutes: number } | null;
  challenges: Challenge[];
  sessions: Session[];
  scores: {
    child_id: string;
    points: number;
    skill: string;
    session_id: string;
  }[];
  passport: { child_id: string; country: string; session_id: string }[];
  reports: { id: string; reason: string; status: string; created_at: string }[];
  schedules: { id: string; scheduled_at: string; mode: string }[];
  qLogs: { id: string; output: string; created_at: string }[];
  admin: boolean;
  cases: { id: string; reason: string; status: string; created_at: string }[];
};
