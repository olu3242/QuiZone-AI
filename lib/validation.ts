import { z } from "zod";
export const householdSchema = z.object({
  name: z.string().trim().min(2).max(50),
  consent: z.literal(true),
});
export const childSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(
      /^[\p{L}\p{N} _-]+$/u,
      "Use a nickname with letters, numbers, spaces, or dashes.",
    ),
  age: z.number().int().min(8).max(17),
  avatar: z.enum(["fox", "panda", "owl", "rocket"]),
  interest: z.enum(["science", "nature", "creativity", "world"]),
});
export const designSchema = z
  .object({
    roof: z.boolean(),
    access: z.boolean(),
    seating: z.boolean(),
    lighting: z.boolean(),
    mural: z.boolean(),
  })
  .strict();
export const allocationSchema = z
  .object({
    solar: z.number().int().min(0).max(100000),
    wind: z.number().int().min(0).max(100000),
    battery: z.number().int().min(0).max(100000),
    diesel: z.number().int().min(0).max(100000),
    grid: z.number().int().min(0).max(100000),
    efficiency: z.number().int().min(0).max(100000),
  })
  .strict()
  .refine(
    (v) =>
      Object.values(v).reduce((a, b) => a + b, 0) > 0 &&
      Object.values(v).reduce((a, b) => a + b, 0) <= 100000,
    "Allocate between $1 and $100,000.",
  );
