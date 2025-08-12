import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nflverseData } from '@/lib/nflverseData';

// Generate a realistic 17-week schedule for any NFL team
function generateTeamSchedule(team: string, season: number): string[] {
  // Common NFL opponents - this is a simplified version
  const nflTeams = [
    'BUF', 'MIA', 'NE', 'NYJ', 'BAL', 'CIN', 'CLE', 'PIT',
    'HOU', 'IND', 'JAX', 'TEN', 'DEN', 'KC', 'LV', 'LAC',
    'DAL', 'NYG', 'PHI', 'WAS', 'CHI', 'DET', 'GB', 'MIN',
    'ATL', 'CAR', 'NO', 'TB', 'ARI', 'LAR', 'SF', 'SEA'
  ];

  // Filter out the team itself
  const opponents = nflTeams.filter(t => t !== team);

  // Generate 17 weeks of opponents (some teams play twice)
  const schedule = [];
  for (let week = 1; week <= 17; week++) {
    const opponentIndex = (week - 1) % opponents.length;
    const opponent = opponents[opponentIndex];
    const isHome = week % 2 === 1; // Alternate home/away
    schedule.push(isHome ? `vs ${opponent}` : `@ ${opponent}`);
  }

  return schedule;
}

// 2024 NFL BYE weeks (known schedule)
const NFL_2024_BYE_WEEKS: Record<string, number> = {
  'ARI': 11, 'ATL': 12, 'BAL': 14, 'BUF': 12, 'CAR': 11, 'CHI': 7,
  'CIN': 12, 'CLE': 10, 'DAL': 7, 'DEN': 14, 'DET': 5, 'GB': 10,
  'HOU': 14, 'IND': 14, 'JAX': 12, 'KC': 6, 'LV': 10, 'LAC': 5,
  'LAR': 6, 'MIA': 6, 'MIN': 6, 'NE': 14, 'NO': 12, 'NYG': 11,
  'NYJ': 12, 'PHI': 5, 'PIT': 9, 'SF': 9, 'SEA': 10, 'TB': 11,
  'TEN': 5, 'WAS': 14
};

// Get team's BYE week for a given season
function getTeamByeWeek(team: string, season: number): number | null {
  if (season === 2024) {
    return NFL_2024_BYE_WEEKS[team] || null;
  }
  // For other seasons, use a pseudo-random BYE week
  return 6 + (team.charCodeAt(0) % 9);
}

// Check if a specific week is a BYE week for the team
function isTeamByeWeek(team: string, week: number, season: number): boolean {
  const byeWeek = getTeamByeWeek(team, season);
  return byeWeek === week;
}

