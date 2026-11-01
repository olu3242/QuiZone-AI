import { TownHallRoom } from "@/components/safezone/room";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const [{ id }, { child }] = await Promise.all([params, searchParams]);
  return <TownHallRoom hall={id} child={child ?? null} />;
}
