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