export async function GET(
  request: Request,
  { params }: { params: { playerId: string } }
) {
  console.log(`🚀 GAME LOG API CALLED - Player ID: ${params.playerId}`);

  try {
    const { playerId } = params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh');
    const season = searchParams.get('season') || '2024'; // Default to 2024

    console.log(`🔍 Processing request for player ID: ${playerId}, season: ${season}, refresh: ${!!forceRefresh}`);

    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // Get player from Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('sleeper_id, name, position, team, game_log_2024, game_log_2023, game_log_2022, game_log_2021, game_log_2020, game_log_2019, game_log_2018, game_log_2017, game_log_2016, game_log_2015, game_log_2014, game_log_2013, game_log_2012, game_log_2011, game_log_2010, game_log_2009, game_log_updated_at')
      .eq('sleeper_id', playerId)
      .maybeSingle();

    if (playerError || !player) {
      console.error('❌ Player not found:', playerError);
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Check if we have fresh cached data (skip if force refresh)
    const cacheAge = player.game_log_updated_at ?
      Date.now() - new Date(player.game_log_updated_at).getTime() :
      Infinity;
    const cacheValidHours = 24; // Cache for 24 hours

    const cachedGameLog = (player as any)[`game_log_${season}`];
    if (!forceRefresh && cachedGameLog && cacheAge < (cacheValidHours * 60 * 60 * 1000)) {
      console.log(`📋 Using cached ${season} game log for ${player.name} (age: ${Math.round(cacheAge / (60 * 60 * 1000))}h)`);
      return NextResponse.json({
        success: true,
        gameLog: cachedGameLog,
        player: {
          name: player.name,
          position: player.position,
          team: player.team
        },
        lastUpdated: player.game_log_updated_at,
        source: 'cache',
        season: season
      });
    }

    // Fetch real game logs from NFLverse
    console.log(`🏈 Fetching real ${season} game logs from NFLverse for ${player.name}...`);

    try {
      const nflverseGameLogs = await nflverseData.getPlayerGameLogs(player.name, parseInt(season));

      if (nflverseGameLogs && nflverseGameLogs.length > 0) {
        console.log(`✅ Found ${nflverseGameLogs.length} real game logs for ${player.name}`);

        // Convert NFLverse data to a map for easy lookup
        const gamesByWeek = new Map<number, any>();
        nflverseGameLogs.forEach(log => {
          gamesByWeek.set(log.week, log);
        });

        // Generate all 17 weeks with data or placeholders
        const gameLogData = [];
        for (let week = 1; week <= 17; week++) {
          const log = gamesByWeek.get(week);
          const isByeWeek = isTeamByeWeek(player.team, week, parseInt(season));

          if (log) {
            // Player had stats this week - use real opponent from NFLverse data
            gameLogData.push({
              week: week,
              opponent: log.opponent, // Just use the opponent as-is
              date: `${season}-${String(8 + Math.floor(week / 4)).padStart(2, '0')}-${String(((week - 1) % 4) * 7 + 8).padStart(2, '0')}`,
              status: 'played',

              // Passing stats
              attempts: log.attempts || 0,
              completions: log.completions || 0,
              passing_yards: log.passing_yards || 0,
              passing_tds: log.passing_tds || 0,
              interceptions: log.interceptions || 0,

              // Rushing stats
              carries: log.carries || 0,
              rushing_yards: log.rushing_yards || 0,
              rushing_tds: log.rushing_tds || 0,

              // Receiving stats
              targets: log.targets || 0,
              receptions: log.receptions || 0,
              receiving_yards: log.receiving_yards || 0,
              receiving_tds: log.receiving_tds || 0,

              // Additional stats
              sacks: log.sacks || 0,
              sack_yards: log.sack_yards || 0,
              fumbles: (log.rushing_fumbles || 0) + (log.receiving_fumbles || 0),
              fumbles_lost: (log.rushing_fumbles_lost || 0) + (log.receiving_fumbles_lost || 0),

              // Fantasy points
              fantasy_points: log.fantasy_points || 0
            });
          } else if (isByeWeek) {
            // Team had a BYE week - show BYE
            gameLogData.push({
              week: week,
              opponent: 'BYE',
              date: `${season}-${String(8 + Math.floor(week / 4)).padStart(2, '0')}-${String(((week - 1) % 4) * 7 + 8).padStart(2, '0')}`,
              status: 'bye',

              // All stats as null to show as dashes
              attempts: null,
              completions: null,
              passing_yards: null,
              passing_tds: null,
              interceptions: null,

              carries: null,
              rushing_yards: null,
              rushing_tds: null,

              targets: null,
              receptions: null,
              receiving_yards: null,
              receiving_tds: null,

              sacks: null,
              sack_yards: null,
              fumbles: null,
              fumbles_lost: null,

              fantasy_points: null,
              snap_percentage: null,
              game_result: null
            });
          } else {
            // For placeholder games (when no real data exists), use the schedule generator
            const placeholderOpponent = generateTeamSchedule(player.team, parseInt(season))[week - 1];

            gameLogData.push({
              week: week,
              opponent: placeholderOpponent,
              date: `${season}-${String(8 + Math.floor(week / 4)).padStart(2, '0')}-${String(((week - 1) % 4) * 7 + 8).padStart(2, '0')}`,
              status: 'dnp',
              fantasy_points: 0,
              // All stats as null to show as dashes
              attempts: null,
              completions: null,
              passing_yards: null,
              passing_tds: null,
              interceptions: null,

              carries: null,
              rushing_yards: null,
              rushing_tds: null,

              targets: null,
              receptions: null,
              receiving_yards: null,
              receiving_tds: null,

              sacks: null,
              sack_yards: null,
              fumbles: null,
              fumbles_lost: null,

              fantasy_points: null,
              snap_percentage: null,
              game_result: null
            });
          }
        }

        // Cache the real data
        const updateData = {
          [`game_log_${season}`]: gameLogData,
          game_log_updated_at: new Date().toISOString()
        };

        await supabase
          .from('players')
          .update(updateData)
          .eq('sleeper_id', playerId);

        console.log(`✅ Successfully cached ${gameLogData.length} real games for ${player.name}`);

        return NextResponse.json({
          success: true,
          gameLog: gameLogData,
          player: {
            name: player.name,
            position: player.position,
            team: player.team
          },
          source: 'nflverse-live',
          season: season
        });
      } else {
        console.log(`⚠️ No NFLverse game logs found for ${player.name}`);
      }
    } catch (nflverseError: any) {
      console.log(`❌ NFLverse failed for ${player.name}: ${nflverseError.message}`);
    }

    // Fallback: Generate all 17 weeks with dashes if no data found
    console.log(`📊 No real game log data available for ${player.name} - generating empty 17-week schedule`);

    // Generate a realistic schedule even for fallback
    const teamSchedule = generateTeamSchedule(player.team, parseInt(season));

    const emptyGameLog: any[] = [];
    for (let week = 1; week <= 17; week++) {
      const isByeWeek = isTeamByeWeek(player.team, week, parseInt(season));
      const opponent = isByeWeek ? 'BYE' : teamSchedule[week - 1];
      const status = isByeWeek ? 'bye' : 'dnp';

      emptyGameLog.push({
        week: week,
        opponent: opponent,
        date: `${season}-${String(8 + Math.floor(week / 4)).padStart(2, '0')}-${String(((week - 1) % 4) * 7 + 8).padStart(2, '0')}`,
        status: status,

        // All stats as null to show as dashes
        attempts: null,
        completions: null,
        passing_yards: null,
        passing_tds: null,
        interceptions: null,

        carries: null,
        rushing_yards: null,
        rushing_tds: null,

        targets: null,
        receptions: null,
        receiving_yards: null,
        receiving_tds: null,

        sacks: null,
        sack_yards: null,
        fumbles: null,
        fumbles_lost: null,

        fantasy_points: null,
        snap_percentage: null,
        game_result: null
      });
    }

    return NextResponse.json({
      success: true,
      gameLog: emptyGameLog,
      player: {
        name: player.name,
        position: player.position,
        team: player.team
      },
      source: 'no-data',
      season: season
    });

  } catch (error: any) {
    console.error('❌ Game log API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch game log' },
      { status: 500 }
    );
  }
}

