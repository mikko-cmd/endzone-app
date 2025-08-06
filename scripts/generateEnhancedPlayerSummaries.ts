// scripts/generateEnhancedPlayerSummaries.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';
import { dataParser } from '../lib/dataParser.js';

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
    receptions?: number;
    receiving_yards?: number;
    receiving_touchdowns?: number;
    targets?: number;
    fantasy_points?: number;
}

interface EnhancedPlayerContext {
    player: Player;
    stats?: PlayerStats;
    adpData?: any;
    marketShare?: any;
    redZoneData?: any;
    coachingChange?: any;
    rookieAnalysis?: any;
    expertAnalysis?: string;
    contextualInsights: string[];
}

class EnhancedPlayerSummaryGenerator {

    /**
     * Initialize data parser with all enhanced data
     */
    async initialize(): Promise<void> {
        console.log('🔄 Initializing enhanced data sources...');
        await dataParser.initializeData();
        console.log('✅ Enhanced data loaded successfully');
    }

    /**
     * Generate enhanced player context using all available data
     */
    private generateEnhancedPlayerContext(player: Player, stats?: PlayerStats): EnhancedPlayerContext {
        // Get all available data for this player
        const adpData = dataParser.getPlayerADP(player.name);
        const marketShare = dataParser.getMarketShareByPosition(player.name, player.position);
        const redZoneData = dataParser.getRedZoneData(player.name, player.position);
        const coachingChange = dataParser.getCoachingChange(player.team);
        const rookieAnalysis = dataParser.getRookieAnalysis(player.name);
        const expertAnalysis = dataParser.getExpertAnalysis(player.name);

        // Generate contextual insights
        const contextualInsights: string[] = [];

        // ADP Context
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

        // Usage Context
        if (marketShare) {
            const primaryUsage = marketShare.attPercent || marketShare.tgtPercent || 0;
            if (primaryUsage >= 70) {
                contextualInsights.push('elite usage rate - team centerpiece');
            } else if (primaryUsage >= 50) {
                contextualInsights.push('high usage rate - key offensive weapon');
            } else if (primaryUsage >= 25) {
                contextualInsights.push('moderate usage - secondary option');
            } else {
                contextualInsights.push('limited usage - needs increased opportunity');
            }
        }

        // Red Zone Context
        if (redZoneData && redZoneData.rzTouchdowns > 0) {
            if (redZoneData.rzTdPercent >= 80) {
                contextualInsights.push('elite red zone efficiency - high TD upside');
            } else if (redZoneData.rzTdPercent >= 60) {
                contextualInsights.push('solid red zone producer');
            } else {
                contextualInsights.push('inconsistent red zone production');
            }
        }

        // Age/Experience Context
        if (rookieAnalysis) {
            contextualInsights.push(`rookie with ${rookieAnalysis.draftRound === 1 ? 'high' : 'developing'} expectations`);
        } else if (stats && stats.fantasy_points) {
            // Estimate veteran status based on production
            if (stats.fantasy_points > 200) {
                contextualInsights.push('established veteran producer');
            } else {
                contextualInsights.push('developing player seeking consistency');
            }
        }

        // Coaching Impact
        if (coachingChange) {
            contextualInsights.push(`new coaching staff impact under ${coachingChange.newCoach}`);
        }

        return {
            player,
            stats,
            adpData,
            marketShare,
            redZoneData,
            coachingChange,
            rookieAnalysis,
            expertAnalysis,
            contextualInsights
        };
    }

