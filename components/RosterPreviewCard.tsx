interface Team {
  owner: string;
  starters: string[];
  players: string[];
}

interface RosterData {
  teams: Team[];
}

interface RosterPreviewCardProps {
  rosters: RosterData | null; // This prop receives `league.rosters_json`
  isLoading: boolean;
}

export default function RosterPreviewCard({ rosters, isLoading }: RosterPreviewCardProps) {
  return (
    <div className="mt-4 border-t border-purple-800 pt-4">
      <h4 className="font-semibold mb-2 text-gray-300">Team Rosters</h4>
      {rosters && rosters.teams.length > 0 ? (
        <div className="text-gray-400 text-sm space-y-3 max-h-48 overflow-y-auto">
          {rosters.teams.map((team) => (
            <div key={team.owner}>
              <strong>{team.owner}:</strong> {team.starters.slice(0, 2).join(', ')}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm">
          Sync the roster to see your teams.
        </p>
      )}
    </div>
  );
} 