// Helper function to calculate fantasy points
function calculateFantasyPoints(stats: any): number {
  const passingYards = (stats?.passing?.yards || 0) * 0.04;
  const passingTds = (stats?.passing?.touchdowns || 0) * 4;
  const interceptions = (stats?.passing?.interceptions || 0) * -2;
  const rushingYards = (stats?.rushing?.yards || 0) * 0.1;
  const rushingTds = (stats?.rushing?.touchdowns || 0) * 6;
  const receptions = (stats?.receiving?.receptions || 0) * 1;
  const receivingYards = (stats?.receiving?.yards || 0) * 0.1;
  const receivingTds = (stats?.receiving?.touchdowns || 0) * 6;

  return Math.round((passingYards + passingTds + interceptions + rushingYards + rushingTds + receptions + receivingYards + receivingTds) * 10) / 10;
}

// Generate realistic mock data for 2024 season
function generateRealistic2024GameLog(playerName: string, position: string, team: string): any[] {
  const opponents = ['BUF', 'MIA', 'NE', 'NYJ', 'BAL', 'CIN', 'CLE', 'PIT', 'HOU', 'IND', 'JAX', 'TEN', 'DEN', 'KC', 'LV', 'LAC', 'DAL'];
  const gameLog: any[] = [];

  for (let week = 1; week <= 17; week++) {
    const opponent = opponents[week % opponents.length];
    const baseStats = getBaseStatsForPosition(position);
    const variance = 0.3; // 30% variance

    gameLog.push({
      week,
      opponent,
      date: `2024-${9 + Math.floor(week / 4)}-${(week % 4) * 7 + 1}`,
      passing_yards: position === 'QB' ? Math.round(baseStats.passing_yards * (1 + (Math.random() - 0.5) * variance)) : 0,
      passing_tds: position === 'QB' ? Math.round(baseStats.passing_tds * (1 + (Math.random() - 0.5) * variance)) : 0,
      interceptions: position === 'QB' ? Math.round(baseStats.interceptions * (1 + (Math.random() - 0.5) * variance)) : 0,
      rushing_yards: ['QB', 'RB'].includes(position) ? Math.round(baseStats.rushing_yards * (1 + (Math.random() - 0.5) * variance)) : 0,
      rushing_tds: ['QB', 'RB'].includes(position) ? Math.round(baseStats.rushing_tds * (1 + (Math.random() - 0.5) * variance)) : 0,
      receptions: ['WR', 'TE', 'RB'].includes(position) ? Math.round(baseStats.receptions * (1 + (Math.random() - 0.5) * variance)) : 0,
      receiving_yards: ['WR', 'TE', 'RB'].includes(position) ? Math.round(baseStats.receiving_yards * (1 + (Math.random() - 0.5) * variance)) : 0,
      receiving_tds: ['WR', 'TE', 'RB'].includes(position) ? Math.round(baseStats.receiving_tds * (1 + (Math.random() - 0.5) * variance)) : 0,
      targets: ['WR', 'TE', 'RB'].includes(position) ? Math.round(baseStats.targets * (1 + (Math.random() - 0.5) * variance)) : 0,
      fantasy_points: 0, // Will be calculated
      game_result: Math.random() > 0.5 ? 'W' : 'L'
    });
  }

  // Calculate fantasy points for each game
  gameLog.forEach(game => {
    game.fantasy_points = calculateFantasyPoints(game);
  });

  return gameLog;
}

