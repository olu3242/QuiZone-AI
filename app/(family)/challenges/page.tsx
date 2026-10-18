import { ChallengesPage } from "@/components/pages/challenges";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { challenge } = await searchParams;
  return (
    <ChallengesPage
      key={challenge || "list"}
      initialSelected={challenge || ""}
    />
  );
}
