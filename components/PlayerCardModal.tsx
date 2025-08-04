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

interface GameLogEntry {
  week: number;
  opponent: string;
  date: string;
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  carries?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  targets?: number;
  fantasy_points: number;
}

// Height conversion utility
const convertInchesToFeet = (inches: number) => {
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
};

const GameLogTab = ({ gameLog, playerPosition }: { gameLog: GameLogEntry[]; playerPosition: string }) => {
  if (!gameLog || gameLog.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No game log data available
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-400 uppercase bg-[#1a1a1a] sticky top-0">
          <tr>
            <th className="px-4 py-2">Week</th>
            <th className="px-4 py-2">Opponent</th>
            {playerPosition === 'QB' && (
              <>
                <th className="px-4 py-2">Pass Yds</th>
                <th className="px-4 py-2">Pass TD</th>
                <th className="px-4 py-2">INT</th>
                <th className="px-4 py-2">Rush Yds</th>
                <th className="px-4 py-2">Rush TD</th>
              </>
            )}
            {playerPosition === 'RB' && (
              <>
                <th className="px-4 py-2">Carries</th>
                <th className="px-4 py-2">Rush Yds</th>
                <th className="px-4 py-2">Rush TD</th>
                <th className="px-4 py-2">Rec</th>
                <th className="px-4 py-2">Rec Yds</th>
                <th className="px-4 py-2">Rec TD</th>
              </>
            )}
            {(['WR', 'TE'].includes(playerPosition)) && (
              <>
                <th className="px-4 py-2">Targets</th>
                <th className="px-4 py-2">Rec</th>
                <th className="px-4 py-2">Rec Yds</th>
                <th className="px-4 py-2">Rec TD</th>
              </>
            )}
            <th className="px-4 py-2">Fantasy Pts</th>
          </tr>
        </thead>
        <tbody>
          {gameLog.map(game => (
            <tr key={game.week} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="px-4 py-2">{game.week}</td>
              <td className="px-4 py-2">{game.opponent || 'N/A'}</td>
              
              {playerPosition === 'QB' && (
                <>
                  <td className="px-4 py-2">{game.passing_yards || 0}</td>
                  <td className="px-4 py-2">{game.passing_tds || 0}</td>
                  <td className="px-4 py-2">{game.interceptions || 0}</td>
                  <td className="px-4 py-2">{game.rushing_yards || 0}</td>
                  <td className="px-4 py-2">{game.rushing_tds || 0}</td>
                </>
              )}
              
              {playerPosition === 'RB' && (
                <>
                  <td className="px-4 py-2">{game.carries || 0}</td>
                  <td className="px-4 py-2">{game.rushing_yards || 0}</td>
                  <td className="px-4 py-2">{game.rushing_tds || 0}</td>
                  <td className="px-4 py-2">{game.receptions || 0}</td>
                  <td className="px-4 py-2">{game.receiving_yards || 0}</td>
                  <td className="px-4 py-2">{game.receiving_tds || 0}</td>
                </>
              )}
              
              {(['WR', 'TE'].includes(playerPosition)) && (
                <>
                  <td className="px-4 py-2">{game.targets || 0}</td>
                  <td className="px-4 py-2">{game.receptions || 0}</td>
                  <td className="px-4 py-2">{game.receiving_yards || 0}</td>
                  <td className="px-4 py-2">{game.receiving_tds || 0}</td>
                </>
              )}
              
              <td className="px-4 py-2 font-bold text-green-400">
                {game.fantasy_points?.toFixed(1) || '0.0'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PlayerCardModal: React.FC<PlayerCardModalProps> = ({
  playerId,
  onClose,
}) => {
  const [player, setPlayer] = useState<any>(null);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const [outlook, setOutlook] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlayerData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`🔍 Fetching data for player ID: ${playerId}`);

        // Fetch player basic info from Sleeper
        const playerData = await getPlayerById(playerId);
        
        if (playerData) {
          setPlayer(playerData);
          console.log(`✅ Found player: ${playerData.full_name}`);
        } else {
          setError('Player not found.');
          return;
        }

        // Fetch player outlook from our API (connected to Supabase)
        try {
          const outlookRes = await fetch(`/api/player-outlook/${playerId}`);
          if (outlookRes.ok) {
            const outlookData = await outlookRes.json();
            if (outlookData.success && outlookData.outlook) {
              setOutlook(outlookData.outlook);
              console.log(`✅ Loaded outlook for ${playerData.full_name}`);
            } else {
              console.warn(`⚠️ No outlook found for ${playerData.full_name}`);
              setOutlook('Player summary not yet available.');
            }
          } else {
            console.warn(`⚠️ Outlook API error for ${playerData.full_name}:`, outlookRes.status);
            setOutlook('Unable to load player summary.');
          }
        } catch (outlookError) {
          console.warn(`⚠️ Failed to fetch outlook for ${playerData.full_name}:`, outlookError);
          setOutlook('Unable to load player summary.');
        }

        // Fetch game log from our API
        try {
          const gameLogRes = await fetch(`/api/player-gamelog/${playerId}`);
          if (gameLogRes.ok) {
            const gameLogData = await gameLogRes.json();
            if (gameLogData.success && gameLogData.gameLog) {
              setGameLog(gameLogData.gameLog);
              console.log(`✅ Loaded ${gameLogData.gameLog.length} games for ${playerData.full_name}`);
            }
          } else {
            console.warn(`⚠️ Game log API error for ${playerData.full_name}:`, gameLogRes.status);
          }
        } catch (gameLogError) {
          console.warn(`⚠️ Failed to fetch game log for ${playerData.full_name}:`, gameLogError);
        }

      } catch (err) {
        setError('Failed to fetch player data.');
        console.error('PlayerCardModal error:', err);
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
                  <h2 className="text-xl font-bold text-white">{player.full_name}</h2>
                  <p className="text-sm text-gray-400">
                    {player.team} • {player.position}
                  </p>
                  <div className="text-xs text-gray-500 mt-1">
                    Age: {player.age} • Height: {player.height ? convertInchesToFeet(player.height) : 'N/A'} • Weight:{' '}
                    {player.weight} lbs • EXP: {player.years_exp} yrs • College:{' '}
                    {player.college}
                  </div>
                </div>
              </div>

              <Tabs defaultValue="summary" className="mt-4">
                <TabsList>
                  <TabsTrigger value="summary">2025 Outlook</TabsTrigger>
                  <TabsTrigger value="gamelog">Game Log</TabsTrigger>
                  <TabsTrigger value="news">News</TabsTrigger>
                  <TabsTrigger value="ai">AI Insights</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <div className="text-sm text-gray-300 leading-relaxed">
                    {outlook || 'Loading player outlook...'}
                  </div>
                </TabsContent>
                
                <TabsContent value="gamelog">
                  <GameLogTab gameLog={gameLog} playerPosition={player.position} />
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
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
              
              {/* Player Stats Summary */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Position Rank:</span>
                    <span className="text-white">{player.search_rank || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fantasy Points:</span>
                    <span className="text-white">{player.fantasy_points || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400">{player.status || 'Active'}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default PlayerCardModal;
