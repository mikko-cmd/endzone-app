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
    <div className="flex items-center gap-4 p-3 border-b border-white hover:bg-gray-900 transition-all">
      <img
        src={`https://sleepercdn.com/content/nfl/players/${player.id}.jpg`}
        alt={player.name}
        className="w-10 h-10 rounded-full bg-black object-cover"
      />
      <div className="flex flex-col">
        <button
          onClick={() => onPlayerClick(player.id)}
          className="text-white font-normal hover:underline text-left"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          {player.name}
        </button>
        <span
          className="text-sm text-gray-400"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          {player.position} – {player.team}
        </span>
      </div>
      <div
        className="ml-auto text-right text-sm text-gray-300"
        style={{ fontFamily: 'Consolas, monospace' }}
      >
        <div>{(player.points || 0).toFixed(1)} pts</div>
      </div>
    </div>
  );
};
