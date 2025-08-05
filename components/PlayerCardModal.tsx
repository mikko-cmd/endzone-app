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

interface ScheduleEntry {
  week: number;
  opponent: string;
  date: string;
  // Remove gameTime property
  isHome: boolean;
}

// Height conversion utility
const convertInchesToFeet = (inches: number) => {
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
};

// Add this function to generate 2025 schedule
const generate2025Schedule = (playerTeam: string): ScheduleEntry[] => {
  // NFL 2025 schedule (simplified - you can make this more accurate later)
  const schedule: ScheduleEntry[] = [];
  const opponents = [
    'vs DAL', '@PHI', 'vs NYG', '@WAS', 'vs SF', '@LAR', 'vs SEA', '@ARI', 
    'vs GB', '@DET', 'vs CHI', '@MIN', 'vs ATL', '@NO', 'vs TB', '@CAR', 'vs BUF'
  ];
  
  for (let week = 1; week <= 17; week++) {
    const opponent = opponents[week - 1] || `Week ${week}`;
    const isHome = !opponent.startsWith('@');
    
    schedule.push({
      week,
      opponent,
      date: `2025-${String(Math.floor(week / 4) + 9).padStart(2, '0')}-${String((week % 4) * 7 + 1).padStart(2, '0')}`,
      // Remove gameTime property
      isHome
    });
  }
  
  return schedule;
};