function getBaseStatsForPosition(position: string) {
  switch (position) {
    case 'QB':
      return { passing_yards: 250, passing_tds: 1.5, interceptions: 0.8, rushing_yards: 25, rushing_tds: 0.3, receptions: 0, receiving_yards: 0, receiving_tds: 0, targets: 0 };
    case 'RB':
      return { passing_yards: 0, passing_tds: 0, interceptions: 0, rushing_yards: 80, rushing_tds: 0.7, receptions: 3, receiving_yards: 25, receiving_tds: 0.2, targets: 4 };
    case 'WR':
      return { passing_yards: 0, passing_tds: 0, interceptions: 0, rushing_yards: 2, rushing_tds: 0.1, receptions: 5, receiving_yards: 70, receiving_tds: 0.6, targets: 8 };
    case 'TE':
      return { passing_yards: 0, passing_tds: 0, interceptions: 0, rushing_yards: 1, rushing_tds: 0.05, receptions: 4, receiving_yards: 45, receiving_tds: 0.4, targets: 6 };
    default:
      return { passing_yards: 0, passing_tds: 0, interceptions: 0, rushing_yards: 0, rushing_tds: 0, receptions: 0, receiving_yards: 0, receiving_tds: 0, targets: 0 };
  }
}

// Auto-detect current NFL week
function getCurrentNFLWeek(): { week: number; season: number } {
  // Smart logic to determine current week
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 0-indexed

  // NFL season typically runs Sept-Feb
  if (currentMonth >= 9 || currentMonth <= 2) {
    const season = currentMonth >= 9 ? currentYear : currentYear - 1;
    // Rough week calculation (can be improved)
    const seasonStart = new Date(season, 8, 1); // Sept 1st
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const week = Math.min(Math.max(weeksSinceStart, 1), 18); // Weeks 1-18

    return { week, season };
  }

  // Off-season, return previous season
  return { week: 18, season: currentYear - 1 };
}

interface AdvancedMatchup {
  defenseVsPosition: {
    rank: number;
    pointsAllowed: number;
    yardageAllowed: number;
  };
  weatherConditions: any;
  gameScript: {
    predictedSpread: number;
    overUnder: number;
    gameFlow: 'positive' | 'negative' | 'neutral';
  };
  historicalMatchup: {
    headToHead: any[];
    playerVsDefense: any[];
  };
}