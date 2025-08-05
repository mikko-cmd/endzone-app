import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

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
      // Try RapidAPI first
      const response = await axios.get(`${process.env.RAPIDAPI_BASE_URL}/getNFLPlayerSeasonStats`, {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
        },
        params: {
          playerName: playerId, // We'll need to map this properly
          season: '2024'
        },
        timeout: 5000
      });

      // Parse the response and extract relevant stats
      return this.parseSeasonStats(response.data, position);
    } catch (error) {
      console.log('⚠️ Failed to get season stats from API, using fallback');
      return this.getDefaultSeasonStats();
    }
  }

  // Get recent game performance
  private async getRecentGames(playerId: string, gameCount: number): Promise<GameStats[]> {
    try {
      // Check our cache first
      const { data: cachedGameLog } = await this.supabase
        .from('players')
        .select('game_log_2024')
        .eq('sleeper_id', playerId)
        .maybeSingle();

      if (cachedGameLog?.game_log_2024) {
        // Get last N games from cached data
        const allGames = cachedGameLog.game_log_2024;
        return allGames.slice(-gameCount);
      }

      return [];
    } catch (error) {
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
      games: 14,
      targets: 100,
      receptions: 65,
      receiving_yards: 850,
      receiving_tds: 6,
      fantasy_points: 165.5
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

export interface NFLWeekInfo {
  week: number;
  season: number;
  seasonType: 'PRE' | 'REG' | 'POST';
  isActive: boolean;
}

export class NFLWeekDetector {
  // NFL season dates (approximate - you'd want to get these from an API in production)
  private static readonly SEASON_2024 = {
    preseason: {
      start: new Date('2024-08-01'),
      end: new Date('2024-08-31')
    },
    regular: {
      start: new Date('2024-09-05'),
      end: new Date('2025-01-08')
    },
    playoffs: {
      start: new Date('2025-01-11'),
      end: new Date('2025-02-09')
    }
  };

  static getCurrentNFLWeek(): NFLWeekInfo {
    const now = new Date();
    const season = 2024; // Update this logic for multi-season support

    // Check if we're in preseason
    if (now >= this.SEASON_2024.preseason.start && now <= this.SEASON_2024.preseason.end) {
      const weeksSinceStart = Math.floor((now.getTime() - this.SEASON_2024.preseason.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return {
        week: Math.min(weeksSinceStart + 1, 4),
        season,
        seasonType: 'PRE',
        isActive: true
      };
    }

    // Check if we're in regular season
    if (now >= this.SEASON_2024.regular.start && now <= this.SEASON_2024.regular.end) {
      const weeksSinceStart = Math.floor((now.getTime() - this.SEASON_2024.regular.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return {
        week: Math.min(weeksSinceStart + 1, 18),
        season,
        seasonType: 'REG',
        isActive: true
      };
    }

    // Check if we're in playoffs
    if (now >= this.SEASON_2024.playoffs.start && now <= this.SEASON_2024.playoffs.end) {
      const weeksSinceStart = Math.floor((now.getTime() - this.SEASON_2024.playoffs.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return {
        week: Math.min(weeksSinceStart + 1, 4),
        season,
        seasonType: 'POST',
        isActive: true
      };
    }

    // Off-season - return upcoming season info
    return {
      week: 1,
      season: season + 1,
      seasonType: 'REG',
      isActive: false
    };
  }

  static getWeekInfo(week: number, season: number = 2024): NFLWeekInfo {
    return {
      week,
      season,
      seasonType: 'REG', // Simplified for now
      isActive: true
    };
  }
} 