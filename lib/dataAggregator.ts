import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { nflverseData } from './nflverseData';

// Types for our player analysis data
export interface PlayerAnalysisData {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  week: number;
  season: number;
  seasonStats: SeasonStats;
  recentGames: GameStats[];
  injuries: InjuryReport[];
  matchup: MatchupData;
  projections: ProjectionData;
  qbStatus: QBStatus;
}

export interface SeasonStats {
  games: number;
  targets?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  rushing_attempts?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  passing_attempts?: number;
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  fantasy_points: number;
}

export interface GameStats {
  week: number;
  opponent: string;
  fantasy_points: number;
  [key: string]: any; // For position-specific stats
}

export interface InjuryReport {
  status: 'Healthy' | 'Questionable' | 'Doubtful' | 'Out' | 'IR';
  description?: string;
  updatedAt: string;
}

export interface MatchupData {
  opponent: string;
  isHome: boolean;
  defensiveRank: number;
  defenseStyle: 'zone' | 'man' | 'mixed';
  pointsAllowedToPosition: number;
  yardsAllowedToPosition: number;
  gameSpread: number;
  overUnder: number;
}

export interface ProjectionData {
  fantasy_points: number;
  confidence: number;
  source: string;
}

export interface QBStatus {
  starter: string;
  isHealthy: boolean;
  backup?: string;
  injuryStatus?: string;
}

class DataAggregator {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // Main method to gather all player data for analysis
  async aggregatePlayerData(playerId: string, week?: number): Promise<PlayerAnalysisData> {
    const currentWeek = week || this.getCurrentNFLWeek();

    console.log(`🔍 Aggregating data for player ${playerId}, week ${currentWeek}`);

    // Get basic player info from our database
    const player = await this.getPlayerInfo(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Gather data from multiple sources in parallel
    const [
      seasonStats,
      recentGames,
      injuries,
      matchup,
      projections,
      qbStatus
    ] = await Promise.allSettled([
      this.getSeasonStats(playerId, player.position),
      this.getRecentGames(playerId, 5), // Last 5 games
      this.getInjuryReport(playerId),
      this.getMatchupData(player.team, currentWeek),
      this.getProjections(playerId, currentWeek),
      this.getQBStatus(player.team)
    ]);

    return {
      playerId,
      playerName: player.name,
      position: player.position,
      team: player.team,
      week: currentWeek,
      season: 2025,
      seasonStats: this.extractValue(seasonStats) || this.getDefaultSeasonStats(),
      recentGames: this.extractValue(recentGames) || [],
      injuries: this.extractValue(injuries) || [],
      matchup: this.extractValue(matchup) || this.getDefaultMatchup(player.team),
      projections: this.extractValue(projections) || this.getDefaultProjection(),
      qbStatus: this.extractValue(qbStatus) || this.getDefaultQBStatus()
    };
  }

  // Get player basic info from our Supabase database
  private async getPlayerInfo(playerId: string) {
    const { data, error } = await this.supabase
      .from('players')
      .select('sleeper_id, name, position, team')
      .eq('sleeper_id', playerId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching player info:', error);
      return null;
    }

    return data;
  }

  // Get season stats (from our existing APIs or cache)
  private async getSeasonStats(playerId: string, position: string): Promise<SeasonStats> {
    try {
      // Get player name from our database first
      const player = await this.getPlayerInfo(playerId);
      if (!player?.name) {
        return this.getDefaultSeasonStats();
      }

      // Try NFLverse data first (most reliable)
      console.log(`📊 Fetching real stats for ${player.name} from NFLverse...`);
      const nflverseStats = await nflverseData.getPlayerSeasonStats(player.name, 2024);

      if (nflverseStats) {
        console.log(`✅ Found NFLverse stats for ${player.name}`);
        return {
          games: nflverseStats.games,
          targets: nflverseStats.targets || 0,
          receptions: nflverseStats.receptions || 0,
          receiving_yards: nflverseStats.receiving_yards || 0,
          receiving_tds: nflverseStats.receiving_tds || 0,
          rushing_attempts: nflverseStats.carries || 0,
          rushing_yards: nflverseStats.rushing_yards || 0,
          rushing_tds: nflverseStats.rushing_tds || 0,
          passing_attempts: nflverseStats.attempts || 0,
          passing_yards: nflverseStats.passing_yards || 0,
          passing_tds: nflverseStats.passing_tds || 0,
          interceptions: nflverseStats.interceptions || 0,
          fantasy_points: nflverseStats.fantasy_points || 0
        };
      }

      // Fallback to RapidAPI if NFLverse fails
      console.log(`⚠️ NFLverse data not found for ${player.name}, trying RapidAPI...`);
      const response = await axios.get(`${process.env.RAPIDAPI_BASE_URL}/getNFLPlayerSeasonStats`, {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
        },
        params: {
          playerName: player.name,
          season: '2024'
        },
        timeout: 5000
      });

      return this.parseSeasonStats(response.data, position);
    } catch (error: any) {
      console.log('⚠️ Failed to get season stats from all sources, using fallback');
      return this.getDefaultSeasonStats();
    }
  }

