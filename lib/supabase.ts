import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import "server-only";
export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
export async function database() {
  if (!configured())
    throw new Error(
      "QuiZone account services are not connected yet. Please try again after setup.",
    );
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server Components cannot update cookies; proxy refreshes sessions. */
          }
        },
      },
    },
  );
}
export async function guardian() {
  const db = await database();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || !data.user.email_confirmed_at)
    throw new Error("Please sign in with a confirmed guardian account.");
  return { db, user: data.user };
}
