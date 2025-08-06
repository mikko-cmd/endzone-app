import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role to bypass RLS
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Player {
    sleeper_id: string;
    name: string;
    position: string;
    team: string;
    summary_2025?: string;
    game_log_2024?: any[];
    game_log_updated_at?: string;
    summary_updated_at?: string;
}

interface PlayerStats {
    passingYards?: number;
    passingTDs?: number;
    interceptions?: number;
    rushingYards?: number;
    rushingTDs?: number;
    carries?: number;
    receptions?: number;
    targets?: number;
    fantasy_points?: number;
}

class AutoPlayerProcessor {

    // Find players that need processing (no summary or game log)
    private async findPlayersNeedingProcessing(): Promise<Player[]> {
        console.log('🔍 Finding players that need processing...');

        const { data: players, error } = await supabase
            .from('players')
            .select('sleeper_id, name, position, team, summary_2025, game_log_2024, game_log_updated_at, summary_updated_at')
            .or('summary_2025.is.null,game_log_2024.is.null');

        if (error) {
            throw new Error(`Failed to fetch players: ${error.message}`);
        }

        console.log(`✅ Found ${players?.length || 0} players needing processing`);
        return players || [];
    }

    // Generate AI summary for a player
    private async generateSummary(player: Player, stats: PlayerStats): Promise<string> {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a fantasy football expert writing concise 2025 season outlooks for players.'
                        },
                        {
                            role: 'user',
                            content: `Write a 2-3 sentence 2025 fantasy football outlook for ${player.name}, ${player.position} for ${player.team}. Focus on their role, opportunity, and fantasy relevance. Keep it concise and actionable.`
                        }
                    ],
                    max_tokens: 150,
                    temperature: 0.7,
                }),
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || `${player.name} outlook not yet available.`;
        } catch (error: any) {
            console.error(`❌ Failed to generate summary for ${player.name}:`, error.message);
            return `${player.name} summary not yet available. Please try again later.`;
        }
    }

    // Fetch player stats from RapidAPI
    private async fetchPlayerStats(playerName: string): Promise<PlayerStats> {
        try {
            const response = await fetch(`https://${process.env.RAPIDAPI_HOST}/getNFLPlayerInfo?playerName=${encodeURIComponent(playerName)}`, {
                headers: {
                    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
                    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST!,
                },
            });

            if (!response.ok) {
                throw new Error(`RapidAPI error: ${response.status}`);
            }

            const data = await response.json();

            if (data.body && Array.isArray(data.body) && data.body.length > 0) {
                const playerData = data.body.find((p: any) =>
                    p.longName && p.longName.toLowerCase().includes(playerName.toLowerCase())
                ) || data.body[0];

                if (playerData?.stats) {
                    return {
                        passingYards: playerData.stats.passingYards || 0,
                        passingTDs: playerData.stats.passingTDs || 0,
                        interceptions: playerData.stats.interceptions || 0,
                        rushingYards: playerData.stats.rushingYards || 0,
                        rushingTDs: playerData.stats.rushingTDs || 0,
                        carries: playerData.stats.carries || 0,
                        receptions: playerData.stats.receptions || 0,
                        targets: playerData.stats.targets || 0,
                        fantasy_points: playerData.stats.fantasyPoints || 0,
                    };
                }
            }

            return {};
        } catch (error: any) {
            console.error(`❌ Failed to fetch stats for ${playerName}:`, error.message);
            return {};
        }
    }

    // Generate mock game log for players without data
    private generateMockGameLog(player: Player): any[] {
        const mockGames = [];
        for (let week = 1; week <= 17; week++) {
            mockGames.push({
                week,
                opponent: `Week ${week}`,
                fantasy_points: 0,
                status: 'dnp'
            });
        }
        return mockGames;
    }

    // Process a single player (summary + game log)
    private async processPlayer(player: Player): Promise<boolean> {
        try {
            console.log(`🔄 Processing ${player.name} (${player.position})...`);

            let needsUpdate = false;
            const updates: any = {};

            // Generate summary if missing
            if (!player.summary_2025) {
                console.log(`📝 Generating summary for ${player.name}...`);
                const stats = await this.fetchPlayerStats(player.name);
                const summary = await this.generateSummary(player, stats);
                updates.summary_2025 = summary;
                updates.summary_updated_at = new Date().toISOString();
                needsUpdate = true;
            }

            // Generate game log if missing
            if (!player.game_log_2024) {
                console.log(`📊 Generating game log for ${player.name}...`);
                // For now, use mock data - you can integrate with real APIs later
                const gameLog = this.generateMockGameLog(player);
                updates.game_log_2024 = gameLog;
                updates.game_log_updated_at = new Date().toISOString();
                updates.game_log_season = '2024';
                needsUpdate = true;
            }

            // Update database if needed
            if (needsUpdate) {
                const { error } = await supabase
                    .from('players')
                    .update(updates)
                    .eq('sleeper_id', player.sleeper_id);

                if (error) {
                    throw new Error(`Failed to update player: ${error.message}`);
                }

                console.log(`✅ Successfully processed ${player.name}`);
            } else {
                console.log(`⏭️ ${player.name} already has all data`);
            }

            return true;
        } catch (error: any) {
            console.error(`❌ Failed to process ${player.name}:`, error.message);
            return false;
        }
    }

    // Main processing function
    public async processNewPlayers(limit: number = 10): Promise<{ processed: number; successful: number; failed: number }> {
        try {
            console.log('🚀 Starting automatic player processing...');

            const playersToProcess = await this.findPlayersNeedingProcessing();

            if (playersToProcess.length === 0) {
                console.log('✅ No players need processing');
                return { processed: 0, successful: 0, failed: 0 };
            }

            // Process in batches to avoid overwhelming APIs
            const batch = playersToProcess.slice(0, limit);
            console.log(`📝 Processing ${batch.length} players (limited to ${limit} per run)...`);

            let successful = 0;
            let failed = 0;

            for (const player of batch) {
                const success = await this.processPlayer(player);
                if (success) {
                    successful++;
                } else {
                    failed++;
                }

                // Rate limiting: Wait 2 seconds between players
                if (batch.indexOf(player) < batch.length - 1) {
                    console.log('⏳ Waiting 2 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            console.log('\n📊 Auto-processing Complete!');
            console.log(`✅ Successful: ${successful}`);
            console.log(`❌ Failed: ${failed}`);
            console.log(`📝 Total Processed: ${batch.length}`);

            return { processed: batch.length, successful, failed };

        } catch (error: any) {
            console.error('💥 Critical error in auto-processing:', error.message);
            throw error;
        }
    }
}

export async function POST(request: Request) {
    try {
        const { limit } = await request.json().catch(() => ({ limit: 10 }));

        const processor = new AutoPlayerProcessor();
        const result = await processor.processNewPlayers(limit);

        return NextResponse.json({
            success: true,
            message: 'Auto-processing completed',
            ...result
        });

    } catch (error: any) {
        console.error('❌ Auto-processing API error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const processor = new AutoPlayerProcessor();
        const result = await processor.processNewPlayers(5); // Smaller batch for GET requests

        return NextResponse.json({
            success: true,
            message: 'Auto-processing completed',
            ...result
        });

    } catch (error: any) {
        console.error('❌ Auto-processing API error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
} 