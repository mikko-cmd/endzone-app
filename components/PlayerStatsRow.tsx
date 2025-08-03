'use client';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  points: number;
}

interface PlayerStatsRowProps {
  player: Player;
  onPlayerClick: (playerId: string) => void;
}

export const PlayerStatsRow: React.FC<PlayerStatsRowProps> = ({
  player,
  onPlayerClick,
}) => {
  return (
    <div className="flex items-center gap-4 p-3 border-b border-purple-800 hover:bg-purple-950 transition-all">
      <img
        src={`https://sleepercdn.com/content/nfl/players/${player.id}.jpg`}
        alt={player.name}
        className="w-10 h-10 rounded-full bg-gray-700 object-cover"
      />
      <div className="flex flex-col">
        <button
          onClick={() => onPlayerClick(player.id)}
          className="text-white font-semibold hover:underline text-left"
        >
          {player.name}
        </button>
        <span className="text-sm text-purple-400">
          {player.position} – {player.team}
        </span>
      </div>
      <div className="ml-auto text-right text-sm text-purple-300">
        <div>PTS: {(player.points || 0).toFixed(2)}</div>
      </div>
    </div>
  );
};
