'use client';

import { Loader2 } from 'lucide-react';

interface Player {
  id: string;
  name: string;
}

interface RosterData {
  username: string;
  starters: Player[];
  roster: Player[];
}

interface RosterPreviewCardProps {
  rosters: RosterData | null;
  isLoading: boolean;
}

const RosterPreviewCard: React.FC<RosterPreviewCardProps> = ({
  rosters,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (!rosters || !rosters.starters || rosters.starters.length === 0) {
    return (
      <div className="mt-4 border-t border-purple-800 pt-4">
        <h4 className="font-semibold mb-2 text-gray-300">Team Roster</h4>
        <p className="text-gray-400 text-sm">
          No roster data available. Try syncing.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-purple-800 pt-4">
      <h4 className="font-semibold mb-2 text-gray-300">
        Starters for {rosters.username}
      </h4>
      <div className="text-gray-400 text-sm space-y-1 max-h-48 overflow-y-auto">
        {rosters.starters.map((player) => (
          <div key={player.id} className="flex items-center">
            <img
              src={`https://sleepercdn.com/content/nfl/players/${player.id}.jpg`}
              alt={player.name}
              className="w-8 h-8 rounded-full mr-2"
              // Handle image errors gracefully by replacing them with a generic avatar
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://sleepercdn.com/images/v2/icons/player_default.webp';
              }}
            />
            <p className="truncate">{player.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RosterPreviewCard; 