  // Get recent game performance
  private async getRecentGames(playerId: string, gameCount: number): Promise<GameStats[]> {
    try {
      // Get player name first
      const player = await this.getPlayerInfo(playerId);
      if (!player?.name) {
        return [];
      }

      // Try NFLverse game logs first
      console.log(`📋 Fetching real game logs for ${player.name} from NFLverse...`);
      const gameLogs = await nflverseData.getPlayerGameLogs(player.name, 2024);

      if (gameLogs && gameLogs.length > 0) {
        console.log(`✅ Found ${gameLogs.length} game logs for ${player.name}`);

        // Convert to our format and get recent games
        const recentGames = gameLogs
          .sort((a, b) => b.week - a.week) // Most recent first
          .slice(0, gameCount)
          .map(log => ({
            week: log.week,
            opponent: log.opponent,
            fantasy_points: log.fantasy_points || 0,
            passing_yards: log.passing_yards,
            passing_tds: log.passing_tds,
            interceptions: log.interceptions,
            rushing_yards: log.rushing_yards,
            rushing_tds: log.rushing_tds,
            receptions: log.receptions,
            receiving_yards: log.receiving_yards,
            receiving_tds: log.receiving_tds,
            targets: log.targets
          }));

        return recentGames;
      }

      // Fallback to cached data from your existing system
      const { data: cachedGameLog } = await this.supabase
        .from('players')
        .select('game_log_2024')
        .eq('sleeper_id', playerId)
        .maybeSingle();

      if (cachedGameLog?.game_log_2024) {
        const allGames = cachedGameLog.game_log_2024;
        return allGames.slice(-gameCount);
      }

      return [];
    } catch (error: any) {
      console.log('⚠️ Failed to get recent games');
      return [];
    }
  }

  // Get injury status (mock for now, will integrate with real API)
  private async getInjuryReport(playerId: string): Promise<InjuryReport[]> {
    // TODO: Integrate with RotoWire or NFL injury API
    return [{
      status: 'Healthy',
      description: 'No injuries reported',
      updatedAt: new Date().toISOString()
    }];
  }

  // Get matchup data for the week
  private async getMatchupData(team: string, week: number): Promise<MatchupData> {
    // TODO: Get real matchup data from NFL schedule API
    return this.getDefaultMatchup(team);
  }

  // Get projections (mock for now)
  private async getProjections(playerId: string, week: number): Promise<ProjectionData> {
    return this.getDefaultProjection();
  }

  // Get QB status for team
  private async getQBStatus(team: string): Promise<QBStatus> {
    return this.getDefaultQBStatus();
  }

  // Utility methods
  private getCurrentNFLWeek(): number {
    // Simple logic - in real app, this would be more sophisticated
    const now = new Date();
    const seasonStart = new Date('2024-09-01'); // Approximate NFL season start
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(weeksSinceStart + 1, 1), 18); // Weeks 1-18
  }

  private extractValue(settledResult: PromiseSettledResult<any>) {
    return settledResult.status === 'fulfilled' ? settledResult.value : null;
  }

  private parseSeasonStats(apiData: any, position: string): SeasonStats {
    // TODO: Parse actual API response
    return this.getDefaultSeasonStats();
  }

  // Default/fallback data
  private getDefaultSeasonStats(): SeasonStats {
    return {
      games: 0,
      targets: 0,
      receptions: 0,
      receiving_yards: 0,
      receiving_tds: 0,
      rushing_attempts: 0,
      rushing_yards: 0,
      rushing_tds: 0,
      passing_attempts: 0,
      passing_yards: 0,
      passing_tds: 0,
      interceptions: 0,
      fantasy_points: 0
    };
  }

  private getDefaultMatchup(team: string): MatchupData {
    return {
      opponent: 'TBD',
      isHome: true,
      defensiveRank: 15,
      defenseStyle: 'mixed',
      pointsAllowedToPosition: 18.5,
      yardsAllowedToPosition: 240,
      gameSpread: -3,
      overUnder: 47.5
    };
  }

  private getDefaultProjection(): ProjectionData {
    return {
      fantasy_points: 12.5,
      confidence: 0.7,
      source: 'internal'
    };
  }

  private getDefaultQBStatus(): QBStatus {
    return {
      starter: 'Unknown',
      isHealthy: true
    };
  }
}

export const dataAggregator = new DataAggregator(); 