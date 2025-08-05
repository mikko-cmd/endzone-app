import axios from 'axios';
import { parse } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';

interface NFLversePlayerStats {
  player_id: string;
  player_name: string;
  player_display_name: string;
  position: string;
  team: string;
  season: number;
  games: number;
  completions?: number;
  attempts?: number;
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  carries?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  targets?: number;
  fantasy_points?: number;
}

interface NFLverseGameLog {
  player_id: string;
  player_name: string;
  player_display_name: string;
  week: number;
  season: number;
  team: string;
  opponent: string;
  
  // Passing stats
  attempts?: number;
  completions?: number;
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  
  // Rushing stats
  carries?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  
  // Receiving stats
  targets?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  
  // Additional stats
  sacks?: number;
  sack_yards?: number;
  rushing_fumbles?: number;
  rushing_fumbles_lost?: number;
  receiving_fumbles?: number;
  receiving_fumbles_lost?: number;
  
  // Fantasy points
  fantasy_points?: number;
}

export class NFLverseDataFetcher {
  private supabase;
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // Download and cache NFLverse season stats
  async fetchSeasonStats(season: number): Promise<NFLversePlayerStats[]> {
    console.log(`📥 Downloading NFLverse season stats for ${season}...`);
    
    try {
      // Check if we already have this data cached
      const cached = await this.getCachedSeasonStats(season);
      if (cached && cached.length > 0) {
        console.log(`✅ Using cached NFLverse data for ${season} (${cached.length} players)`);
        return cached;
      }

      // Download from NFLverse GitHub releases - CORRECTED URL
      const url = `https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_${season}.csv`;
      
      console.log(`🌐 Fetching from: ${url}`);
      const response = await axios.get(url, { 
        timeout: 15000, // Reduced timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const csvData = response.data;
      
      // Parse CSV data
      const playerStats = await this.parsePlayerStatsCSV(csvData);
      
      // Cache in Supabase (with better error handling)
      await this.cacheSeasonStats(season, playerStats);
      
      console.log(`✅ Downloaded and cached ${playerStats.length} player records for ${season}`);
      return playerStats;
      
    } catch (error: any) {
      console.error(`❌ Failed to fetch NFLverse data for ${season}:`, error.message);
      return [];
    }
  }

  // Download game logs for a specific season - SKIP FOR NOW
  async fetchGameLogs(season: number): Promise<NFLverseGameLog[]> {
    console.log(`⚠️ Skipping NFLverse game logs for ${season} (using existing cache)`);
    
    // For now, return empty array to use existing cached game logs
    // We can implement this later once we figure out the correct URL structure
    return [];
  }

  // Get player stats for specific player from cached data
  async getPlayerSeasonStats(playerName: string, season: number): Promise<NFLversePlayerStats | null> {
    const allStats = await this.fetchSeasonStats(season);
    
    if (!allStats || allStats.length === 0) {
      console.log(`❌ No NFLverse data available for season ${season}`);
      return null;
    }

    // Normalize player name for better matching
    const normalizedSearchName = this.normalizePlayerName(playerName);
    console.log(`🔍 Searching for player: "${playerName}" (normalized: "${normalizedSearchName}")`);

    // Try multiple matching strategies
    let playerStats = null;

    // 1. Exact match on player_name
    playerStats = allStats.find(p => 
      this.normalizePlayerName(p.player_name) === normalizedSearchName
    );

    // 2. Exact match on player_display_name
    if (!playerStats) {
      playerStats = allStats.find(p => 
        p.player_display_name && this.normalizePlayerName(p.player_display_name) === normalizedSearchName
      );
    }

    // 3. Partial match on either name
    if (!playerStats) {
      playerStats = allStats.find(p => 
        this.normalizePlayerName(p.player_name).includes(normalizedSearchName.split(' ')[0]) &&
        this.normalizePlayerName(p.player_name).includes(normalizedSearchName.split(' ')[1] || '')
      );
    }

    // 4. Debug: Show similar names if no match found
    if (!playerStats) {
      const similarNames = allStats
        .filter(p => 
          p.player_name.toLowerCase().includes(playerName.toLowerCase().split(' ')[0]) ||
          (p.player_display_name && p.player_display_name.toLowerCase().includes(playerName.toLowerCase().split(' ')[0]))
        )
        .slice(0, 5)
        .map(p => `${p.player_name} (${p.player_display_name})`);
      
      console.log(`❌ Player "${playerName}" not found. Similar names:`, similarNames);
    } else {
      console.log(`✅ Found player: ${playerStats.player_name} (${playerStats.player_display_name})`);
    }
    
    return playerStats || null;
  }

  // Get player game logs for specific player
  async getPlayerGameLogs(playerName: string, season: number): Promise<NFLverseGameLog[]> {
    console.log(`📋 Fetching real game logs for ${playerName} from NFLverse weekly data...`);
    
    try {
      // We need to re-download and parse the weekly data for game logs
      // (Since we aggregated it into season totals earlier)
      const url = `https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_${season}.csv`;
      
      const response = await axios.get(url, { 
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const weeklyGameLogs = await this.parseWeeklyGameLogsCSV(response.data, playerName);
      
      if (weeklyGameLogs.length > 0) {
        console.log(`✅ Found ${weeklyGameLogs.length} real game logs for ${playerName}`);
        return weeklyGameLogs;
      }
      
      return [];
    } catch (error: any) {
      console.error(`❌ Failed to fetch game logs for ${playerName}:`, error.message);
      return [];
    }
  }

  // Normalize player names for better matching
  private normalizePlayerName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  // Parse CSV data into structured format
  private async parsePlayerStatsCSV(csvData: string): Promise<NFLversePlayerStats[]> {
    return new Promise((resolve, reject) => {
      const playerMap = new Map<string, NFLversePlayerStats>();
      
      parse(csvData, {
        columns: true,
        skip_empty_lines: true
      }, (err, records) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`📊 Processing ${records.length} weekly records...`);
        
        for (const record of records) {
          // Skip non-regular season games
          if (record.season_type !== 'REG') continue;
          
          const playerId = record.player_id;
          if (!playerId) continue;
          
          // Get or create player aggregate
          let playerStats = playerMap.get(playerId);
          if (!playerStats) {
            playerStats = {
              player_id: record.player_id || '',
              player_name: record.player_name || '',
              player_display_name: record.player_display_name || record.player_name || '',
              position: record.position || '',
              team: record.recent_team || '',
              season: parseInt(record.season) || 0,
              games: 0,
              completions: 0,
              attempts: 0,
              passing_yards: 0,
              passing_tds: 0,
              interceptions: 0,
              carries: 0,
              rushing_yards: 0,
              rushing_tds: 0,
              receptions: 0,
              receiving_yards: 0,
              receiving_tds: 0,
              targets: 0,
              fantasy_points: 0
            };
            playerMap.set(playerId, playerStats);
          }
          
          // Aggregate weekly stats into season totals
          playerStats.games += 1;
          playerStats.completions += parseInt(record.completions) || 0;
          playerStats.attempts += parseInt(record.attempts) || 0;
          playerStats.passing_yards += parseInt(record.passing_yards) || 0;
          playerStats.passing_tds += parseInt(record.passing_tds) || 0;
          playerStats.interceptions += parseInt(record.interceptions) || 0;
          playerStats.carries += parseInt(record.carries) || 0;
          playerStats.rushing_yards += parseInt(record.rushing_yards) || 0;
          playerStats.rushing_tds += parseInt(record.rushing_tds) || 0;
          playerStats.receptions += parseInt(record.receptions) || 0;
          playerStats.receiving_yards += parseInt(record.receiving_yards) || 0;
          playerStats.receiving_tds += parseInt(record.receiving_tds) || 0;
          playerStats.targets += parseInt(record.targets) || 0;
          playerStats.fantasy_points += parseFloat(record.fantasy_points) || 0;
        }
        
        // Convert map to array and filter players with meaningful stats
        const results = Array.from(playerMap.values())
          .filter(p => p.games > 0); // Now we have games count from aggregation
        
        console.log(`✅ Aggregated ${results.length} players with season totals`);
        
        // Debug: Show some QBs
        const qbs = results.filter(p => p.position === 'QB').slice(0, 5);
        console.log('📋 Sample QBs:', qbs.map(q => `${q.player_name} (${q.games} games, ${q.passing_yards} yards)`));
        
        resolve(results);
      });
    });
  }

  // Parse game log CSV data (skipped for now)
  private async parseGameLogCSV(csvData: string): Promise<NFLverseGameLog[]> {
    return [];
  }

  // Cache season stats in Supabase with better error handling
  private async cacheSeasonStats(season: number, stats: NFLversePlayerStats[]) {
    try {
      // First, delete existing data for this season to avoid conflicts
      await this.supabase
        .from('nflverse_season_stats')
        .delete()
        .eq('season', season);

      // Insert new data in batches to avoid conflicts
      const batchSize = 100;
      for (let i = 0; i < stats.length; i += batchSize) {
        const batch = stats.slice(i, i + batchSize);
        
        const { error } = await this.supabase
          .from('nflverse_season_stats')
          .insert(
            batch.map(stat => ({
              ...stat,
              cached_at: new Date().toISOString()
            }))
          );

        if (error) {
          console.error(`Failed to cache batch ${i}-${i + batchSize}:`, error);
        }
      }

      console.log(`✅ Successfully cached ${stats.length} NFLverse records for ${season}`);
    } catch (error) {
      console.error('Error caching NFLverse data:', error);
    }
  }

  // Get cached season stats
  private async getCachedSeasonStats(season: number): Promise<NFLversePlayerStats[]> {
    try {
      const { data, error } = await this.supabase
        .from('nflverse_season_stats')
        .select('*')
        .eq('season', season);

      if (error || !data) {
        return [];
      }

      return data;
    } catch (error) {
      return [];
    }
  }

  private async parseWeeklyGameLogsCSV(csvData: string, playerName: string): Promise<NFLverseGameLog[]> {
    return new Promise((resolve, reject) => {
      const results: NFLverseGameLog[] = [];
      const normalizedSearchName = this.normalizePlayerName(playerName);
      
      parse(csvData, {
        columns: true,
        skip_empty_lines: true
      }, (err, records) => {
        if (err) {
          reject(err);
          return;
        }
        
        for (const record of records) {
          // Skip non-regular season games
          if (record.season_type !== 'REG') continue;
          
          // Match player by name
          const recordPlayerName = this.normalizePlayerName(record.player_name || '');
          const recordDisplayName = this.normalizePlayerName(record.player_display_name || '');
          
          if (recordPlayerName === normalizedSearchName || recordDisplayName === normalizedSearchName) {
            results.push({
              player_id: record.player_id || '',
              player_name: record.player_name || '',
              player_display_name: record.player_display_name || '',
              week: parseInt(record.week) || 0,
              season: parseInt(record.season) || 0,
              team: record.recent_team || '',
              opponent: record.opponent_team || '',
              
              // Passing stats
              attempts: parseInt(record.attempts) || undefined,
              completions: parseInt(record.completions) || undefined,
              passing_yards: parseInt(record.passing_yards) || undefined,
              passing_tds: parseInt(record.passing_tds) || undefined,
              interceptions: parseInt(record.interceptions) || undefined,
              
              // Rushing stats
              carries: parseInt(record.carries) || undefined,
              rushing_yards: parseInt(record.rushing_yards) || undefined,
              rushing_tds: parseInt(record.rushing_tds) || undefined,
              
              // Receiving stats
              targets: parseInt(record.targets) || undefined,
              receptions: parseInt(record.receptions) || undefined,
              receiving_yards: parseInt(record.receiving_yards) || undefined,
              receiving_tds: parseInt(record.receiving_tds) || undefined,
              
              // Additional stats
              sacks: parseInt(record.sacks) || undefined,
              sack_yards: parseInt(record.sack_yards) || undefined,
              rushing_fumbles: parseInt(record.rushing_fumbles) || undefined,
              rushing_fumbles_lost: parseInt(record.rushing_fumbles_lost) || undefined,
              receiving_fumbles: parseInt(record.receiving_fumbles) || undefined,
              receiving_fumbles_lost: parseInt(record.receiving_fumbles_lost) || undefined,
              
              // Fantasy points
              fantasy_points: parseFloat(record.fantasy_points) || undefined
            });
          }
        }
        
        // Sort by week (chronological order - Week 1 first)
        results.sort((a, b) => a.week - b.week);
        
        resolve(results);
      });
    });
  }
}

export const nflverseData = new NFLverseDataFetcher();
