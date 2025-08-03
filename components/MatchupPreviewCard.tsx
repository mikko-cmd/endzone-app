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
  sleeper_username: string | null;
}

const MatchupPreviewCard: React.FC<MatchupPreviewCardProps> = ({
  matchups,
  isLoading,
  lastSynced,
  sleeper_username,
}) => {
  const relevantMatchup =
    matchups && sleeper_username
      ? matchups.find((m) => m.team === sleeper_username)
      : null;

  return (
    <div className="mt-4 border-t border-purple-800 pt-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-gray-300">Weekly Matchup</h4>
        {lastSynced && (
          <p className="text-xs text-gray-500">Synced: {lastSynced}</p>
        )}
      </div>
      {isLoading ? (
        <p className="text-gray-400 text-sm">Syncing matchups...</p>
      ) : relevantMatchup ? (
        <div className="text-gray-400 text-sm space-y-1">
          <div>
            <strong>{relevantMatchup.team}</strong> vs{' '}
            <strong>{relevantMatchup.opponent}</strong>
            <p className="text-xs mt-1">
              Week {relevantMatchup.week} - Points:{' '}
              {relevantMatchup.points.toFixed(2)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-sm">
          Sync matchups to see this week's game.
        </p>
      )}
    </div>
  );
};

export default MatchupPreviewCard; 