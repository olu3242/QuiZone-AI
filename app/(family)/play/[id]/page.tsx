import { Game } from "@/components/game";
import { gameData } from "@/lib/game-data";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initialData = null,
    message = "";
  try {
    initialData = await gameData(id);
  } catch (error) {
    message = error instanceof Error ? error.message : "Please try again.";
  }
  if (!initialData)
    return (
      <div className="empty-state">
        <h1>We couldn’t open this adventure.</h1>
        <p>{message}</p>
      </div>
    );
  return (
    <Game
      id={id}
      initialData={initialData}
      initialNow={initialData.serverNow}
    />
  );
}
