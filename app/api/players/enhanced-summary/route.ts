// app/api/players/enhanced-summary/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { dataParser } from '@/lib/dataParser';

// Use service role to bypass RLS
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface Player {
    sleeper_id: string;
    name: string;
    position: string;
    team: string;
    summary_2025?: string;
    summary_updated_at?: string;
}

interface EnhancedPlayerContext {
    player: Player;
    adpData?: any;
    marketShare?: any;
    redZoneData?: any;
    coachingChange?: any;
    rookieAnalysis?: any;
    expertAnalysis?: string;
    contextualInsights: string[];
}

class EnhancedSummaryAPI {

    private static initialized = false;

    static async initialize(): Promise<void> {
        if (!this.initialized) {
            console.log('🔄 Initializing enhanced data for API...');
            await dataParser.initializeData();
            this.initialized = true;
            console.log('✅ Enhanced data loaded for API');
        }
    }

    static generateEnhancedPlayerContext(player: Player): EnhancedPlayerContext {
        const adpData = dataParser.getPlayerADP(player.name);
        const marketShare = dataParser.getMarketShareByPosition(player.name, player.position);
        const redZoneData = dataParser.getRedZoneData(player.name, player.position);
        const coachingChange = dataParser.getCoachingChange(player.team);
        const rookieAnalysis = dataParser.getRookieAnalysis(player.name);
        const expertAnalysis = dataParser.getExpertAnalysis(player.name);

        const contextualInsights: string[] = [];

        if (adpData) {
            const adpRound = Math.ceil(adpData.ppr / 12);
            if (adpData.ppr <= 24) {
                contextualInsights.push(`early-round selection (Round ${adpRound})`);
            } else if (adpData.ppr <= 60) {
                contextualInsights.push(`middle-round value pick (Round ${adpRound})`);
            } else if (adpData.ppr <= 120) {
                contextualInsights.push(`late-round sleeper candidate (Round ${adpRound})`);
            } else {
                contextualInsights.push(`deep sleeper with upside (Round ${adpRound}+)`);
            }
        }

        if (marketShare) {
            const primaryUsage = marketShare.attPercent || marketShare.tgtPercent || 0;
            if (primaryUsage >= 70) {
                contextualInsights.push('elite usage rate - team centerpiece');
            } else if (primaryUsage >= 50) {
                contextualInsights.push('high usage rate - key offensive weapon');
            } else if (primaryUsage >= 25) {
                contextualInsights.push('moderate usage - secondary option');
            }
        }

        if (redZoneData && redZoneData.rzTouchdowns > 0) {
            if (redZoneData.rzTdPercent >= 80) {
                contextualInsights.push('elite red zone efficiency - high TD upside');
            } else if (redZoneData.rzTdPercent >= 60) {
                contextualInsights.push('solid red zone producer');
            }
        }

        if (rookieAnalysis) {
            contextualInsights.push(`rookie with ${rookieAnalysis.draftRound === 1 ? 'high' : 'developing'} expectations`);
        }

        if (coachingChange) {
            contextualInsights.push(`new coaching staff under ${coachingChange.newCoach}`);
        }

        return {
            player,
            adpData,
            marketShare,
            redZoneData,
            coachingChange,
            rookieAnalysis,
            expertAnalysis,
            contextualInsights
        };
    }

