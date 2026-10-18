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
export function safeNext(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/home";
}
