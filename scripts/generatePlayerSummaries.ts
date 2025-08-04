import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';

// Environment validation
const requiredEnvVars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// Initialize clients
const supabase = createClient(
  requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL!,
  requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: requiredEnvVars.OPENAI_API_KEY,
});

interface Player {
  sleeper_id: string;
  name: string;
  position: string;
  team: string;
  summary_2025?: string;
  summary_updated_at?: string;
  adp_2025?: number;
  ownership_percent?: number;
  start_percent?: number;
  fantasy_points_2024?: number;
  positional_rank_2024?: number;
}

interface PlayerStats {
  passing_yards?: number;
  passing_touchdowns?: number;
  interceptions?: number;
  rushing_yards?: number;
  rushing_touchdowns?: number;
  receiving_yards?: number;
  receiving_touchdowns?: number;
  receptions?: number;
  targets?: number;
  fantasy_points?: number;
}

class PlayerSummaryGenerator {
  private async fetchPlayersFromSupabase(): Promise<Player[]> {
    console.log('🔍 Fetching players from Supabase...');
    
    const { data: players, error } = await supabase
      .from('players')
      .select('sleeper_id, name, position, team, summary_2025, summary_updated_at, adp_2025, ownership_percent, start_percent, fantasy_points_2024, positional_rank_2024');

    if (error) {
      throw new Error(`Failed to fetch players: ${error.message}`);
    }

    console.log(`✅ Found ${players?.length || 0} players in database`);
    return players || [];
  }

  private async populatePlayersFromRosters(): Promise<void> {
    console.log('🔄 Populating players table from existing rosters...');
    
    const { data: leagues, error } = await supabase
      .from('leagues')
      .select('rosters_json');

    if (error) {
      throw new Error(`Failed to fetch leagues: ${error.message}`);
    }

    const playersToInsert = new Set<string>();
    const playerData: any[] = [];

    // Extract unique players from all rosters
    for (const league of leagues || []) {
      if (league.rosters_json?.roster) {
        for (const player of league.rosters_json.roster) {
          if (!playersToInsert.has(player.id)) {
            playersToInsert.add(player.id);
            playerData.push({
              sleeper_id: player.id,
              name: player.name,
              position: player.position,
              team: player.team,
            });
          }
        }
      }
    }

    if (playerData.length > 0) {
      console.log(`📝 Inserting ${playerData.length} players into database...`);
      
      const { error: insertError } = await supabase
        .from('players')
        .upsert(playerData, { 
          onConflict: 'sleeper_id',
          ignoreDuplicates: true 
        });

      if (insertError) {
        throw new Error(`Failed to insert players: ${insertError.message}`);
      }

      console.log(`✅ Successfully populated ${playerData.length} players`);
    }
  }

