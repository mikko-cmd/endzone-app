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

const nfl2025Schedule: Record<string, string[]> = {
  'ARI': ['@NO', 'CAR', '@SF', 'SEA', 'TEN', '@IND', 'GB', 'BYE', '@DAL', '@SEA', 'SF', 'JAX', '@TB', 'LAR', '@HOU', 'ATL', '@CIN', '@LAR'],
  'ATL': ['TB', '@MIN', '@CAR', 'WSH', 'BYE', 'BUF', '@SF', 'MIA', '@NE', '@IND', 'CAR', '@NO', '@NYJ', 'SEA', '@TB', '@ARI', 'LAR', 'NO'],
  'BAL': ['@BUF', 'CLE', 'DET', '@KC', 'HOU', 'LAR', 'BYE', 'CHI', '@MIA', '@MIN', '@CLE', 'NYJ', 'CIN', 'PIT', '@CIN', 'NE', '@GB', '@PIT'],
  'BUF': ['BAL', '@NYJ', 'MIA', 'NO', 'NE', '@ATL', 'BYE', '@CAR', 'KC', '@MIA', 'TB', '@HOU', '@PIT', 'CIN', '@NE', '@CLE', 'PHI', 'NYJ'],
  'CAR': ['@JAX', '@ARI', 'ATL', '@NE', 'MIA', 'DAL', '@NYJ', 'BUF', '@GB', 'NO', '@ATL', '@SF', 'LAR', 'BYE', '@NO', 'TB', 'SEA', '@TB'],
  'CHI': ['MIN', '@DET', 'DAL', '@LV', 'BYE', '@WSH', 'NO', '@BAL', '@CIN', 'NYG', '@MIN', 'PIT', '@PHI', '@GB', 'CLE', 'GB', '@SF', 'DET'],
  'CIN': ['@CLE', 'JAX', '@MIN', '@DEN', 'DET', '@GB', 'PIT', 'NYJ', 'CHI', 'BYE', '@PIT', 'NE', '@BAL', '@BUF', 'BAL', '@MIA', 'ARI', 'CLE'],
  'CLE': ['CIN', '@BAL', 'GB', '@DET', 'MIN', '@PIT', 'MIA', '@NE', 'BYE', '@NYJ', 'BAL', '@LV', 'SF', 'TEN', '@CHI', 'BUF', 'PIT', '@CIN'],
  'DAL': ['@PHI', 'NYG', '@CHI', 'GB', '@NYJ', '@CAR', 'WSH', '@DEN', 'ARI', 'BYE', '@LV', 'PHI', 'KC', '@DET', 'MIN', 'LAC', '@WSH', '@NYG'],
  'DEN': ['TEN', '@IND', '@LAC', 'CIN', '@PHI', '@NYJ', 'NYG', 'DAL', '@HOU', 'LV', 'KC', 'BYE', '@WSH', '@LV', 'GB', 'JAX', '@KC', 'LAC'],
  'DET': ['@GB', 'CHI', '@BAL', 'CLE', '@CIN', '@KC', 'TB', 'BYE', 'MIN', '@WSH', '@PHI', 'NYG', 'GB', 'DAL', '@LAR', 'PIT', '@MIN', '@CHI'],
  'GB': ['DET', 'WSH', '@CLE', '@DAL', 'BYE', 'CIN', '@ARI', '@PIT', 'CAR', 'PHI', '@NYG', 'MIN', '@DET', 'CHI', '@DEN', '@CHI', 'BAL', '@MIN'],
  'HOU': ['@LAR', 'TB', '@JAX', 'TEN', '@BAL', 'BYE', '@SEA', 'SF', 'DEN', 'JAX', '@TEN', 'BUF', '@IND', '@KC', 'ARI', 'LV', '@LAC', 'IND'],
  'IND': ['MIA', 'DEN', '@TEN', '@LAR', 'LV', 'ARI', '@LAC', 'TEN', '@PIT', 'ATL', 'BYE', '@KC', 'HOU', '@JAX', '@SEA', 'SF', 'JAX', '@HOU'],
  'JAX': ['CAR', '@CIN', 'HOU', '@SF', 'KC', 'SEA', 'LAR', 'BYE', '@LV', '@HOU', 'LAC', '@ARI', '@TEN', 'IND', 'NYJ', '@DEN', '@IND', 'TEN'],
  'KC': ['@LAC', 'PHI', '@NYG', 'BAL', '@JAX', 'DET', 'LV', 'WSH', '@BUF', 'BYE', '@DEN', 'IND', '@DAL', 'HOU', 'LAC', '@TEN', 'DEN', '@LV'],
  'LV': ['@NE', 'LAC', '@WSH', 'CHI', '@IND', 'TEN', '@KC', 'BYE', 'JAX', '@DEN', 'DAL', 'CLE', '@LAC', 'DEN', '@PHI', '@HOU', 'NYG', 'KC'],
  'LAR': ['HOU', '@TEN', '@PHI', 'IND', 'SF', '@BAL', '@JAX', 'BYE', 'NO', '@SF', 'SEA', 'TB', '@CAR', '@ARI', 'DET', '@SEA', '@ATL', 'ARI'],
  'LAC': ['KC', '@LV', 'DEN', '@NYG', 'WSH', '@MIA', 'IND', 'MIN', '@TEN', 'PIT', '@JAX', 'BYE', 'LV', 'PHI', '@KC', '@DAL', 'HOU', '@DEN'],
  'MIA': ['@IND', 'NE', '@BUF', 'NYJ', '@CAR', 'LAC', '@CLE', '@ATL', 'BAL', 'BUF', 'WSH', 'BYE', 'NO', '@NYJ', '@PIT', 'CIN', 'TB', '@NE'],
  'MIN': ['@CHI', 'ATL', 'CIN', '@PIT', '@CLE', 'BYE', 'PHI', '@LAC', '@DET', 'BAL', 'CHI', '@GB', '@SEA', 'WSH', '@DAL', '@NYG', 'DET', 'GB'],
  'NE': ['LV', '@MIA', 'PIT', 'CAR', '@BUF', '@NO', '@TEN', 'CLE', 'ATL', '@TB', 'NYJ', '@CIN', 'NYG', 'BYE', 'BUF', '@BAL', '@NYJ', 'MIA'],
  'NO': ['ARI', 'SF', '@SEA', '@BUF', 'NYG', 'NE', '@CHI', 'TB', '@LAR', '@CAR', 'BYE', 'ATL', '@MIA', '@TB', 'CAR', 'NYJ', '@TEN', '@ATL'],
  'NYG': ['@WSH', '@DAL', 'KC', 'LAC', '@NO', 'PHI', '@DEN', '@PHI', 'SF', '@CHI', 'GB', '@DET', '@NE', 'BYE', 'WSH', 'MIN', '@LV', 'DAL'],
  'NYJ': ['PIT', 'BUF', '@TB', '@MIA', 'DAL', 'DEN', 'CAR', '@CIN', 'BYE', 'CLE', '@NE', '@BAL', 'ATL', 'MIA', '@JAX', '@NO', 'NE', '@BUF'],
  'PHI': ['DAL', '@KC', 'LAR', '@TB', 'DEN', '@NYG', '@MIN', 'NYG', 'BYE', '@GB', 'DET', '@DAL', 'CHI', '@LAC', 'LV', '@WSH', '@BUF', 'WSH'],
  'PIT': ['@NYJ', 'SEA', '@NE', 'MIN', 'BYE', 'CLE', '@CIN', 'GB', 'IND', '@LAC', 'CIN', '@CHI', 'BUF', '@BAL', 'MIA', '@DET', '@CLE', 'BAL'],
  'SF': ['@SEA', '@NO', 'ARI', 'JAX', '@LAR', '@TB', 'ATL', '@HOU', '@NYG', 'LAR', '@ARI', 'CAR', '@CLE', 'BYE', 'TEN', '@IND', 'CHI', 'SEA'],
  'SEA': ['SF', '@PIT', 'NO', '@ARI', 'TB', '@JAX', 'HOU', 'BYE', '@WSH', 'ARI', '@LAR', '@TEN', 'MIN', '@ATL', 'IND', 'LAR', '@CAR', '@SF'],
  'TB': ['@ATL', '@HOU', 'NYJ', 'PHI', '@SEA', 'SF', '@DET', '@NO', 'BYE', 'NE', '@BUF', '@LAR', 'ARI', 'NO', 'ATL', '@CAR', '@MIA', 'CAR'],
  'TEN': ['@DEN', 'LAR', 'IND', '@HOU', '@ARI', '@LV', 'NE', '@IND', 'LAC', 'BYE', 'HOU', 'SEA', 'JAX', '@CLE', '@SF', 'KC', 'NO', '@JAX'],
  'WSH': ['NYG', '@GB', 'LV', '@ATL', '@LAC', 'CHI', '@DAL', '@KC', 'SEA', 'DET', '@MIA', 'BYE', 'DEN', '@MIN', '@NYG', 'PHI', 'DAL', '@PHI']
};

