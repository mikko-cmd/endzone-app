interface Roster {
  owner_name: string;
  players: string[];
}

interface RosterPreviewCardProps {
  rosters: Roster[] | null;
}

export default function RosterPreviewCard({ rosters }: RosterPreviewCardProps) {
  return (
    <div className="mt-4 border-t border-purple-800 pt-4">
      <h4 className="font-semibold mb-2 text-gray-300">Roster Preview</h4>
      {rosters && rosters.length > 0 ? (
        <ul className="text-gray-400 text-sm space-y-1">
          {rosters.slice(0, 3).map((roster) => (
            <li key={roster.owner_name}>
              <strong>{roster.owner_name}:</strong> {roster.players.slice(0, 2).join(', ')}
            </li>
          ))}
          {rosters.length > 3 && <li>...and {rosters.length - 3} more teams</li>}
        </ul>
      ) : (
        <p className="text-gray-400 text-sm">
          Sync the roster to see your teams.
        </p>
      )}
    </div>
  );
} 