  private async fetchPlayerStats(playerName: string): Promise<PlayerStats | null> {
    try {
      console.log(`📊 Fetching stats for ${playerName}...`);
      
      const response = await axios.get('https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLPlayerInfo', {
        params: { playerName },
        headers: {
          'X-RapidAPI-Key': requiredEnvVars.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
        },
        timeout: 10000
      });

      if (response.data?.body?.length > 0) {
        // Find the correct player by matching longName
        const playerData = response.data.body.find((p: any) => 
          p.longName?.toLowerCase() === playerName.toLowerCase()
        );

        if (playerData?.stats) {
          return {
            passing_yards: playerData.stats.passing_yards || 0,
            passing_touchdowns: playerData.stats.passing_touchdowns || 0,
            interceptions: playerData.stats.interceptions || 0,
            rushing_yards: playerData.stats.rushing_yards || 0,
            rushing_touchdowns: playerData.stats.rushing_touchdowns || 0,
            receiving_yards: playerData.stats.receiving_yards || 0,
            receiving_touchdowns: playerData.stats.receiving_touchdowns || 0,
            receptions: playerData.stats.receptions || 0,
            targets: playerData.stats.targets || 0,
            fantasy_points: playerData.stats.fantasy_points || 0,
          };
        }
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch stats for ${playerName}:`, error);
      return null;
    }
  }

  private async generateSummary(player: Player, stats: PlayerStats | null): Promise<string> {
    try {
      const prompt = this.buildPrompt(player, stats);
      
      console.log(`🤖 Generating AI summary for ${player.name}...`);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a fantasy football expert. Write concise, insightful player outlooks for the 2025 season based on 2024 performance data. Keep responses under 150 words.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || this.generateFallbackSummary(player);
    } catch (error: any) {
      console.warn(`⚠️ OpenAI API error for ${player.name}:`, error.message);
      
      if (error.message?.includes('insufficient_quota')) {
        console.log('💡 Using fallback summary due to OpenAI quota limits');
      }
      
      return this.generateFallbackSummary(player);
    }
  }

  private buildPrompt(player: Player, stats: PlayerStats | null): string {
    let prompt = `Write a 2025 fantasy football outlook for ${player.name}, ${player.position} for the ${player.team}.`;

    if (stats) {
      prompt += `\n\n2024 Season Stats:`;
      
      if (player.position === 'QB') {
        prompt += `\n- Passing Yards: ${stats.passing_yards || 0}`;
        prompt += `\n- Passing TDs: ${stats.passing_touchdowns || 0}`;
        prompt += `\n- Interceptions: ${stats.interceptions || 0}`;
        prompt += `\n- Rushing Yards: ${stats.rushing_yards || 0}`;
        prompt += `\n- Rushing TDs: ${stats.rushing_touchdowns || 0}`;
      } else if (player.position === 'RB') {
        prompt += `\n- Rushing Yards: ${stats.rushing_yards || 0}`;
        prompt += `\n- Rushing TDs: ${stats.rushing_touchdowns || 0}`;
        prompt += `\n- Receptions: ${stats.receptions || 0}`;
        prompt += `\n- Receiving Yards: ${stats.receiving_yards || 0}`;
        prompt += `\n- Receiving TDs: ${stats.receiving_touchdowns || 0}`;
      } else if (['WR', 'TE'].includes(player.position)) {
        prompt += `\n- Receptions: ${stats.receptions || 0}`;
        prompt += `\n- Receiving Yards: ${stats.receiving_yards || 0}`;
        prompt += `\n- Receiving TDs: ${stats.receiving_touchdowns || 0}`;
        prompt += `\n- Targets: ${stats.targets || 0}`;
      }
      
      prompt += `\n- Fantasy Points: ${stats.fantasy_points || 0}`;
    }

    if (player.adp_2025) {
      prompt += `\n- 2025 ADP: ${player.adp_2025}`;
    }

    if (player.ownership_percent) {
      prompt += `\n- Ownership: ${player.ownership_percent}%`;
    }

    if (player.positional_rank_2024) {
      prompt += `\n- 2024 Positional Rank: #${player.positional_rank_2024}`;
    }

    prompt += `\n\nProvide a concise outlook focusing on their 2025 fantasy potential, key factors affecting their value, and draft strategy.`;

    return prompt;
  }

  private generateFallbackSummary(player: Player): string {
    const summaries = [
      `${player.name} enters 2025 as a ${player.position} for the ${player.team}. Monitor their preseason performance and depth chart position for fantasy relevance.`,
      `The ${player.team} ${player.position} ${player.name} presents an intriguing 2025 fantasy option. Keep an eye on training camp reports and early season usage.`,
      `${player.name} could be a sleeper pick for 2025. As a ${player.position} with the ${player.team}, their fantasy value will depend on team offensive schemes and target share.`,
      `Fantasy managers should watch ${player.name} closely in 2025. The ${player.team} ${player.position} has the potential for breakout performance if opportunity meets talent.`,
      `${player.name} represents a calculated risk for 2025 fantasy leagues. Their success with the ${player.team} will largely depend on offensive line play and coaching decisions.`
    ];
    
    // Use player ID to consistently select the same summary for each player
    const summaryIndex = parseInt(player.sleeper_id.slice(-1)) % summaries.length;
    return summaries[summaryIndex];
  }

  private async updatePlayerSummary(sleeperId: string, summary: string): Promise<void> {
    const { error } = await supabase
      .from('players')
      .update({
        summary_2025: summary,
        summary_updated_at: new Date().toISOString(),
        summary_type: 'preseason',
        summary_week: null,
      })
      .eq('sleeper_id', sleeperId);

    if (error) {
      throw new Error(`Failed to update player ${sleeperId}: ${error.message}`);
    }
  }

  public async generateSummaries(forceRegenerate: boolean = false): Promise<void> {
    try {
      console.log('🚀 Starting Player Summary Generation...');
      console.log(`Force regenerate: ${forceRegenerate}`);

      // First, populate players table if it's empty
      let players = await this.fetchPlayersFromSupabase();
      
      if (players.length === 0) {
        console.log('📋 Players table is empty, populating from rosters...');
        await this.populatePlayersFromRosters();
        players = await this.fetchPlayersFromSupabase();
      }

      // Filter players that need summaries
      const playersToProcess = forceRegenerate 
        ? players 
        : players.filter(p => !p.summary_2025 || !p.summary_updated_at);

      console.log(`📝 Found ${playersToProcess.length} players to process`);

      if (playersToProcess.length === 0) {
        console.log('✅ All players already have summaries. Use --force to regenerate.');
        return;
      }

      let processed = 0;
      let successful = 0;
      let failed = 0;

      for (const player of playersToProcess) {
        try {
          console.log(`\n[${++processed}/${playersToProcess.length}] Processing ${player.name}...`);

          // Fetch player stats from RapidAPI
          const stats = await this.fetchPlayerStats(player.name);
          
          // Generate AI summary
          const summary = await this.generateSummary(player, stats);
          
          // Update database
          await this.updatePlayerSummary(player.sleeper_id, summary);
          
          successful++;
          console.log(`✅ Successfully updated ${player.name}`);

          // Rate limiting: Wait 1 second between API calls
          if (processed < playersToProcess.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error: any) {
          failed++;
          console.error(`❌ Failed to process ${player.name}:`, error.message);
        }
      }

      console.log('\n📊 Summary Generation Complete!');
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`📝 Total Processed: ${processed}`);

    } catch (error: any) {
      console.error('💥 Critical error:', error.message);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const forceRegenerate = process.argv.includes('--force');
  const generator = new PlayerSummaryGenerator();
  await generator.generateSummaries(forceRegenerate);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { PlayerSummaryGenerator };
