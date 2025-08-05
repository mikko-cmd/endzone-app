'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPlayerById } from '@/lib/sleeper/fetchAllPlayers';
import LoadingArc from './LoadingArc';
import { getStatColorClass, getStatStyle } from '@/lib/performanceColors';

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
  status?: string; // Added for DNP/BYE
  attempts?: number; // Added for QB stats
  completions?: number; // Added for QB stats
  snap_percentage?: number; // Added for FANTASY stats
  sacks?: number; // Added for SACKED stats
  sack_yards?: number; // Added for SACKED stats
  fumbles?: number; // Added for FUMBLE stats
  fumbles_lost?: number; // Added for FUMBLE stats
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

const GameLogTab = ({ gameLog, playerPosition, playerTeam, player, playerId, seasonGameLogs, setSeasonGameLogs }: {
  gameLog: GameLogEntry[];
  playerPosition: string;
  playerTeam?: string;
  player?: any;
  playerId: string;
  seasonGameLogs: Record<string, GameLogEntry[]>;
  setSeasonGameLogs: React.Dispatch<React.SetStateAction<Record<string, GameLogEntry[]>>>;
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

  const startYear = Math.max(correctRookieYear, 2000); // Allow historical seasons back to 2000

  const seasons = [];
  for (let year = currentYear; year >= startYear; year--) {
    seasons.push(year.toString());
  }

  console.log(`🏈 Player: ${player?.full_name}, Years Exp: ${yearsExp}, Rookie Year: ${correctRookieYear}, Seasons: ${seasons}`);

  const [selectedSeason, setSelectedSeason] = useState(seasons[0] || '2025');
  const [schedule2025] = useState(() => generate2025Schedule(playerTeam || ''));
  const [loadingSeason, setLoadingSeason] = useState<string | null>(null);

  // Effect to fetch season data when season is selected
  useEffect(() => {
    if (selectedSeason !== '2025' && !seasonGameLogs[selectedSeason] && player?.full_name) {
      fetchSeasonGameLog(selectedSeason);
    }
  }, [selectedSeason, player?.full_name]);

  // Function to fetch game log for a specific season
  const fetchSeasonGameLog = async (season: string) => {
    if (seasonGameLogs[season] || loadingSeason === season) {
      return; // Already loaded or loading
    }

    setLoadingSeason(season);
    try {
      console.log(`🏈 Fetching ${season} game log for ${player?.full_name}...`);
      const response = await fetch(`/api/player-gamelog/${playerId}?season=${season}&refresh=${Date.now()}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.gameLog) {
          setSeasonGameLogs(prev => ({ ...prev, [season]: data.gameLog }));
          console.log(`✅ Loaded ${data.gameLog.length} games for ${player?.full_name} (${season})`);
        }
      } else {
        console.warn(`⚠️ Failed to fetch ${season} game log:`, response.status);
      }
    } catch (error) {
      console.error(`❌ Error fetching ${season} game log:`, error);
    } finally {
      setLoadingSeason(null);
    }
  };

  // Common scrollable table component
  const ScrollableGameTable = ({ data, isSchedule = false, emptyMessage, playerPosition }: {
    data: any[];
    isSchedule?: boolean;
    emptyMessage: string;
    playerPosition: string;
  }) => (
    <div className="flex-1 overflow-hidden">
      {data && data.length > 0 ? (
        <div className="h-full overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#101010] z-10">
              {/* Section Headers Row */}
              <tr className="border-b border-gray-600">
                <th className="px-2 py-1"></th> {/* Week */}
                <th className="px-2 py-1"></th> {/* Opponent */}

                {/* QUARTERBACK SECTIONS */}
                {playerPosition === 'QB' && (
                  <>
                    {/* FANTASY Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-purple-400 font-semibold text-xs">FANTASY</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* PASS Section */}
                    <th colSpan={5} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-blue-400 font-semibold text-xs">PASS</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* RUSHING Section */}
                    <th colSpan={3} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-green-400 font-semibold text-xs">RUSH</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* SACKED Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-red-400 font-semibold text-xs">SACKED</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* FUMBLE Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-orange-400 font-semibold text-xs">FUMBLE</div>
                    </th>
                  </>
                )}

                {/* RUNNING BACK SECTIONS */}
                {playerPosition === 'RB' && (
                  <>
                    {/* FANTASY Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-purple-400 font-semibold text-xs">FANTASY</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* RUSHING Section */}
                    <th colSpan={4} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-green-400 font-semibold text-xs">RUSHING</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* RECEIVING Section */}
                    <th colSpan={6} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-blue-400 font-semibold text-xs">RECEIVING</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* FUMBLE Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-orange-400 font-semibold text-xs">FUMBLE</div>
                    </th>
                  </>
                )}

                {/* WIDE RECEIVER SECTIONS */}
                {playerPosition === 'WR' && (
                  <>
                    {/* FANTASY Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-purple-400 font-semibold text-xs">FANTASY</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* RECEIVING Section */}
                    <th colSpan={6} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-blue-400 font-semibold text-xs">RECEIVING</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* FUMBLE Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-orange-400 font-semibold text-xs">FUMBLE</div>
                    </th>
                  </>
                )}

                {/* TIGHT END SECTIONS */}
                {playerPosition === 'TE' && (
                  <>
                    {/* FANTASY Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-purple-400 font-semibold text-xs">FANTASY</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* RECEIVING Section */}
                    <th colSpan={6} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-blue-400 font-semibold text-xs">RECEIVING</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-[#101010]"></th>

                    {/* FUMBLE Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-gray-600">
                      <div className="text-orange-400 font-semibold text-xs">FUMBLE</div>
                    </th>
                  </>
                )}
              </tr>

              {/* Column Headers Row */}
              <tr className="border-b border-gray-700 text-gray-300">
                <th className="px-2 py-2 text-center text-xs">WK</th>
                <th className="px-2 py-2 text-xs">OPP</th>

                {/* QUARTERBACK COLUMNS */}
                {playerPosition === 'QB' && (
                  <>
                    {/* FANTASY Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">FPTS</th>
                    <th className="px-1 py-2 text-center text-xs">SNAP%</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* PASS Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">ATT</th>
                    <th className="px-1 py-2 text-center text-xs">CMP</th>
                    <th className="px-1 py-2 text-center text-xs">YDS</th>
                    <th className="px-1 py-2 text-center text-xs">TD</th>
                    <th className="px-1 py-2 text-center text-xs">INT</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* RUSHING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">ATT</th>
                    <th className="px-1 py-2 text-center text-xs">YDS</th>
                    <th className="px-1 py-2 text-center text-xs">TD</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* SACKED Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">SK</th>
                    <th className="px-1 py-2 text-center text-xs">YDS</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* FUMBLE Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">FUM</th>
                    <th className="px-1 py-2 text-center text-xs">LOST</th>
                  </>
                )}

                {/* RUNNING BACK COLUMNS */}
                {playerPosition === 'RB' && (
                  <>
                    {/* FANTASY Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">FPTS</th>
                    <th className="px-1 py-2 text-center text-xs">SNAP%</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* RUSHING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">ATT</th>
                    <th className="px-1 py-2 text-center text-xs">YDS</th>
                    <th className="px-1 py-2 text-center text-xs">YPC</th>
                    <th className="px-1 py-2 text-center text-xs">TD</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* RECEIVING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">TGT</th>
                    <th className="px-1 py-2 text-center text-xs">REC</th>
                    <th className="px-1 py-2 text-center text-xs">YDS</th>
                    <th className="px-1 py-2 text-center text-xs">YPT</th>
                    <th className="px-1 py-2 text-center text-xs">YPC</th>
                    <th className="px-1 py-2 text-center text-xs">TD</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* FUMBLE Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">FUM</th>
                    <th className="px-1 py-2 text-center text-xs">LOST</th>
                  </>
                )}

                {/* WIDE RECEIVER COLUMNS */}
                {playerPosition === 'WR' && (
                  <>
                    {/* FANTASY Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">FPTS</th>
                    <th className="px-1 py-2 text-center text-xs">SNAP%</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* RECEIVING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">TGT</th>
                    <th className="px-1 py-2 text-center text-xs">REC</th>
                    <th className="px-1 py-2 text-center text-xs">YDS</th>
                    <th className="px-1 py-2 text-center text-xs">YPT</th>
                    <th className="px-1 py-2 text-center text-xs">YPC</th>
                    <th className="px-1 py-2 text-center text-xs">TD</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* FUMBLE Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">FUM</th>
                    <th className="px-1 py-2 text-center text-xs">LOST</th>
                  </>
                )}

                {/* TIGHT END COLUMNS */}
                {playerPosition === 'TE' && (
                  <>
                    {/* FANTASY Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">FPTS</th>
                    <th className="px-1 py-2 text-center text-xs">SNAP%</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* RECEIVING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">TGT</th>
                    <th className="px-1 py-2 text-center text-xs">REC</th>
                    <th className="px-1 py-2 text-center text-xs">YDS</th>
                    <th className="px-1 py-2 text-center text-xs">YPT</th>
                    <th className="px-1 py-2 text-center text-xs">YPC</th>
                    <th className="px-1 py-2 text-center text-xs">TD</th>
                    <th className="w-2 px-0 py-2 bg-[#101010]"></th>

                    {/* FUMBLE Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-gray-600">FUM</th>
                    <th className="px-1 py-2 text-center text-xs">LOST</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((game, index) => {
                // Calculate derived stats
                const yardsPerCarry = (game.carries && game.carries > 0 && game.rushing_yards)
                  ? (game.rushing_yards / game.carries).toFixed(1)
                  : null;
                const yardsPerTarget = (game.targets && game.targets > 0 && game.receiving_yards)
                  ? (game.receiving_yards / game.targets).toFixed(1)
                  : null;
                const yardsPerCatch = (game.receptions && game.receptions > 0 && game.receiving_yards)
                  ? (game.receiving_yards / game.receptions).toFixed(1)
                  : null;

                return (
                  <tr
                    key={game.week || index}
                    className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${index % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-800/30'
                      }`}
                  >
                    {/* Common columns for all positions */}
                    <td className="px-2 py-2 text-center font-medium">{game.week}</td>
                    <td className="px-2 py-2 font-medium">
                      {game.opponent}
                    </td>

                    {/* QUARTERBACK TABLE BODY */}
                    {playerPosition === 'QB' && (
                      <>
                        {/* FANTASY Section */}
                        <td
                          className="px-1 py-2 text-center text-xs font-medium border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('fantasy_points', game.fantasy_points, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fantasy_points || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('snap_percentage', game.snap_percentage, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.snap_percentage ? `${game.snap_percentage}%` : '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* PASS Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('attempts', game.attempts, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.attempts || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('completions', game.completions, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.completions || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('passing_yards', game.passing_yards, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.passing_yards || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('passing_tds', game.passing_tds, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.passing_tds || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('interceptions', game.interceptions, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.interceptions || '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* RUSHING Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('carries', game.carries, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.carries || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('rushing_yards', game.rushing_yards, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.rushing_yards || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('rushing_tds', game.rushing_tds, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.rushing_tds || '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* SACKED Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('sacks', game.sacks, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.sacks || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('sack_yards', game.sack_yards, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.sack_yards || '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* FUMBLE Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('fumbles', game.fumbles, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('fumbles_lost', game.fumbles_lost, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles_lost || '-')}
                        </td>
                      </>
                    )}

                    {/* RUNNING BACK TABLE BODY */}
                    {playerPosition === 'RB' && (
                      <>
                        {/* FANTASY Section */}
                        <td
                          className="px-1 py-2 text-center text-xs font-medium border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('fantasy_points', game.fantasy_points, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fantasy_points || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('snap_percentage', game.snap_percentage, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.snap_percentage ? `${game.snap_percentage}%` : '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* RUSHING Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('carries', game.carries, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.carries || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('rushing_yards', game.rushing_yards, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.rushing_yards || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' || !yardsPerCarry ? {} : getStatStyle('yards_per_carry', parseFloat(yardsPerCarry), playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerCarry || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('rushing_tds', game.rushing_tds, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.rushing_tds || '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* RECEIVING Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('targets', game.targets, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.targets || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('receptions', game.receptions, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.receptions || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('receiving_yards', game.receiving_yards, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_yards || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' || !yardsPerTarget ? {} : getStatStyle('yards_per_target', parseFloat(yardsPerTarget), playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerTarget || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' || !yardsPerCatch ? {} : getStatStyle('yards_per_catch', parseFloat(yardsPerCatch), playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerCatch || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('receiving_tds', game.receiving_tds, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_tds || '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* FUMBLE Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('fumbles', game.fumbles, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('fumbles_lost', game.fumbles_lost, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles_lost || '-')}
                        </td>
                      </>
                    )}

                    {/* WIDE RECEIVER TABLE BODY */}
                    {playerPosition === 'WR' && (
                      <>
                        {/* FANTASY Section */}
                        <td
                          className="px-1 py-2 text-center text-xs font-medium border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('fantasy_points', game.fantasy_points, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fantasy_points || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('snap_percentage', game.snap_percentage, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.snap_percentage ? `${game.snap_percentage}%` : '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* RECEIVING Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('targets', game.targets, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.targets || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('receptions', game.receptions, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.receptions || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('receiving_yards', game.receiving_yards, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_yards || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' || !yardsPerTarget ? {} : getStatStyle('yards_per_target', parseFloat(yardsPerTarget), playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerTarget || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' || !yardsPerCatch ? {} : getStatStyle('yards_per_catch', parseFloat(yardsPerCatch), playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerCatch || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('receiving_tds', game.receiving_tds, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_tds || '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* FUMBLE Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('fumbles', game.fumbles, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('fumbles_lost', game.fumbles_lost, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles_lost || '-')}
                        </td>
                      </>
                    )}

                    {/* TIGHT END TABLE BODY */}
                    {playerPosition === 'TE' && (
                      <>
                        {/* FANTASY Section */}
                        <td
                          className="px-1 py-2 text-center text-xs font-medium border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('fantasy_points', game.fantasy_points, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fantasy_points || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('snap_percentage', game.snap_percentage, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.snap_percentage ? `${game.snap_percentage}%` : '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* RECEIVING Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('targets', game.targets, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.targets || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('receptions', game.receptions, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.receptions || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('receiving_yards', game.receiving_yards, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_yards || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' || !yardsPerTarget ? {} : getStatStyle('yards_per_target', parseFloat(yardsPerTarget), playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerTarget || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' || !yardsPerCatch ? {} : getStatStyle('yards_per_catch', parseFloat(yardsPerCatch), playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerCatch || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('receiving_tds', game.receiving_tds, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_tds || '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-[#101010]"></td>

                        {/* FUMBLE Section */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-gray-600"
                          style={game.status === 'dnp' ? {} : getStatStyle('fumbles', game.fumbles, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={game.status === 'dnp' ? {} : getStatStyle('fumbles_lost', game.fumbles_lost, playerPosition)}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles_lost || '-')}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
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
            className={`px-4 py-2 font-medium transition-colors ${selectedSeason === season
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
        <ScrollableGameTable
          data={schedule2025}
          isSchedule={true}
          emptyMessage="2025 Schedule Not Available"
          playerPosition={playerPosition}
        />
      )}

      {selectedSeason !== '2025' && (
        <>
          {loadingSeason === selectedSeason ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                <div>Loading {selectedSeason} game log...</div>
              </div>
            </div>
          ) : (
            <ScrollableGameTable
              data={seasonGameLogs[selectedSeason] || []}
              isSchedule={false}
              emptyMessage={`${selectedSeason} Game Log Not Available`}
              playerPosition={playerPosition}
            />
          )}
        </>
      )}
    </div>
  );
};

const debugColor = (statName: string, value: number, position: string) => {
  console.log(`🔍 DEBUG: ${statName} = ${value} for ${position}`);
  const colorClass = getStatColorClass(statName, value, position);
  console.log(`🎨 Color class: "${colorClass}"`);
  return colorClass;
};

const PlayerCardModal: React.FC<PlayerCardModalProps> = ({
  playerId,
  onClose,
}) => {
  const [player, setPlayer] = useState<any>(null);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]); // Keep for 2024 compatibility
  const [seasonGameLogs, setSeasonGameLogs] = useState<Record<string, GameLogEntry[]>>({});
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

        // Fetch 2024 game log from our API (for backward compatibility)
        try {
          // Add timestamp to force fresh data
          const gameLogRes = await fetch(`/api/player-gamelog/${playerId}?season=2024&refresh=${Date.now()}`);
          if (gameLogRes.ok) {
            const gameLogData = await gameLogRes.json();
            if (gameLogData.success && gameLogData.gameLog) {
              setGameLog(gameLogData.gameLog);
              setSeasonGameLogs(prev => ({ ...prev, '2024': gameLogData.gameLog }));
              console.log(`✅ Loaded ${gameLogData.gameLog.length} games for ${playerData.full_name} (2024)`);
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
                    playerId={playerId}
                    seasonGameLogs={seasonGameLogs}
                    setSeasonGameLogs={setSeasonGameLogs}
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
