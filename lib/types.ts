export type Child = {
  id: string;
  nickname: string;
  age: number;
  avatar: string;
  interest: string;
  archived_at: string | null;
};
export type Challenge = {
  id: string;
  title: string;
  mode: string;
  description: string;
  minutes: number;
  country: string | null;
  subject: string;
  difficulty: string;
  versions: Version[];
};
export type Version = {
  id: string;
  challenge_id: string;
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
  bonus?: number;
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
  flags: Record<string, boolean>;
  badges: {
    code: string;
    scope: string;
    name: string;
    description: string;
    sort: number;
  }[];
  childBadges: { child_id: string; badge_code: string; awarded_at: string }[];
  familyBadges: { badge_code: string; awarded_at: string }[];
  cases: { id: string; reason: string; status: string; created_at: string }[];
};

// ---- SafeZone (shapes returned by qz_safezone_lobby / qz_safezone_room)
export type HallState =
  "draft" | "scheduled" | "open" | "active" | "completed" | "cancelled";
export type AgendaItem = { ordinal: number; title: string; minutes: number };
export type Hall = {
  id: string;
  title: string;
  summary: string;
  category: string;
  minAge: number;
  maxAge: number;
  capacity: number;
  startsAt: string;
  duration: number;
  state: HallState;
  closedReason: string | null;
  mine: boolean;
  registered: number;
  agenda: AgendaItem[] | null;
};
export type Registration = {
  hall: string;
  child: string;
  handle: string;
  status: "registered" | "withdrawn" | "removed";
  consentedAt: string;
  withdrawnAt: string | null;
  removedReason: string | null;
};
export type SafeZoneLobby = {
  enabled: boolean;
  staff: boolean;
  permission: boolean;
  halls: Hall[];
  registrations: Registration[];
  notifications: {
    id: string;
    kind: string;
    message: string;
    createdAt: string;
  }[];
  reports: {
    id: string;
    hall: string;
    reason: string;
    severity?: string;
    status: string;
    handle?: string | null;
    createdAt: string;
    events?: { status: string; note: string | null; at: string }[];
  }[];
};
export type CardOption = {
  id: string;
  kind: "contribution" | "question" | "idea";
  text: string;
  agenda: number | null;
};
export type Poll = {
  id: string;
  question: string;
  options: string[];
  state: "draft" | "open" | "closed";
  votes: number;
  results: number[] | null;
};
export type Room = {
  serverNow: string;
  moderator: boolean;
  hall: {
    id: string;
    title: string;
    summary?: string;
    state: HallState;
    currentItem?: number;
    startsAt?: string;
    duration?: number;
    closedReason?: string | null;
    minAge?: number;
    maxAge?: number;
  };
  agenda?: AgendaItem[];
  options?: CardOption[];
  me: {
    status: Registration["status"];
    handle: string;
    removedReason?: string | null;
    hand?: "waiting" | "speaking" | null;
    shared?: { option: string; status: string }[];
    votes?: Record<string, number>;
  } | null;
  participants?: number;
  queue?: { hand: string | null; handle: string; state: string }[];
  feed?: {
    id: string;
    kind: CardOption["kind"];
    text: string;
    agenda: number | null;
    handle: string | null;
    at: string;
  }[];
  pending?:
    | {
        id: string;
        kind: string;
        text: string;
        handle: string;
        at: string;
      }[]
    | null;
  roster?: { handle: string; status: string }[] | null;
  polls?: Poll[];
  summary?: {
    participants: number;
    contributions: number;
    ideas: { text: string; supporters: number }[];
  } | null;
};
