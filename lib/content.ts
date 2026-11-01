export const zones = [
  {
    mode: "quick",
    name: "QuickZone",
    icon: "⚡",
    color: "#FFD43B",
    tag: "A little friendly competition",
    description:
      "Big curiosity. Quick questions. Discover something surprising together.",
  },
  {
    mode: "solve",
    name: "SolveZone",
    icon: "◈",
    color: "#0B5FFF",
    tag: "Think it through, together",
    description:
      "Real-world puzzles with more than one way forward. Make a plan as a team.",
  },
  {
    mode: "build",
    name: "BuildZone",
    icon: "✦",
    color: "#7C4DFF",
    tag: "Small ideas, big possibilities",
    description:
      "Turn a problem into a practical idea. Choose, budget, and pitch your creation.",
  },
  {
    mode: "debate",
    name: "DebateZone",
    icon: "↔",
    color: "#FF4D6D",
    tag: "Different views. Better ideas.",
    description:
      "Explore both sides, weigh the evidence, and practice listening with care.",
  },
  {
    mode: "world",
    name: "WorldZone",
    icon: "◎",
    color: "#00B8D9",
    tag: "A world of perspectives",
    description:
      "Explore a global challenge and discover how different places solve it.",
  },
] as const;
export const steps = [
  [
    "01",
    "Gather your people",
    "Bring your curiosity and a grown-up. One shared screen is all you need.",
  ],
  [
    "02",
    "Pick your adventure",
    "Choose a quick warm-up or a challenge that gets everyone thinking.",
  ],
  [
    "03",
    "Make it a family thing",
    "Share ideas, make decisions, and leave with something to talk about.",
  ],
];
export const faqs = [
  [
    "What is QuiZone?",
    "A place for families to learn by playing together: quizzes, problem-solving, building, and exploring different perspectives.",
  ],
  [
    "Does every child need an account?",
    "No. A guardian creates and manages a household. Children take part through family profiles on a shared screen.",
  ],
  [
    "Can children message strangers?",
    "No. There is no direct messaging or open chat. Activities use guided choices and a guardian-led experience.",
  ],
  [
    "Is this a replacement for school?",
    "No. QuiZone is about time together and practicing skills through play. Progress reflects activity, not a measure of intelligence.",
  ],
];
export const safezone = {
  tagline: "Your Voice. Your Ideas. A Safer World.",
  categories: {
    school: "School",
    community: "Community",
    environment: "Environment",
    technology: "Technology",
    future: "The future",
    family: "Family",
  } as Record<string, string>,
  rules: [
    "Every town hall is led by a trained adult moderator.",
    "Explorers appear with a fun session name — never their real name.",
    "Everyone shares by choosing idea and statement cards. There is no chat.",
    "A moderator checks every contribution before others see it.",
    "Guardians approve each town hall and can withdraw at any time.",
    "Anyone can report a concern. Moderators can pause or close a session.",
  ],
  consent:
    "I am this explorer’s guardian. I consent to them joining this moderated town hall under a session name, choosing pre-written cards, and voting in polls. I understand their contributions are reviewed before others see them, and that I can withdraw consent at any time, which removes their contributions and votes.",
  states: {
    draft: "Draft",
    scheduled: "Registration open",
    open: "Room open",
    active: "Live now",
    completed: "Completed",
    cancelled: "Closed",
  } as Record<string, string>,
  reportReasons: {
    bullying: "Unkind or bullying",
    unsafe: "Feels unsafe",
    privacy: "Shares private details",
    inappropriate: "Not appropriate",
    technical: "Something isn’t working",
  } as Record<string, string>,
};
// A zone is open unless an operator has explicitly paused it.
export const zoneOpen = (
  flags: Record<string, boolean> | undefined,
  mode: string,
) => flags?.["zone_" + mode] !== false;
export const subjects: Record<string, string> = {
  science: "Science",
  math: "Math",
  environment: "Environment",
  civics: "Civics",
  world: "The world",
  creativity: "Creativity",
  general: "General",
};
export const difficulties: Record<string, string> = {
  starter: "Starter",
  explorer: "Explorer",
  challenger: "Challenger",
};
export const practiceCopy = {
  option:
    "Practice round: play for fun. No XP, badges, or passport stamps are recorded.",
  pill: "Practice round",
  result:
    "Practice round complete. Nothing was added to XP, badges, or stamps.",
};

// QZ-35: labels for maintenance run counts (admin panel).
export const maintenanceLabels: Record<string, string> = {
  expiredSessions: "games expired",
  rateEvents: "rate records cleared",
  invites: "old invites cleared",
  locks: "old locks cleared",
  devices: "device records cleared",
  reminders: "reminders sent",
};

// QZ-37: BuildZone portfolio copy.
export const portfolioCopy = {
  title: "Our designs",
  empty:
    "Designs you save in BuildZone appear here, with what they cost and what you chose.",
  parts: {
    roof: "Rain cover",
    access: "Step-free path",
    seating: "Comfortable seats",
    lighting: "Solar lighting",
    mural: "Community mural",
  },
} as const;

// QZ-39: Workflow OS run statuses (admin console).
export const workflowStatusLabels: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Retrying",
  dead: "Dead letter",
  paused: "Paused",
};