const generate2025Schedule = (playerTeam: string): ScheduleEntry[] => {
  const schedule: ScheduleEntry[] = [];
  const teamSchedule = nfl2025Schedule[playerTeam?.toUpperCase()] || [];

  // NFL 2025 season starts around September 7, 2025 (Week 1)
  const seasonStartDate = new Date('2025-09-07');

  for (let week = 1; week <= 18; week++) {
    const opponent = teamSchedule[week - 1];

    if (opponent === 'BYE') {
      schedule.push({
        week,
        opponent: 'BYE',
        date: getWeekDate(seasonStartDate, week),
        isHome: true // BYE weeks are "home"
      });
    } else if (opponent) {
      const isHome = !opponent.startsWith('@');
      const opponentTeam = opponent.replace('@', '');

      schedule.push({
        week,
        opponent: isHome ? `vs ${opponentTeam}` : `@ ${opponentTeam}`,
        date: getWeekDate(seasonStartDate, week),
        isHome
      });
    } else {
      // Fallback for unknown opponents
      schedule.push({
        week,
        opponent: `Week ${week}`,
        date: getWeekDate(seasonStartDate, week),
        isHome: true
      });
    }
  }

  return schedule;
};

// Helper function to calculate game dates
const getWeekDate = (seasonStart: Date, week: number): string => {
  const gameDate = new Date(seasonStart);
  gameDate.setDate(seasonStart.getDate() + ((week - 1) * 7));

  return gameDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
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
  const correctRookieYear = currentYear - yearsExp; // 2025 - 1 = 2024, 2025 - 4 = 2021

  // Generate seasons from rookie year to 2024, plus 2025
  const startYear = Math.max(correctRookieYear, 2000); // Don't go before 2000
  const seasons: string[] = [];

  // Add 2025 first (upcoming season)
  seasons.push('2025');

  // Add historical seasons from most recent to oldest
  for (let year = 2024; year >= startYear; year--) {
    seasons.push(year.toString());
  }

  const [selectedSeason, setSelectedSeason] = useState('2024');
  const [loadingSeason, setLoadingSeason] = useState<string | null>(null);

  // 2025 schedule (placeholder data)
  const schedule2025 = generate2025Schedule(playerTeam || '');

  const fetchSeasonGameLog = async (season: string) => {
    if (seasonGameLogs[season] || season === '2025') return; // Already loaded or is 2025 schedule

    setLoadingSeason(season);
    try {
      console.log(`🔄 Fetching ${season} game log for player ${playerId}`);
      const response = await fetch(`/api/player-gamelog/${playerId}?season=${season}&refresh=${Date.now()}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.gameLog) {
          setSeasonGameLogs(prev => ({ ...prev, [season]: data.gameLog }));
          console.log(`✅ Loaded ${data.gameLog.length} games for ${season}`);
        }
      } else {
        console.warn(`⚠️ Failed to fetch ${season} game log:`, response.status);
      }
    } catch (error: any) {
      console.error(`❌ Error fetching ${season} game log:`, error);
    } finally {
      setLoadingSeason(null);
    }
  };

  // Common scrollable table component
  const ScrollableGameTable = ({ data, isSchedule = false, emptyMessage, playerPosition }: {
    data: Record<string, any>[];  // More specific than any[]
    isSchedule?: boolean;
    emptyMessage: string;
    playerPosition: string;
  }) => (
    <div className="flex-1 overflow-hidden">
      {data && data.length > 0 ? (
        <div className="h-full overflow-y-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black z-10 border border-white">
              {/* Section Headers Row */}
              <tr className="border-b border-white">
                <th className="px-2 py-1 border-r border-white"></th> {/* Week */}
                <th className="px-2 py-1 border-r border-white"></th> {/* Opponent */}

                {/* QUARTERBACK SECTIONS */}
                {playerPosition === 'QB' && (
                  <>
                    {/* FANTASY Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>FANTASY</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* PASS Section */}
                    <th colSpan={5} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>PASS</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* RUSHING Section */}
                    <th colSpan={3} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>RUSH</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* SACKED Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>SACKED</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* FUMBLE Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>FUMBLE</div>
                    </th>
                  </>
                )}

                {/* RUNNING BACK SECTIONS */}
                {playerPosition === 'RB' && (
                  <>
                    {/* FANTASY Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>FANTASY</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* RUSHING Section */}
                    <th colSpan={4} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>RUSHING</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* RECEIVING Section */}
                    <th colSpan={6} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>RECEIVING</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* FUMBLE Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>FUMBLE</div>
                    </th>
                  </>
                )}

                {/* WIDE RECEIVER SECTIONS */}
                {playerPosition === 'WR' && (
                  <>
                    {/* FANTASY Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>FANTASY</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* RECEIVING Section */}
                    <th colSpan={6} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>RECEIVING</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* FUMBLE Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>FUMBLE</div>
                    </th>
                  </>
                )}

                {/* TIGHT END SECTIONS */}
                {playerPosition === 'TE' && (
                  <>
                    {/* FANTASY Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>FANTASY</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* RECEIVING Section */}
                    <th colSpan={6} className="px-1 py-1 text-center border-l border-white border-r border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>RECEIVING</div>
                    </th>
                    <th className="w-2 px-0 py-1 bg-black border-r border-white"></th>

                    {/* FUMBLE Section */}
                    <th colSpan={2} className="px-1 py-1 text-center border-l border-white">
                      <div className="text-white font-semibold text-xs" style={{ fontFamily: 'Consolas, monospace' }}>FUMBLE</div>
                    </th>
                  </>
                )}
              </tr>

              {/* Column Headers Row */}
              <tr className="border-b border-white text-white">
                <th className="px-2 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>WK</th>
                <th className="px-2 py-2 text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>OPP</th>

                {/* QUARTERBACK COLUMNS */}
                {playerPosition === 'QB' && (
                  <>
                    {/* FANTASY Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>FPTS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>SNAP%</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* PASS Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>ATT</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>CMP</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YDS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>TD</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>INT</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* RUSHING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>ATT</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YDS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>TD</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* SACKED Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>SK</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YDS</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* FUMBLE Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>FUM</th>
                    <th className="px-1 py-2 text-center text-xs" style={{ fontFamily: 'Consolas, monospace' }}>LOST</th>
                  </>
                )}

                {/* RUNNING BACK COLUMNS */}
                {playerPosition === 'RB' && (
                  <>
                    {/* FANTASY Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>FPTS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>SNAP%</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* RUSHING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>ATT</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YDS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YPC</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>TD</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* RECEIVING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>TGT</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>REC</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YDS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YPT</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YPC</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>TD</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* FUMBLE Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>FUM</th>
                    <th className="px-1 py-2 text-center text-xs" style={{ fontFamily: 'Consolas, monospace' }}>LOST</th>
                  </>
                )}

                {/* WIDE RECEIVER COLUMNS */}
                {playerPosition === 'WR' && (
                  <>
                    {/* FANTASY Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>FPTS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>SNAP%</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* RECEIVING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>TGT</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>REC</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YDS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YPT</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YPC</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>TD</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* FUMBLE Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>FUM</th>
                    <th className="px-1 py-2 text-center text-xs" style={{ fontFamily: 'Consolas, monospace' }}>LOST</th>
                  </>
                )}

                {/* TIGHT END COLUMNS */}
                {playerPosition === 'TE' && (
                  <>
                    {/* FANTASY Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>FPTS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>SNAP%</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* RECEIVING Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>TGT</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>REC</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YDS</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YPT</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>YPC</th>
                    <th className="px-1 py-2 text-center text-xs border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>TD</th>
                    <th className="w-2 px-0 py-2 bg-black border-r border-white"></th>

                    {/* FUMBLE Columns */}
                    <th className="px-1 py-2 text-center text-xs border-l border-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>FUM</th>
                    <th className="px-1 py-2 text-center text-xs" style={{ fontFamily: 'Consolas, monospace' }}>LOST</th>
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
                  <tr key={index} className="border-b border-white hover:bg-gray-900">
                    <td className="px-2 py-2 text-center text-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>{game.week}</td>
                    <td className="px-2 py-2 text-white border-r border-white" style={{ fontFamily: 'Consolas, monospace' }}>{game.opponent}</td>

                    {/* QUARTERBACK DATA */}
                    {playerPosition === 'QB' && (
                      <>
                        {/* FANTASY Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('fantasy_points', game.fantasy_points || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fantasy_points || 0).toFixed(1)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('snap_percentage', game.snap_percentage || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.snap_percentage ? `${game.snap_percentage}%` : '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* PASS Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('attempts', game.attempts || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.attempts || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('completions', game.completions || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.completions || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('passing_yards', game.passing_yards || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.passing_yards || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('passing_tds', game.passing_tds || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.passing_tds || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('interceptions', game.interceptions || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.interceptions || 0)}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* RUSHING Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('carries', game.carries || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.carries || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('rushing_yards', game.rushing_yards || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.rushing_yards || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('rushing_tds', game.rushing_tds || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.rushing_tds || 0)}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* SACKED Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('sacks', game.sacks || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.sacks || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('sack_yards', game.sack_yards || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.sack_yards || 0)}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* FUMBLE Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('fumbles', game.fumbles || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={{ ...getStatStyle('fumbles_lost', game.fumbles_lost || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles_lost || 0)}
                        </td>
                      </>
                    )}

                    {/* RUNNING BACK DATA */}
                    {playerPosition === 'RB' && (
                      <>
                        {/* FANTASY Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('fantasy_points', game.fantasy_points || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fantasy_points || 0).toFixed(1)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('snap_percentage', game.snap_percentage || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.snap_percentage ? `${game.snap_percentage}%` : '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* RUSHING Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('carries', game.carries || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.carries || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('rushing_yards', game.rushing_yards || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.rushing_yards || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('yards_per_carry', yardsPerCarry ? parseFloat(yardsPerCarry) : 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerCarry || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('rushing_tds', game.rushing_tds || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.rushing_tds || 0)}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* RECEIVING Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('targets', game.targets || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.targets || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('receptions', game.receptions || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.receptions || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('receiving_yards', game.receiving_yards || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_yards || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('yards_per_target', yardsPerTarget ? parseFloat(yardsPerTarget) : 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerTarget || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('yards_per_catch', yardsPerCatch ? parseFloat(yardsPerCatch) : 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerCatch || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('receiving_tds', game.receiving_tds || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_tds || 0)}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* FUMBLE Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('fumbles', game.fumbles || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={{ ...getStatStyle('fumbles_lost', game.fumbles_lost || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles_lost || 0)}
                        </td>
                      </>
                    )}

                    {/* WIDE RECEIVER DATA */}
                    {playerPosition === 'WR' && (
                      <>
                        {/* FANTASY Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('fantasy_points', game.fantasy_points || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fantasy_points || 0).toFixed(1)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('snap_percentage', game.snap_percentage || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.snap_percentage ? `${game.snap_percentage}%` : '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* RECEIVING Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('targets', game.targets || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.targets || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('receptions', game.receptions || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.receptions || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('receiving_yards', game.receiving_yards || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_yards || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('yards_per_target', yardsPerTarget ? parseFloat(yardsPerTarget) : 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerTarget || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('yards_per_catch', yardsPerCatch ? parseFloat(yardsPerCatch) : 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerCatch || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('receiving_tds', game.receiving_tds || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_tds || 0)}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* FUMBLE Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('fumbles', game.fumbles || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={{ ...getStatStyle('fumbles_lost', game.fumbles_lost || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles_lost || 0)}
                        </td>
                      </>
                    )}

                    {/* TIGHT END DATA */}
                    {playerPosition === 'TE' && (
                      <>
                        {/* FANTASY Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('fantasy_points', game.fantasy_points || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fantasy_points || 0).toFixed(1)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('snap_percentage', game.snap_percentage || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.snap_percentage ? `${game.snap_percentage}%` : '-')}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* RECEIVING Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('targets', game.targets || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.targets || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('receptions', game.receptions || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.receptions || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('receiving_yards', game.receiving_yards || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_yards || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('yards_per_target', yardsPerTarget ? parseFloat(yardsPerTarget) : 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerTarget || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('yards_per_catch', yardsPerCatch ? parseFloat(yardsPerCatch) : 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (yardsPerCatch || '-')}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs border-r border-white"
                          style={{ ...getStatStyle('receiving_tds', game.receiving_tds || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.receiving_tds || 0)}
                        </td>
                        <td className="w-2 px-0 py-2 bg-black border-r border-white"></td>

                        {/* FUMBLE Data */}
                        <td
                          className="px-1 py-2 text-center text-xs border-l border-white border-r border-white"
                          style={{ ...getStatStyle('fumbles', game.fumbles || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles || 0)}
                        </td>
                        <td
                          className="px-1 py-2 text-center text-xs"
                          style={{ ...getStatStyle('fumbles_lost', game.fumbles_lost || 0, playerPosition), fontFamily: 'Consolas, monospace' }}
                        >
                          {game.status === 'dnp' ? '-' : (game.fumbles_lost || 0)}
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
        <div className="flex-1 flex items-center justify-center text-white" style={{ fontFamily: 'Consolas, monospace' }}>
          {emptyMessage}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Season Selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {seasons.map(season => (
          <button
            key={season}
            onClick={() => {
              setSelectedSeason(season);
              if (season !== '2025' && season !== '2024') {
                fetchSeasonGameLog(season);
              }
            }}
            className={`px-3 py-1 text-xs border border-white transition-colors ${selectedSeason === season
              ? 'bg-white text-black'
              : 'bg-black text-white hover:bg-gray-900'
              }`}
            style={{ fontFamily: 'Consolas, monospace' }}
            disabled={loadingSeason === season}
          >
            {loadingSeason === season ? 'Loading...' : season}
          </button>
        ))}
      </div>

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
              <div className="text-center text-white">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                <div style={{ fontFamily: 'Consolas, monospace' }}>Loading {selectedSeason} game log...</div>
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
  const [playerNews, setPlayerNews] = useState<any>(null);

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
        } else {
          setError('Player not found.');
          return;
        }

        // Create safeName after we know playerData exists
        const safeName = playerData.full_name || `${playerData.first_name} ${playerData.last_name}` || 'Unknown Player';
        console.log(`✅ Found player: ${safeName}`);

        // Enhanced summary fetching with fallback
        try {
          console.log(`🚀 Fetching enhanced summary for ${safeName}...`);

          // Try enhanced summary API first
          const enhancedRes = await fetch(`/api/players/enhanced-summary?name=${encodeURIComponent(safeName)}`);

          if (enhancedRes.ok) {
            const enhancedData = await enhancedRes.json();

            if (enhancedData.summary) {
              // Display enhanced summary with context
              let summaryText = enhancedData.summary;

              // Add context information if available
              if (enhancedData.context && enhancedData.enhanced) {
                const context = enhancedData.context;
                let contextInfo = '\n\n🎯 Key Analytics:\n';

                if (context.adpRound) {
                  contextInfo += `• Draft Position: Round ${context.adpRound}\n`;
                }
                if (context.usage) {
                  contextInfo += `• Team Usage: ${context.usage}%\n`;
                }
                if (context.redZoneTDs) {
                  contextInfo += `• Red Zone TDs: ${context.redZoneTDs}\n`;
                }
                if (context.insights && context.insights.length > 0) {
                  contextInfo += `• Profile: ${context.insights[0]}\n`;
                }

                // Add enhanced badge
                summaryText = `🤖 ENHANCED AI ANALYSIS\n\n${summaryText}${contextInfo}`;
              }

              setOutlook(summaryText);
              console.log(`✅ Loaded enhanced summary for ${safeName}`);
            } else {
              throw new Error('No enhanced summary available');
            }
          } else {
            throw new Error(`Enhanced API error: ${enhancedRes.status}`);
          }

        } catch (enhancedError) {
          console.warn(`⚠️ Enhanced summary failed for ${safeName}, falling back...`, enhancedError);

          // Fallback to existing outlook API
          try {
            const outlookRes = await fetch(`/api/players/${playerId}/outlook`);
            if (outlookRes.ok) {
              const outlookData = await outlookRes.json();
              if (outlookData.success && outlookData.outlook) {
                setOutlook(outlookData.outlook);
                console.log(`✅ Loaded fallback outlook for ${safeName}`);
              } else {
                console.warn(`⚠️ No outlook found for ${safeName}`);
                setOutlook('Player summary not yet available. Enhanced AI analysis coming soon!');
              }
            } else {
              console.warn(`⚠️ Outlook API error for ${safeName}:`, outlookRes.status);
              setOutlook('Unable to load player summary.');
            }
          } catch (outlookError) {
            console.warn(`⚠️ Failed to fetch outlook for ${safeName}:`, outlookError);
            setOutlook('Unable to load player summary.');
          }
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
              console.log(`✅ Loaded ${gameLogData.gameLog.length} games for ${safeName} (2024)`);
            }
          } else {
            console.warn(`⚠️ Game log API error for ${safeName}:`, gameLogRes.status);
          }
        } catch (gameLogError) {
          console.warn(`⚠️ Failed to fetch game log for ${safeName}:`, gameLogError);
        }

        // Fetch player news
        try {
          console.log(`📰 Fetching news for ${safeName}...`);
          const newsRes = await fetch(`/api/player-news/${playerId}`);

          if (newsRes.ok) {
            const newsData = await newsRes.json();
            setPlayerNews(newsData);
            console.log('📰 Player news', { playerId, count: newsData.count, lastUpdated: newsData.lastUpdated });
            console.log(`✅ Loaded ${newsData.count} news articles for ${safeName}`);
          } else {
            console.warn(`⚠️ Failed to fetch news for ${safeName}`);
            setPlayerNews({ news: [], count: 0 });
          }
        } catch (error: any) {
          console.error('❌ Error fetching player news:', error);
          setPlayerNews({ news: [], count: 0 });
        }

      } catch (error: any) {
        console.error('❌ Error in fetchPlayerData:', error);
        setError('Failed to load player data.');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-black border border-white rounded-2xl p-6 w-[1000px] h-[700px] overflow-hidden shadow-xl relative"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="w-full flex items-center justify-center">
            <LoadingArc />
          </div>
        ) : error ? (
          <div className="w-full flex items-center justify-center text-red-500" style={{ fontFamily: 'Consolas, monospace' }}>
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
                className="h-24 w-24 rounded-full bg-black object-cover border border-white"
                alt={player?.full_name || player?.name || 'Unknown Player'}
              />
              <div>
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Consolas, monospace' }}>{player?.full_name || player?.name || 'Unknown Player'}</h2>
                <p className="text-sm text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                  {player?.team} • {player?.position}
                </p>
                <div className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Consolas, monospace' }}>
                  Age: {player?.age} • Height: {player?.height ? convertInchesToFeet(player.height) : 'N/A'} • Weight:{' '}
                  {player?.weight} lbs • EXP: {player?.years_exp || 0} yrs • College:{' '}
                  {player?.college}
                </div>
              </div>
            </div>

            {/* Full Width Tabs */}
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="summary" className="h-full flex flex-col">
                <TabsList className="w-fit bg-black border border-white">
                  <TabsTrigger value="summary" className="text-white data-[state=active]:bg-white data-[state=active]:text-black" style={{ fontFamily: 'Consolas, monospace' }}>2025 Outlook</TabsTrigger>
                  <TabsTrigger value="gamelog" className="text-white data-[state=active]:bg-white data-[state=active]:text-black" style={{ fontFamily: 'Consolas, monospace' }}>Game Log</TabsTrigger>
                  <TabsTrigger value="news" className="text-white data-[state=active]:bg-white data-[state=active]:text-black" style={{ fontFamily: 'Consolas, monospace' }}>News</TabsTrigger>
                  <TabsTrigger value="ai" className="text-white data-[state=active]:bg-white data-[state=active]:text-black" style={{ fontFamily: 'Consolas, monospace' }}>AI Insights</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="flex-1 overflow-y-auto terminal-scrollbar mt-4">
                  <div className="text-sm text-white leading-relaxed" style={{ fontFamily: 'Consolas, monospace' }}>
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

                <TabsContent value="news" className="flex-1 overflow-y-auto terminal-scrollbar mt-4">
                  <div className="text-sm text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                    <h3 className="font-semibold mb-1">Recent News</h3>
                    {playerNews?.lastUpdated && (
                      <p className="text-xs text-gray-400 mb-3">
                        Last updated: {new Date(playerNews.lastUpdated).toLocaleString()}
                      </p>
                    )}

                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingArc />
                        <span className="ml-2">Loading news...</span>
                      </div>
                    ) : playerNews?.news?.length > 0 ? (
                      <>
                        <p className="text-xs text-gray-400 mb-4">
                          {playerNews.count} recent articles found
                        </p>
                        {playerNews.news.map((newsItem: any) => (
                          <div key={newsItem.id} className="border-b border-gray-700 pb-3 mb-3 last:border-b-0">
                            <h4 className="font-semibold text-sm text-white leading-tight">
                              {newsItem.headline}
                            </h4>
                            <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                              {newsItem.description}
                            </p>
                            <div className="flex items-center justify-between mt-3">
                              <p className="text-xs text-gray-500">
                                {new Date(newsItem.published_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })} • ESPN
                              </p>
                              {typeof newsItem.relevance_score === 'number' && (
                                <span className="text-xs text-blue-400">
                                  Relevance: {newsItem.relevance_score}/10
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <p>No recent news found for this player.</p>
                        <p className="text-xs mt-2">News updates daily from ESPN.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="flex-1 overflow-y-auto mt-4">
                  <p className="text-sm text-white" style={{ fontFamily: 'Consolas, monospace' }}>
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
