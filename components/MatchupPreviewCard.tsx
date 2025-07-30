import React from 'react';

interface Matchup {
  week: number;
  matchup_id: number;
  team: string;
  opponent: string;
  starters: string[];
  points: number;
}

interface MatchupPreviewCardProps {
  matchups: Matchup[] | null;
  isLoading: boolean;
  lastSynced: string | null;
}

const MatchupPreviewCard: React.FC<MatchupPreviewCardProps> = ({ matchups, isLoading, lastSynced }) => {
  return (
    <div className="mt-4 border-t border-purple-800 pt-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-gray-300">Weekly Matchups</h4>
        {lastSynced && <p className="text-xs text-gray-500">Synced: {lastSynced}</p>}
      </div>
      {isLoading ? (
        <p className="text-gray-400 text-sm">Syncing matchups...</p>
      ) : matchups && matchups.length > 0 ? (
        <div className="text-gray-400 text-sm space-y-3 max-h-48 overflow-y-auto">
          {matchups.slice(0, 5).map((matchup, index) => (
            <div key={`${matchup.matchup_id}-${index}`}>
              <strong>{matchup.team}</strong> vs <strong>{matchup.opponent}</strong> - Week {matchup.week}
              <p className="text-xs">Points: {matchup.points.toFixed(2)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm">
          Sync matchups to see this week's games.
        </p>
      )}
    </div>
  );
};

export default MatchupPreviewCard; 