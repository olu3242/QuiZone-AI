import { redirect } from "next/navigation";
import { configured, database } from "@/lib/supabase";
import { snapshot } from "@/lib/snapshot";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function FamilyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured()) redirect("/login");
  const db = await database();
  const { data } = await db.auth.getUser();
  if (!data.user?.email_confirmed_at) redirect("/login");
  let initialData = null,
    initialError = "";
  try {
    initialData = await snapshot();
  } catch (error) {
    initialError =
      error instanceof Error ? error.message : "Could not load family data.";
  }
  return (
    <Workspace initialData={initialData} initialError={initialError}>
      {children}
    </Workspace>
  );
}