export const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("blueprint"),
    data: z.object({
      session: z.string().uuid(),
      step: z.string().uuid(),
      design: designSchema,
    }),
  }),
  z.object({
    action: z.literal("plan"),
    data: z.object({
      session: z.string().uuid(),
      step: z.string().uuid(),
      allocation: allocationSchema,
    }),
  }),
  z.object({ action: z.literal("household"), data: householdSchema }),
  z.object({ action: z.literal("child"), data: childSchema }),
  z.object({
    action: z.literal("child_update"),
    data: childSchema.extend({ child: z.string().uuid() }),
  }),
  // ---- SafeZone (structured, moderator-authored cards only; no free text from children)
  z.object({
    action: z.literal("sz_hall_create"),
    data: z.object({
      title: z.string().trim().min(6).max(100),
      summary: z.string().trim().min(20).max(500),
      category: z.enum([
        "school",
        "community",
        "environment",
        "technology",
        "future",
        "family",
      ]),
      minAge: z.number().int().min(8).max(17),
      maxAge: z.number().int().min(8).max(17),
      capacity: z.number().int().min(2).max(30),
      startsAt: z.string().datetime(),
      duration: z.number().int().min(15).max(90),
      moderator: z.string().uuid().optional(),
      agenda: z
        .array(
          z.object({
            title: z.string().trim().min(3).max(120),
            minutes: z.number().int().min(1).max(60),
          }),
        )
        .min(1)
        .max(10),
      options: z
        .array(
          z.object({
            kind: z.enum(["contribution", "question", "idea"]),
            agenda: z.number().int().min(1).max(10).optional(),
            text: z.string().trim().min(3).max(200),
          }),
        )
        .min(1)
        .max(60),
    }),
  }),
  z.object({
    action: z.literal("sz_hall_state"),
    data: z.object({
      hall: z.string().uuid(),
      state: z.enum(["scheduled", "open", "active", "completed", "cancelled"]),
    }),
  }),
  z.object({
    action: z.literal("sz_agenda"),
    data: z.object({
      hall: z.string().uuid(),
      item: z.number().int().min(1).max(10),
    }),
  }),
  z.object({
    action: z.literal("sz_turn"),
    data: z.object({
      hall: z.string().uuid(),
      hand: z.string().uuid().nullable(),
    }),
  }),
  z.object({
    action: z.literal("sz_review"),
    data: z.object({ contribution: z.string().uuid(), approve: z.boolean() }),
  }),
  z.object({
    action: z.literal("sz_poll_create"),
    data: z.object({
      hall: z.string().uuid(),
      question: z.string().trim().min(6).max(200),
      options: z.array(z.string().trim().min(1).max(120)).min(2).max(6),
    }),
  }),
  z.object({
    action: z.literal("sz_poll_state"),
    data: z.object({
      poll: z.string().uuid(),
      state: z.enum(["open", "closed"]),
    }),
  }),
  z.object({
    action: z.literal("sz_remove"),
    data: z.object({
      hall: z.string().uuid(),
      handle: z.string().min(3).max(40),
      reason: z.string().trim().min(3).max(300),
    }),
  }),
  z.object({
    action: z.literal("sz_emergency_close"),
    data: z.object({
      hall: z.string().uuid(),
      reason: z.string().trim().min(3).max(300),
    }),
  }),
  z.object({
    action: z.literal("sz_report_review"),
    data: z.object({
      report: z.string().uuid(),
      status: z.enum(["under_review", "actioned", "dismissed", "escalated"]),
      note: z.string().trim().max(500).optional(),
    }),
  }),
  z.object({
    action: z.literal("sz_permission"),
    data: z.object({ enabled: z.literal(false) }),
  }),
  z.object({
    action: z.literal("sz_withdraw"),
    data: z.object({ hall: z.string().uuid(), child: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("sz_hand"),
    data: z.object({
      hall: z.string().uuid(),
      child: z.string().uuid(),
      raised: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("sz_say"),
    data: z.object({
      hall: z.string().uuid(),
      child: z.string().uuid(),
      option: z.string().uuid(),
    }),
  }),
  z.object({
    action: z.literal("sz_vote"),
    data: z.object({
      poll: z.string().uuid(),
      child: z.string().uuid(),
      choice: z.number().int().min(0).max(5),
    }),
  }),
  z.object({
    action: z.literal("sz_report"),
    data: z.object({
      hall: z.string().uuid(),
      reason: z.enum([
        "bullying",
        "unsafe",
        "privacy",
        "inappropriate",
        "technical",
      ]),
      contribution: z.string().uuid().optional(),
    }),
  }),
  z.object({
    action: z.literal("cms_meta"),
    data: z.object({
      challenge: z.string().uuid(),
      subject: z.enum([
        "science",
        "math",
        "environment",
        "civics",
        "world",
        "creativity",
        "general",
      ]),
      difficulty: z.enum(["starter", "explorer", "challenger"]),
    }),
  }),
  z.object({
    action: z.literal("cms_step_add"),
    data: z
      .object({
        prompt: z.string().trim().min(10).max(500),
        options: z.array(z.string().trim().min(1).max(150)).min(2).max(6),
        correct: z.number().int().min(0).max(5),
        hint: z.string().trim().min(10).max(300),
        explanation: z.string().trim().min(10).max(500),
      })
      .extend({ version: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("cms_step_update"),
    data: z
      .object({
        prompt: z.string().trim().min(10).max(500),
        options: z.array(z.string().trim().min(1).max(150)).min(2).max(6),
        correct: z.number().int().min(0).max(5),
        hint: z.string().trim().min(10).max(300),
        explanation: z.string().trim().min(10).max(500),
      })
      .extend({ step: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("cms_step_delete"),
    data: z.object({ step: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("cms_version_update"),
    data: z.object({
      version: z.string().uuid(),
      scenario: z.string().trim().min(20).max(1000),
      minAge: z.number().int().min(8).max(17),
      maxAge: z.number().int().min(8).max(17),
    }),
  }),
  z.object({
    action: z.literal("cms_version_new"),
    data: z.object({ challenge: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("cms_version_retire"),
    data: z.object({ version: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("q_budget"),
    data: z.object({ limit: z.number().int().min(1).max(50) }),
  }),
  z.object({
    action: z.literal("consent_accept"),
    data: z.object({ version: z.number().int().min(1) }),
  }),
  z.object({
    action: z.literal("child_archive"),
    data: z.object({ child: z.string().uuid(), archived: z.boolean() }),
  }),
  z.object({
    action: z.literal("child_delete"),
    data: z.object({
      child: z.string().uuid(),
      confirm: z.string().min(1).max(50),
    }),
  }),
  z.object({
    action: z.literal("permissions"),
    data: z.object({
      world: z.boolean(),
      q: z.boolean(),
      minutes: z.number().int().min(5).max(120),
    }),
  }),
  z.object({
    action: z.literal("create"),
    data: z.object({
      challenge: z.string().uuid(),
      children: z.array(z.string().uuid()).min(1).max(8),
      practice: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal("transition"),
    data: z.object({
      session: z.string().uuid(),
      state: z.enum(["ready", "active", "paused", "cancelled"]),
    }),
  }),
  z.object({
    action: z.literal("answer"),
    data: z.object({
      session: z.string().uuid(),
      step: z.string().uuid(),
      choice: z.number().int().min(0).max(5),
    }),
  }),
  z.object({
    action: z.literal("hint"),
    data: z.object({ session: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("report"),
    data: z.object({
      session: z.string().uuid(),
      reason: z.enum(["inappropriate", "incorrect", "technical", "privacy"]),
    }),
  }),
  z.object({
    action: z.literal("schedule"),
    data: z.object({
      at: z.string().datetime(),
      mode: z.enum(["quick", "solve", "build", "debate", "world"]),
    }),
  }),
  z.object({
    action: z.literal("review"),
    data: z.object({
      caseId: z.string().uuid(),
      status: z.enum(["under_review", "actioned", "dismissed", "escalated"]),
    }),
  }),
  z.object({
    action: z.literal("publish"),
    data: z.object({
      version: z.string().uuid(),
      ageReviewed: z.literal(true),
    }),
  }),
  z.object({
    action: z.literal("draft"),
    data: z.object({
      title: z.string().trim().min(4).max(100),
      mode: z.enum(["quick", "solve", "build", "debate", "world"]),
      scenario: z.string().trim().min(20).max(1000),
      prompt: z.string().trim().min(10).max(500),
      options: z.array(z.string().trim().min(1).max(150)).min(2).max(6),
      correct: z.number().int().min(0).max(5),
      hint: z.string().trim().min(10).max(300),
      explanation: z.string().trim().min(10).max(500),
    }),
  }),
]);
export type AppAction = z.infer<typeof actionSchema>;
const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use at most 128 characters.");
// Account-level operations live outside the gameplay command union so the
// destructive path has its own route, validation, and session handling.
export const accountSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change-password"),
    current: z.string().min(1).max(128),
    next: password,
  }),
  z.object({ action: z.literal("signout-all") }),
  z.object({
    action: z.literal("delete"),
    confirm: z.string().min(1).max(50),
  }),
]);
export type AccountAction = z.infer<typeof accountSchema>;
// Consent-granting SafeZone actions require the guardian's password in the same
// request; the database independently checks the fresh-password JWT claim.
export const safezoneConsentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sz_permission"),
    password: z.string().min(1).max(128),
    data: z.object({ enabled: z.literal(true) }),
  }),
  z.object({
    action: z.literal("sz_register"),
    password: z.string().min(1).max(128),
    data: z.object({
      hall: z.string().uuid(),
      child: z.string().uuid(),
      consent: z.literal(true),
    }),
  }),
]);
export const adminActions = [
  "cms_meta",
  "cms_step_add",
  "cms_step_update",
  "cms_step_delete",
  "cms_version_update",
  "cms_version_new",
  "cms_version_retire",
] as const;
export const moderatorActions = [
  "sz_hall_create",
  "sz_hall_state",
  "sz_agenda",
  "sz_turn",
  "sz_review",
  "sz_poll_create",
  "sz_poll_state",
  "sz_remove",
  "sz_emergency_close",
  "sz_report_review",
] as const;
export function safeNext(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/home";
}
