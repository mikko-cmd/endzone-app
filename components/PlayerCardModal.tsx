'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPlayerById } from '@/lib/sleeper/fetchAllPlayers';
import LoadingArc from './LoadingArc';

interface PlayerCardModalProps {
  playerId: string;
  onClose: () => void;
}

const GameLogTab = ({ gameLog }: { gameLog: any[] }) => (
  <div className="max-h-[400px] overflow-y-auto">
    <table className="w-full text-sm text-left">
      <thead className="text-xs text-gray-400 uppercase bg-[#1a1a1a]">
        <tr>
          <th className="px-4 py-2">Week</th>
          <th className="px-4 py-2">Opponent</th>
          <th className="px-4 py-2">Pass Yds</th>
          <th className="px-4 py-2">Pass TD</th>
          <th className="px-4 py-2">Rush Yds</th>
          <th className="px-4 py-2">Rush TD</th>
          <th className="px-4 py-2">Rec Yds</th>
          <th className="px-4 py-2">Rec TD</th>
          <th className="px-4 py-2">Points</th>
        </tr>
      </thead>
      <tbody>
        {gameLog.map(game => (
          <tr key={game.week} className="border-b border-gray-800 hover:bg-gray-800/50">
            <td className="px-4 py-2">{game.week}</td>
            <td className="px-4 py-2">{game.opponent || 'N/A'}</td>
            <td className="px-4 py-2">{game.stats?.['Passing Yards'] || 0}</td>
            <td className="px-4 py-2">{game.stats?.['Passing TDs'] || 0}</td>
            <td className="px-4 py-2">{game.stats?.['Rushing Yards'] || 0}</td>
            <td className="px-4 py-2">{game.stats?.['Rushing TDs'] || 0}</td>
            <td className="px-4 py-2">{game.stats?.['Receiving Yards'] || 0}</td>
            <td className="px-4 py-2">{game.stats?.['Receiving TDs'] || 0}</td>
            <td className="px-4 py-2 font-bold">{game.stats?.['FantasyPoints'] || 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PlayerCardModal: React.FC<PlayerCardModalProps> = ({
  playerId,
  onClose,
}) => {
  const [player, setPlayer] = useState<any>(null);
  const [gameLog, setGameLog] = useState<any[]>([]);
  const [outlook, setOutlook] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlayerData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [playerData, gameLogRes, outlookRes] = await Promise.all([
          getPlayerById(playerId),
          fetch(`/api/player-stats/${playerId}`),
          fetch(`/api/player-outlook/${playerId}`),
        ]);

        if (playerData) {
          setPlayer(playerData);
        } else {
          setError('Player not found.');
        }

        if (gameLogRes.ok) {
          const gameLogData = await gameLogRes.json();
          setGameLog(gameLogData.data);
        }

        if (outlookRes.ok) {
          const outlookData = await outlookRes.json();
          setOutlook(outlookData.outlook);
        }
      } catch (err) {
        setError('Failed to fetch player data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (playerId) {
      fetchPlayerData();
    }
  }, [playerId]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#101010] rounded-2xl p-6 w-[900px] h-[600px] overflow-hidden shadow-xl relative flex"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="w-full flex items-center justify-center">
            <LoadingArc />
          </div>
        ) : error ? (
          <div className="w-full flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : (
          <>
            <div className="w-2/3 pr-4 border-r border-gray-800">
              <div className="flex items-center space-x-4">
                <img
                  src={`https://sleepercdn.com/content/nfl/players/${playerId}.jpg`}
                  className="h-24 w-24 rounded-full"
                  alt={player.full_name}
                />
                <div>
                  <h2 className="text-xl font-bold">{player.full_name}</h2>
                  <p className="text-sm text-gray-400">
                    {player.team} • {player.position}
                  </p>
                  <div className="text-xs text-gray-500 mt-1">
                    Age: {player.age} • Height: {player.height} • Weight:{' '}
                    {player.weight} lbs • EXP: {player.years_exp} yrs • College:{' '}
                    {player.college}
                  </div>
                </div>
              </div>

              <Tabs defaultValue="summary" className="mt-4">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="gamelog">Game Log</TabsTrigger>
                  <TabsTrigger value="news">News</TabsTrigger>
                  <TabsTrigger value="ai">AI Outlook</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <p className="text-sm text-gray-400">{outlook}</p>
                </TabsContent>
                <TabsContent value="gamelog">
                  <GameLogTab gameLog={gameLog} />
                </TabsContent>
                <TabsContent value="news">
                  <p className="text-sm text-gray-400">
                    Recent news from Rotowire or other sources will appear here.
                  </p>
                </TabsContent>
                <TabsContent value="ai">
                  <p className="text-sm text-gray-400">
                    AI-generated insights coming soon.
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            <div className="w-1/3 pl-4">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default PlayerCardModal;