    /**
     * Generate enhanced AI prompt with comprehensive context
     */
    private generateEnhancedPrompt(context: EnhancedPlayerContext): string {
        const { player, stats, adpData, marketShare, redZoneData, coachingChange, rookieAnalysis, expertAnalysis, contextualInsights } = context;

        // System prompt with enhanced context rules
        const systemPrompt = `You are an expert fantasy football analyst with deep knowledge of player situations, team contexts, and market dynamics. 

CONTEXT RULES:
- Use specific data points and situational context
- Avoid generic phrases like "emerging talent" or "has potential"
- Be realistic about expectations based on draft cost and situation
- Consider team offensive schemes and coaching philosophies
- Factor in age, experience, and historical performance patterns
- Address competition for targets/carries specifically

AVOID GENERIC PHRASES:
- "emerging talent" → use specific skill descriptions
- "has potential" → quantify with usage or efficiency metrics
- "talented player" → describe actual strengths
- "could be valuable" → give specific conditions for value

TONE: Knowledgeable, realistic, specific`;

        // User prompt with rich context
        let userPrompt = `PLAYER: ${player.name} (${player.position}, ${player.team})\n\n`;

        // ADP Data Section
        if (adpData) {
            userPrompt += `ADP DATA:\n`;
            userPrompt += `- PPR: ${adpData.ppr} | Standard: ${adpData.standard} | Superflex: ${adpData.superflex}\n`;
            userPrompt += `- Current Market: Round ${Math.ceil(adpData.ppr / 12)} pick\n`;
            userPrompt += `- Bye Week: ${adpData.byeWeek}\n\n`;
        }

        // 2024 Usage Section
        if (marketShare) {
            userPrompt += `2024 USAGE:\n`;
            if (player.position === 'RB') {
                userPrompt += `- ${marketShare.rbPointsPercent}% of team RB fantasy points\n`;
                userPrompt += `- ${marketShare.attPercent}% of rush attempts\n`;
                userPrompt += `- ${marketShare.tgtPercent}% of RB targets\n`;
            } else if (['WR', 'TE'].includes(player.position)) {
                userPrompt += `- ${marketShare.tgtPercent}% of team targets\n`;
                userPrompt += `- ${marketShare.recPercent}% of team receptions\n`;
                userPrompt += `- ${marketShare.ydPercent}% of team receiving yards\n`;
            }
            userPrompt += `- Games played: ${marketShare.gamesPlayed}\n\n`;
        }

        // 2024 Stats Section
        if (stats) {
            userPrompt += `2024 STATS:\n`;
            if (player.position === 'QB') {
                userPrompt += `- ${stats.passing_yards || 0} pass yards, ${stats.passing_touchdowns || 0} TDs\n`;
                userPrompt += `- ${stats.rushing_yards || 0} rush yards, ${stats.rushing_touchdowns || 0} TDs\n`;
            } else if (player.position === 'RB') {
                userPrompt += `- ${stats.rushing_yards || 0} rush yards, ${stats.rushing_touchdowns || 0} TDs\n`;
                userPrompt += `- ${stats.receptions || 0} catches for ${stats.receiving_yards || 0} yards\n`;
            } else if (['WR', 'TE'].includes(player.position)) {
                userPrompt += `- ${stats.receptions || 0}/${stats.targets || 0} catches for ${stats.receiving_yards || 0} yards\n`;
                userPrompt += `- ${stats.receiving_touchdowns || 0} receiving TDs\n`;
            }
            userPrompt += `- ${stats.fantasy_points || 0} fantasy points\n\n`;
        }

        // Red Zone Data
        if (redZoneData) {
            userPrompt += `RED ZONE DATA:\n`;
            userPrompt += `- ${redZoneData.rzTouchdowns} TDs on ${redZoneData.rzAttempts} attempts (${redZoneData.rzTdPercent}% rate)\n`;
            if (redZoneData.glTouchdowns) {
                userPrompt += `- ${redZoneData.glTouchdowns} goal line TDs on ${redZoneData.glAttempts} attempts\n`;
            }
            userPrompt += `- ${redZoneData.teamTdPercent}% of team's positional TDs\n\n`;
        }

        // Coaching Context
        if (coachingChange) {
            userPrompt += `COACHING CHANGE:\n`;
            userPrompt += `- New ${coachingChange.position}: ${coachingChange.newCoach}\n`;
            userPrompt += `- Impact: ${coachingChange.fantasyImpact}\n\n`;
        }

        // Rookie Context
        if (rookieAnalysis) {
            userPrompt += `ROOKIE CONTEXT:\n`;
            userPrompt += `- Draft: Round ${rookieAnalysis.draftRound}, Pick ${rookieAnalysis.draftPick}\n`;
            userPrompt += `- Situation: ${rookieAnalysis.analysis.substring(0, 200)}...\n\n`;
        }

        // Expert Analysis
        if (expertAnalysis) {
            userPrompt += `EXPERT ANALYSIS:\n`;
            userPrompt += expertAnalysis.substring(0, 300) + '...\n\n';
        }

        // Contextual Insights
        if (contextualInsights.length > 0) {
            userPrompt += `PLAYER CONTEXT:\n`;
            userPrompt += contextualInsights.map(insight => `- ${insight}`).join('\n');
            userPrompt += '\n\n';
        }

        userPrompt += `Write a concise 2025 fantasy analysis for PPR format, focusing on:\n`;
        userPrompt += `1. Draft value relative to current ADP\n`;
        userPrompt += `2. Weekly ceiling and floor expectations\n`;
        userPrompt += `3. Key factors affecting 2025 value\n`;
        userPrompt += `4. Specific situational considerations\n\n`;
        userPrompt += `Keep analysis under 150 words, be specific with data points, and provide realistic expectations.`;

        return JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 300,
            temperature: 0.7
        });
    }

    /**
     * Generate actual AI summary using OpenAI
     */
    private async generateAISummary(context: EnhancedPlayerContext): Promise<string> {
        try {
            const enhancedPrompt = this.generateEnhancedPrompt(context);
            const promptData = JSON.parse(enhancedPrompt);

            const response = await openai.chat.completions.create({
                model: promptData.model,
                messages: promptData.messages,
                max_tokens: promptData.max_tokens,
                temperature: promptData.temperature,
            });

            return response.choices[0]?.message?.content || 'Summary generation failed';
        } catch (error) {
            console.error(`❌ Error generating AI summary for ${context.player.name}:`, error);
            return `AI summary unavailable for ${context.player.name}. Please try again later.`;
        }
    }

    /**
     * Test enhanced summary generation for a few players
     */
    async testEnhancedSummaries(): Promise<void> {
        await this.initialize();

        console.log('\n🧪 Testing Enhanced Player Summary Generation...\n');

        // Test with different player types
        const testPlayers = [
            { name: 'Saquon Barkley', position: 'RB', team: 'PHI' },
            { name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN' },
            { name: 'Travis Hunter', position: 'WR', team: 'JAX' }, // Rookie
            { name: 'Caleb Williams', position: 'QB', team: 'CHI' }, // Coaching change
        ];

        for (const testPlayer of testPlayers) {
            console.log(`\n📋 Generating Enhanced Summary for ${testPlayer.name}:`);

            // Mock player object (in real usage, this comes from Supabase)
            const player: Player = {
                sleeper_id: '1234',
                name: testPlayer.name,
                position: testPlayer.position,
                team: testPlayer.team
            };

            // Mock stats (in real usage, this comes from RapidAPI)
            const mockStats: PlayerStats = {
                fantasy_points: 250,
                passing_yards: testPlayer.position === 'QB' ? 3500 : undefined,
                passing_touchdowns: testPlayer.position === 'QB' ? 25 : undefined,
                rushing_yards: testPlayer.position === 'RB' ? 1200 : undefined,
                rushing_touchdowns: testPlayer.position === 'RB' ? 8 : undefined,
                receptions: ['WR', 'TE'].includes(testPlayer.position) ? 80 : undefined,
                receiving_yards: ['WR', 'TE'].includes(testPlayer.position) ? 1100 : undefined,
                receiving_touchdowns: ['WR', 'TE'].includes(testPlayer.position) ? 6 : undefined,
            };

            // Generate enhanced context
            const context = this.generateEnhancedPlayerContext(player, mockStats);

            // Display context summary
            console.log(`   Context Insights: ${context.contextualInsights.join(', ')}`);
            if (context.adpData) {
                console.log(`   ADP: ${context.adpData.ppr} (Round ${Math.ceil(context.adpData.ppr / 12)})`);
            }
            if (context.marketShare) {
                const usage = context.marketShare.attPercent || context.marketShare.tgtPercent;
                console.log(`   Usage: ${usage}% of team opportunities`);
            }
            if (context.redZoneData) {
                console.log(`   Red Zone: ${context.redZoneData.rzTouchdowns} TDs on ${context.redZoneData.rzAttempts} attempts`);
            }
            if (context.coachingChange) {
                console.log(`   Coaching: ${context.coachingChange.newCoach} (${context.coachingChange.team})`);
            }
            if (context.rookieAnalysis) {
                console.log(`   Rookie: Round ${context.rookieAnalysis.draftRound} pick`);
            }

            // Generate enhanced prompt
            const enhancedPrompt = this.generateEnhancedPrompt(context);
            console.log(`\n✅ Enhanced prompt generated (${enhancedPrompt.length} characters)`);

            console.log('   Preview of key context:');
            if (context.adpData) console.log(`   - Market ADP: ${context.adpData.ppr}`);
            if (context.marketShare) console.log(`   - Team usage: High involvement`);
            if (context.expertAnalysis) console.log(`   - Expert insights: Available`);
        }

        console.log('\n🎉 Enhanced Summary Test Complete!');
        console.log('💡 Ready to generate AI summaries with incredible context depth!');
    }

    /**
     * Test full AI summary generation with OpenAI
     */
    async testFullAISummaries(): Promise<void> {
        await this.initialize();

        console.log('\n🤖 Testing FULL AI Summary Generation with OpenAI...\n');

        // Test with different player types
        const testPlayers = [
            { name: 'Saquon Barkley', position: 'RB', team: 'PHI' },
            { name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN' },
            { name: 'Travis Hunter', position: 'WR', team: 'JAX' }, // Rookie
            { name: 'Caleb Williams', position: 'QB', team: 'CHI' }, // Coaching change
        ];

        for (const testPlayer of testPlayers) {
            console.log(`\n📋 Generating FULL AI Summary for ${testPlayer.name}:`);

            // Mock player object
            const player: Player = {
                sleeper_id: '1234',
                name: testPlayer.name,
                position: testPlayer.position,
                team: testPlayer.team
            };

            // Mock stats
            const mockStats: PlayerStats = {
                fantasy_points: 250,
                passing_yards: testPlayer.position === 'QB' ? 3500 : undefined,
                passing_touchdowns: testPlayer.position === 'QB' ? 25 : undefined,
                rushing_yards: testPlayer.position === 'RB' ? 1200 : undefined,
                rushing_touchdowns: testPlayer.position === 'RB' ? 8 : undefined,
                receptions: ['WR', 'TE'].includes(testPlayer.position) ? 80 : undefined,
                receiving_yards: ['WR', 'TE'].includes(testPlayer.position) ? 1100 : undefined,
                receiving_touchdowns: ['WR', 'TE'].includes(testPlayer.position) ? 6 : undefined,
            };

            // Generate enhanced context
            const context = this.generateEnhancedPlayerContext(player, mockStats);

            // Display context summary
            console.log(`   �� Context: ${context.contextualInsights.join(', ')}`);
            if (context.adpData) {
                console.log(`   💰 ADP: ${context.adpData.ppr} (Round ${Math.ceil(context.adpData.ppr / 12)})`);
            }
            if (context.redZoneData) {
                console.log(`   🏈 Red Zone: ${context.redZoneData.rzTouchdowns} TDs (${context.redZoneData.rzTdPercent}% rate)`);
            }

            // Generate actual AI summary
            console.log(`   🤖 Generating AI summary...`);
            const aiSummary = await this.generateAISummary(context);

            console.log(`\n✨ AI SUMMARY for ${testPlayer.name}:`);
            console.log(`${aiSummary}`);
            console.log(`\n${'='.repeat(80)}`);

            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n🎉 FULL AI Summary Generation Test Complete!');
        console.log('💡 This is the most intelligent fantasy football AI system ever built!');
    }
}

// Run the FULL AI test
const generator = new EnhancedPlayerSummaryGenerator();
await generator.testFullAISummaries();
