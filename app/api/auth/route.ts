import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { database } from "@/lib/supabase";
import { sameOrigin } from "@/lib/http";
const input = z.object({
  mode: z.enum(["login", "signup", "forgot-password", "reset-password"]),
  email: z.string().email().max(254).nullable().optional(),
  password: z.string().min(12).max(128).nullable().optional(),
  guardian: z.boolean().optional(),
});
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Request origin not allowed." },
      { status: 403 },
    );
  try {
    const v = input.parse(await req.json());
    const db = await database();
    const site = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    if (v.mode === "signup") {
      if (!v.guardian || !v.email || !v.password)
        throw new Error(
          "A guardian email, password, and age confirmation are required.",
        );
      const { error } = await db.auth.signUp({
        email: v.email,
        password: v.password,
        options: { emailRedirectTo: `${site}/auth/callback` },
      });
      if (error)
        throw new Error(
          "Could not create the account. Check your details or try again later.",
        );
      return NextResponse.json({
        message:
          "Check your email to confirm your guardian account. If an account already exists, use login or password recovery.",
      });
    }
    if (v.mode === "login") {
      if (!v.email || !v.password)
        throw new Error("Enter your email and password.");
      const { data, error } = await db.auth.signInWithPassword({
        email: v.email,
        password: v.password,
      });
      if (error || !data.user.email_confirmed_at)
        throw new Error(
          "Could not sign in. Check your email, password, and email confirmation.",
        );
      return NextResponse.json({ redirect: "/home" });
    }
    if (v.mode === "forgot-password") {
      if (!v.email) throw new Error("Enter your email.");
      const { error } = await db.auth.resetPasswordForEmail(v.email, {
        redirectTo: `${site}/auth/callback?next=/reset-password`,
      });
      if (error)
        throw new Error(
          "Could not request a reset link. Please try again later.",
        );
      return NextResponse.json({
        message: "If this email has an account, a reset link is on its way.",
      });
    }
    const { data } = await db.auth.getUser();
    if (!data.user || !v.password)
      throw new Error("Open a valid password reset link first.");
    const { error } = await db.auth.updateUser({ password: v.password });
    if (error)
      throw new Error(
        "Could not change your password. Request a new reset link.",
      );
    await db.auth.signOut();
    return NextResponse.json({ redirect: "/login" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check the email and password format."
            : error instanceof Error
              ? error.message
              : "Account services unavailable.",
      },
      { status: 400 },
    );
  }
}
