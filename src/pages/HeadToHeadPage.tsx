import { HeadToHead } from "../components/HeadToHead";
import { useAppData } from "../context/AppDataContext";

export function HeadToHeadPage() {
  const { players, matches } = useAppData();

  return (
    <div className="space-y-6">
      <HeadToHead players={players} matches={matches} />
    </div>
  );
}