const GameLogTab = ({ gameLog, playerPosition, playerTeam, player }: { 
  gameLog: GameLogEntry[]; 
  playerPosition: string;
  playerTeam?: string;
  player?: any;
}) => {
  // Dynamic seasons based on player's years of experience
  const currentYear = 2025;
  const yearsExp = player?.years_exp || 0;
  
  // If they have 1 year of experience, their rookie year was 2024
  // If they have 4 years of experience, their rookie year was 2021
  const rookieYear = currentYear - 1 - yearsExp; // 2025 - 1 - 1 = 2023 (WRONG!)
  
  // Actually, let me fix this:
  // If years_exp = 1, they played in 2024 (rookie year = 2024)
  // If years_exp = 4, they played in 2021, 2022, 2023, 2024 (rookie year = 2021)
  const correctRookieYear = currentYear - yearsExp; // 2025 - 1 = 2024 ✅
  
  const startYear = Math.max(correctRookieYear, 2020); // Don't go before 2020
  
  const seasons = [];
  for (let year = currentYear; year >= startYear; year--) {
    seasons.push(year.toString());
  }

  console.log(`🏈 Player: ${player?.full_name}, Years Exp: ${yearsExp}, Rookie Year: ${correctRookieYear}, Seasons: ${seasons}`);

  const [selectedSeason, setSelectedSeason] = useState(seasons[0] || '2025');
  const [schedule2025] = useState(() => generate2025Schedule(playerTeam || ''));

  // Common scrollable table component
  const ScrollableGameTable = ({ data, isSchedule = false, emptyMessage }: { 
    data: any[]; 
    isSchedule?: boolean; 
    emptyMessage: string;
  }) => (
    <div className="flex-1 overflow-hidden">
      {data && data.length > 0 ? (
        <div className="h-full overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#101010] z-10">
              <tr className="border-b border-gray-700 text-gray-300">
                <th className="px-3 py-2 text-center">Week</th>
                <th className="px-3 py-2">Opponent</th>
                <th className="px-3 py-2 text-center">Date</th>
                {playerPosition === 'QB' && (
                  <>
                    <th className="px-3 py-2 text-center">Pass Yds</th>
                    <th className="px-3 py-2 text-center">Pass TD</th>
                    <th className="px-3 py-2 text-center">INT</th>
                    <th className="px-3 py-2 text-center">Rush Yds</th>
                    <th className="px-3 py-2 text-center">Rush TD</th>
                  </>
                )}
                {playerPosition === 'RB' && (
                  <>
                    <th className="px-3 py-2 text-center">Carries</th>
                    <th className="px-3 py-2 text-center">Rush Yds</th>
                    <th className="px-3 py-2 text-center">Rush TD</th>
                    <th className="px-3 py-2 text-center">Rec</th>
                    <th className="px-3 py-2 text-center">Rec Yds</th>
                    <th className="px-3 py-2 text-center">Rec TD</th>
                  </>
                )}
                {(['WR', 'TE'].includes(playerPosition)) && (
                  <>
                    <th className="px-3 py-2 text-center">Targets</th>
                    <th className="px-3 py-2 text-center">Rec</th>
                    <th className="px-3 py-2 text-center">Rec Yds</th>
                    <th className="px-3 py-2 text-center">Rec TD</th>
                  </>
                )}
                <th className="px-3 py-2 text-center bg-green-900/30">Fantasy Pts</th>
              </tr>
            </thead>
            <tbody>
              {data.map((game, index) => (
                <tr 
                  key={game.week || index} 
                  className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                    index % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-800/30'
                  }`}
                >
                  <td className="px-3 py-2 text-center font-medium">{game.week}</td>
                  <td className="px-3 py-2 font-medium">{game.opponent}</td>
                  <td className="px-3 py-2 text-center text-gray-400">{game.date}</td>
                  
                  {playerPosition === 'QB' && (
                    <>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('passing_yards', game.passing_yards, playerPosition)}`}>
                        {isSchedule ? '-' : (game.passing_yards || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('passing_tds', game.passing_tds, playerPosition)}`}>
                        {isSchedule ? '-' : (game.passing_tds || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('interceptions', game.interceptions, playerPosition, true)}`}>
                        {isSchedule ? '-' : (game.interceptions || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('rushing_yards', game.rushing_yards, playerPosition)}`}>
                        {isSchedule ? '-' : (game.rushing_yards || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('rushing_tds', game.rushing_tds, playerPosition)}`}>
                        {isSchedule ? '-' : (game.rushing_tds || '-')}
                      </td>
                    </>
                  )}
                  
                  {playerPosition === 'RB' && (
                    <>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('carries', game.carries, playerPosition)}`}>
                        {isSchedule ? '-' : (game.carries || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('rushing_yards', game.rushing_yards, playerPosition)}`}>
                        {isSchedule ? '-' : (game.rushing_yards || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('rushing_tds', game.rushing_tds, playerPosition)}`}>
                        {isSchedule ? '-' : (game.rushing_tds || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('receptions', game.receptions, playerPosition)}`}>
                        {isSchedule ? '-' : (game.receptions || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('receiving_yards', game.receiving_yards, playerPosition)}`}>
                        {isSchedule ? '-' : (game.receiving_yards || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('receiving_tds', game.receiving_tds, playerPosition)}`}>
                        {isSchedule ? '-' : (game.receiving_tds || '-')}
                      </td>
                    </>
                  )}
                  
                  {(['WR', 'TE'].includes(playerPosition)) && (
                    <>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('targets', game.targets, playerPosition)}`}>
                        {isSchedule ? '-' : (game.targets || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('receptions', game.receptions, playerPosition)}`}>
                        {isSchedule ? '-' : (game.receptions || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('receiving_yards', game.receiving_yards, playerPosition)}`}>
                        {isSchedule ? '-' : (game.receiving_yards || '-')}
                      </td>
                      <td className={`px-3 py-2 text-center ${getStatColorClass('receiving_tds', game.receiving_tds, playerPosition)}`}>
                        {isSchedule ? '-' : (game.receiving_tds || '-')}
                      </td>
                    </>
                  )}
                  
                  <td className="px-3 py-2 text-center">{isSchedule ? '-' : (game.fantasy_points || '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-lg mb-2">📊 {emptyMessage}</div>
            <div className="text-sm">
              {isSchedule ? 'Schedule will be updated closer to the season' : 'Game statistics not available'}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 h-[400px] flex flex-col">
      {/* Dynamic Season Tabs */}
      <div className="flex gap-2 border-b border-gray-700 flex-shrink-0">
        {seasons.map(season => (
          <button
            key={season}
            onClick={() => setSelectedSeason(season)}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedSeason === season
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {season}
          </button>
        ))}
      </div>

      {/* Season Content */}
      {selectedSeason === '2025' && (
        <>
          <ScrollableGameTable 
            data={schedule2025} 
            isSchedule={true} 
            emptyMessage="2025 Schedule Not Available" 
          />
          <div className="text-center text-sm text-gray-400 space-y-1 flex-shrink-0">
            <div>📅 2025 Regular Season Schedule</div>
            <div>🏈 Games will show stats once the season begins</div>
          </div>
        </>
      )}

      {selectedSeason === '2024' && (
        <ScrollableGameTable 
          data={gameLog} 
          isSchedule={false} 
          emptyMessage="2024 Game Log Not Available" 
        />
      )}

      {selectedSeason !== '2025' && selectedSeason !== '2024' && (
        <ScrollableGameTable 
          data={[]} 
          isSchedule={false} 
          emptyMessage={`${selectedSeason} Game Log Not Available`} 
        />
      )}
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
          // Add timestamp to force fresh data
          const gameLogRes = await fetch(`/api/player-gamelog/${playerId}?refresh=${Date.now()}`);
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
        className="bg-[#101010] rounded-2xl p-6 w-[1000px] h-[700px] overflow-hidden shadow-xl relative"
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
          <div className="w-full h-full flex flex-col">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
            >
              <X size={18} />
            </button>

            {/* Player Header */}
            <div className="flex items-center space-x-4 mb-4">
              <img
                src={`https://sleepercdn.com/content/nfl/players/${playerId}.jpg`}
                className="h-24 w-24 rounded-full"
                alt={player.full_name}
              />
              <div>
                <h2 className="text-2xl font-bold text-white">{player.full_name}</h2>
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

            {/* Full Width Tabs */}
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="summary" className="h-full flex flex-col">
                <TabsList className="w-fit">
                  <TabsTrigger value="summary">2025 Outlook</TabsTrigger>
                  <TabsTrigger value="gamelog">Game Log</TabsTrigger>
                  <TabsTrigger value="news">News</TabsTrigger>
                  <TabsTrigger value="ai">AI Insights</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="flex-1 overflow-y-auto mt-4">
                  <div className="text-sm text-gray-300 leading-relaxed">
                    {outlook || 'Loading player outlook...'}
                  </div>
                </TabsContent>
                
                <TabsContent value="gamelog" className="flex-1 overflow-hidden mt-4">
                  <GameLogTab 
                    gameLog={gameLog} 
                    playerPosition={player?.position || ''} 
                    playerTeam={player?.team || ''}
                    player={player} // Pass full player object for rookie year calculation
                  />
                </TabsContent>
                
                <TabsContent value="news" className="flex-1 overflow-y-auto mt-4">
                  <p className="text-sm text-gray-400">
                    Recent news from Rotowire or other sources will appear here.
                  </p>
                </TabsContent>
                
                <TabsContent value="ai" className="flex-1 overflow-y-auto mt-4">
                  <p className="text-sm text-gray-400">
                    AI-generated insights coming soon.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PlayerCardModal;