    static generateEnhancedPrompt(context: EnhancedPlayerContext): any {
        const { player, adpData, marketShare, redZoneData, expertAnalysis, contextualInsights } = context;

        const systemPrompt = `You are an expert fantasy football analyst with deep knowledge of player situations, team contexts, and market dynamics. 

RULES:
- Use specific data points and situational context
- Avoid generic phrases like "emerging talent" or "has potential"  
- Be realistic about expectations based on draft cost and situation
- Focus on 2025 fantasy value and weekly expectations
- Keep analysis concise but insightful

TONE: Knowledgeable, realistic, specific`;

        let userPrompt = `PLAYER: ${player.name} (${player.position}, ${player.team})\n\n`;

        if (adpData) {
            userPrompt += `ADP DATA:\n`;
            userPrompt += `- PPR ADP: ${adpData.ppr} (Round ${Math.ceil(adpData.ppr / 12)})\n`;
            userPrompt += `- Bye Week: ${adpData.byeWeek}\n\n`;
        }

        if (marketShare) {
            userPrompt += `2024 USAGE:\n`;
            if (player.position === 'RB') {
                userPrompt += `- ${marketShare.attPercent}% of rush attempts\n`;
                userPrompt += `- ${marketShare.tgtPercent}% of RB targets\n`;
            } else if (['WR', 'TE'].includes(player.position)) {
                userPrompt += `- ${marketShare.tgtPercent}% of team targets\n`;
                userPrompt += `- ${marketShare.recPercent}% of team receptions\n`;
            }
            userPrompt += `\n`;
        }

        if (redZoneData) {
            userPrompt += `RED ZONE:\n`;
            userPrompt += `- ${redZoneData.rzTouchdowns} TDs on ${redZoneData.rzAttempts} attempts (${redZoneData.rzTdPercent}% rate)\n`;
            userPrompt += `- ${redZoneData.teamTdPercent}% of team's positional TDs\n\n`;
        }

        if (expertAnalysis) {
            userPrompt += `EXPERT INSIGHT:\n`;
            userPrompt += expertAnalysis.substring(0, 250) + '...\n\n';
        }

        if (contextualInsights.length > 0) {
            userPrompt += `CONTEXT: ${contextualInsights.join(', ')}\n\n`;
        }

        userPrompt += `Write a concise 2025 fantasy analysis for PPR format, focusing on draft value, weekly expectations, and key factors. Keep under 120 words.`;

        return {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 200,
            temperature: 0.7
        };
    }

    static async generateAISummary(context: EnhancedPlayerContext): Promise<string> {
        try {
            const promptData = this.generateEnhancedPrompt(context);

            const response = await openai.chat.completions.create(promptData);

            return response.choices[0]?.message?.content || 'Summary generation failed';
        } catch (error: any) {
            console.error(`Error generating AI summary:`, error);
            return `Enhanced summary unavailable. Please try again later.`;
        }
    }
}

// GET endpoint - get enhanced summary for a player
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerName = searchParams.get('name');
        const playerId = searchParams.get('id');

        if (!playerName && !playerId) {
            return NextResponse.json({ error: 'Player name or ID required' }, { status: 400 });
        }

        // Initialize enhanced data
        await EnhancedSummaryAPI.initialize();

        // Get player from database
        let query = supabase.from('players').select('*');

        if (playerId) {
            query = query.eq('sleeper_id', playerId);
        } else if (playerName) {
            query = query.ilike('name', `%${playerName}%`);
        }

        const { data: players, error } = await query.limit(1);

        if (error || !players || players.length === 0) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const player = players[0];

        // Check if we have a recent enhanced summary
        const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
        if (player.summary_2025 &&
            player.summary_updated_at &&
            new Date(player.summary_updated_at) > recentCutoff &&
            !searchParams.get('force')) {

            return NextResponse.json({
                player: {
                    name: player.name,
                    position: player.position,
                    team: player.team
                },
                summary: player.summary_2025,
                enhanced: true,
                cached: true,
                lastUpdated: player.summary_updated_at
            });
        }

        // Generate enhanced context
        const context = EnhancedSummaryAPI.generateEnhancedPlayerContext(player);

        // Generate new AI summary
        const enhancedSummary = await EnhancedSummaryAPI.generateAISummary(context);

        // Update database
        const { error: updateError } = await supabase
            .from('players')
            .update({
                summary_2025: enhancedSummary,
                summary_updated_at: new Date().toISOString(),
                summary_type: 'enhanced_ai',
            })
            .eq('sleeper_id', player.sleeper_id);

        if (updateError) {
            console.error('Error updating player summary:', updateError);
        }

        return NextResponse.json({
            player: {
                name: player.name,
                position: player.position,
                team: player.team
            },
            summary: enhancedSummary,
            enhanced: true,
            cached: false,
            context: {
                adpRound: context.adpData ? Math.ceil(context.adpData.ppr / 12) : null,
                usage: context.marketShare ? (context.marketShare.attPercent || context.marketShare.tgtPercent) : null,
                redZoneTDs: context.redZoneData?.rzTouchdowns || null,
                insights: context.contextualInsights
            }
        });

    } catch (error: any) {
        console.error('Enhanced summary API error:', error);
        return NextResponse.json({
            error: 'Failed to generate enhanced summary',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
