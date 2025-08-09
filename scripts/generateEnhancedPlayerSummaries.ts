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

// NEW: External player notes interfaces
interface ESPNPlayerNews {
    headline: string | null;
    description: string | null;
    published: string | null;
    source: string;
}

interface PlayerNotes {
    espnNews: ESPNPlayerNews | null;
    fantasyProsBlurb: string | null;
    rotoWireOutlook: string | null;
    aggregatedInsights: string[];
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
    externalNotes?: PlayerNotes; // NEW: External player notes
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
     * NEW: Fetch player notes from multiple external APIs
     */
    private async fetchExternalPlayerNotes(playerName: string, team?: string): Promise<PlayerNotes> {
        const notes: PlayerNotes = {
            espnNews: null,
            fantasyProsBlurb: null,
            rotoWireOutlook: null,
            aggregatedInsights: []
        };

        console.log(`   🔍 Fetching external notes for ${playerName}...`);

        // Try to fetch from multiple sources in parallel with shorter timeouts
        const results = await Promise.allSettled([
            this.fetchESPNPlayerNews(playerName, team),
            this.fetchNFLPlayerNews(playerName)
        ]);

        // Process ESPN news
        if (results[0].status === 'fulfilled' && results[0].value) {
            notes.espnNews = results[0].value;
            notes.aggregatedInsights.push(`ESPN: ${results[0].value.headline}`);
        }

        // Process NFL.com news
        if (results[1].status === 'fulfilled' && results[1].value) {
            notes.aggregatedInsights.push(`NFL.com: ${results[1].value.substring(0, 100)}...`);
        }

        if (notes.aggregatedInsights.length > 0) {
            console.log(`   ✅ Found ${notes.aggregatedInsights.length} external note sources`);
        } else {
            console.log(`   ⚠️ No external notes found for ${playerName}`);
        }

        return notes;
    }

    /**
     * NEW: Fetch player news from ESPN Fantasy API
     */
    private async fetchESPNPlayerNews(playerName: string, team?: string): Promise<ESPNPlayerNews | null> {
        try {
            // ESPN search API - public endpoint
            const searchUrl = `https://site.api.espn.com/apis/common/v3/search`;

            const response = await axios.get(searchUrl, {
                params: {
                    query: `${playerName} NFL`,
                    lang: 'en',
                    region: 'us',
                    limit: 3,
                    page: 1
                },
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // Look for player-related content in search results
            if (response.data?.contents) {
                for (const content of response.data.contents) {
                    if (content.headline) {
                        const headline = content.headline.toLowerCase();
                        const playerFirst = playerName.split(' ')[0].toLowerCase();
                        const playerLast = playerName.split(' ')[1]?.toLowerCase() || '';

                        // Check if headline mentions the player
                        if (headline.includes(playerFirst) && (playerLast ? headline.includes(playerLast) : true)) {
                            return {
                                headline: content.headline,
                                description: content.description || content.summary || null,
                                published: content.published || null,
                                source: 'ESPN'
                            };
                        }
                    }
                }
            }

            return null;
        } catch (error) {
            console.warn(`   ⚠️ Could not fetch ESPN news for ${playerName}:`, error.message);
            return null;
        }
    }

    /**
     * NEW: Fetch player news from NFL.com
     */
    private async fetchNFLPlayerNews(playerName: string): Promise<string | null> {
        try {
            // Using a more reliable news API approach
            const response = await axios.get(`https://newsapi.org/v2/everything`, {
                params: {
                    q: `"${playerName}" NFL fantasy football`,
                    sortBy: 'publishedAt',
                    pageSize: 3,
                    apiKey: process.env.NEWS_API_KEY || 'demo_key'
                },
                timeout: 5000
            });

            if (response.data?.articles?.[0]) {
                const article = response.data.articles[0];
                return `${article.title}: ${article.description || ''}`.substring(0, 200);
            }

            return null;
        } catch (error) {
            // Fallback to a simpler approach if NewsAPI fails
            console.warn(`   ⚠️ Could not fetch NFL news for ${playerName}, trying fallback...`);
            return null;
        }
    }

    /**
     * NEW: Process external notes into actionable insights
     */
    private processExternalNotes(notes: PlayerNotes, player: Player): string[] {
        const insights: string[] = [];

        // Process ESPN news
        if (notes.espnNews?.headline) {
            const headline = notes.espnNews.headline.toLowerCase();

            if (headline.includes('injury') || headline.includes('hurt') || headline.includes('questionable')) {
                insights.push('recent injury concerns per ESPN');
            }
            if (headline.includes('trade') || headline.includes('sign') || headline.includes('acquire')) {
                insights.push('recent team change per ESPN');
            }
            if (headline.includes('touchdown') || headline.includes('yards') || headline.includes('performance')) {
                insights.push('recent performance highlights per ESPN');
            }
            if (headline.includes('practice') || headline.includes('limited') || headline.includes('status')) {
                insights.push('practice/availability updates per ESPN');
            }
        }

        // Process description content for deeper insights
        if (notes.espnNews?.description) {
            const description = notes.espnNews.description.toLowerCase();

            if (description.includes('target share') || description.includes('targets')) {
                insights.push('target share discussion in recent news');
            }
            if (description.includes('red zone') || description.includes('goal line')) {
                insights.push('red zone role mentioned in news');
            }
            if (description.includes('depth chart') || description.includes('starter')) {
                insights.push('depth chart implications in news');
            }
        }

        // Add insights from aggregated sources
        if (notes.aggregatedInsights.length > 0) {
            insights.push(`current news coverage tracking ${player.name}`);
        }

        return insights.slice(0, 2); // Limit to 2 most relevant insights
    }

    /**
     * Generate enhanced player context using all available data with accurate ADP and current situation analysis
     */
    private async generateEnhancedPlayerContext(player: Player, stats?: PlayerStats): Promise<EnhancedPlayerContext> {
        // Get all available data for this player
        const adpData = dataParser.getPlayerADP(player.name);
        const marketShare = dataParser.getMarketShareByPosition(player.name, player.position);
        const redZoneData = dataParser.getRedZoneData(player.name, player.position);
        const coachingChange = dataParser.getCoachingChange(player.team);
        const rookieAnalysis = dataParser.getRookieAnalysis(player.name);
        const expertAnalysis = dataParser.getExpertAnalysis(player.name);

        // Fetch external notes
        const externalNotes = await this.fetchExternalPlayerNotes(player.name, player.team);

        // Generate contextual insights
        const contextualInsights: string[] = [];

        // FIXED: ADP Context with proper round calculation
        if (adpData) {
            // Parse ADP format: "5.1" means Round 5, Pick 1
            const actualRound = Math.floor(adpData.ppr);
            const pickInRound = Math.round((adpData.ppr - actualRound) * 10) || 1;

            // FIXED: Better round classification for 16-round drafts
            if (actualRound <= 3) {
                contextualInsights.push(`elite early-round selection (Round ${actualRound})`);
            } else if (actualRound <= 6) {
                contextualInsights.push(`mid-round value target (Round ${actualRound})`);
            } else if (actualRound <= 10) {
                contextualInsights.push(`late-round opportunity (Round ${actualRound})`);
            } else if (actualRound <= 13) {
                contextualInsights.push(`deep sleeper candidate (Round ${actualRound})`);
            } else {
                contextualInsights.push(`waiver wire/bench stash (Round ${actualRound}+)`);
            }
        }

        // ENHANCED: Usage Context with 2025 team situation awareness
        if (marketShare) {
            const primaryUsage = marketShare.attPercent || marketShare.tgtPercent || 0;

            // Check for team changes that affect usage context
            const teamChangeContext = this.getTeamChangeContext(player.name, player.team, player.position);

            if (primaryUsage >= 70) {
                contextualInsights.push(`elite 2024 usage (${primaryUsage}%) - workhorse role${teamChangeContext}`);
            } else if (primaryUsage >= 50) {
                contextualInsights.push(`high 2024 usage (${primaryUsage}%) - key weapon${teamChangeContext}`);
            } else if (primaryUsage >= 25) {
                contextualInsights.push(`moderate 2024 usage (${primaryUsage}%) - secondary role${teamChangeContext}`);
            } else if (primaryUsage > 0) {
                contextualInsights.push(`limited 2024 usage (${primaryUsage}%) - depth/situational${teamChangeContext}`);
            } else {
                contextualInsights.push(`minimal 2024 data - emerging/injured player${teamChangeContext}`);
            }
        }

        // ENHANCED: Red Zone Context with efficiency analysis
        if (redZoneData && redZoneData.rzTouchdowns > 0) {
            if (redZoneData.rzTdPercent >= 80) {
                contextualInsights.push(`elite red zone efficiency (${redZoneData.rzTdPercent}% TD rate)`);
            } else if (redZoneData.rzTdPercent >= 60) {
                contextualInsights.push(`solid red zone producer (${redZoneData.rzTdPercent}% TD rate)`);
            } else if (redZoneData.rzTdPercent >= 40) {
                contextualInsights.push(`inconsistent red zone production (${redZoneData.rzTdPercent}% TD rate)`);
            } else {
                contextualInsights.push(`poor red zone efficiency (${redZoneData.rzTdPercent}% TD rate)`);
            }
        }

        // ENHANCED: Age/Experience/Situation Context
        if (rookieAnalysis) {
            const draftCapital = rookieAnalysis.draftRound <= 2 ? 'high draft capital' :
                rookieAnalysis.draftRound <= 4 ? 'solid draft capital' : 'late draft capital';
            contextualInsights.push(`2025 rookie with ${draftCapital} (Round ${rookieAnalysis.draftRound})`);
        } else {
            // Determine veteran status and current situation
            const veteranContext = this.getVeteranContext(player, stats, expertAnalysis);
            if (veteranContext) {
                contextualInsights.push(veteranContext);
            }
        }

        // ENHANCED: Coaching/Team Change Impact
        if (coachingChange) {
            contextualInsights.push(`new ${coachingChange.position} (${coachingChange.newCoach}) - scheme uncertainty`);
        }

        // ENHANCED: Expert Analysis Integration
        if (expertAnalysis) {
            const expertInsights = this.extractExpertInsights(expertAnalysis, player);
            contextualInsights.push(...expertInsights);
        }

        // Add external notes to insights
        if (externalNotes.aggregatedInsights.length > 0) {
            contextualInsights.push(`current news coverage tracking ${player.name}`);
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
            contextualInsights,
            externalNotes
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
            const actualRound = Math.floor(adpData.ppr);
            const pickInRound = Math.round((adpData.ppr - actualRound) * 10) || 1;

            userPrompt += `ADP DATA:\n`;
            userPrompt += `- PPR ADP: ${adpData.ppr} (Round ${actualRound}, Pick ${pickInRound})\n`;
            userPrompt += `- Standard: ${adpData.standard} | Superflex: ${adpData.superflex}\n`;
            userPrompt += `- Draft Tier: ${actualRound <= 3 ? 'Elite Early' : actualRound <= 6 ? 'Mid-Round' : actualRound <= 10 ? 'Late Round' : 'Deep Sleeper'}\n`;
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

        // External Notes Section
        if (context.externalNotes?.aggregatedInsights.length > 0) {
            userPrompt += `EXTERNAL NOTES:\n`;
            userPrompt += context.externalNotes.aggregatedInsights.map(insight => `- ${insight}`).join('\n');
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
            const context = await this.generateEnhancedPlayerContext(player, mockStats);

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
            const context = await this.generateEnhancedPlayerContext(player, mockStats);

            // Display context summary
            console.log(`    Context: ${context.contextualInsights.join(', ')}`);
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

    private async getTop500PlayersFromADP(): Promise<string[]> {
        try {
            const fs = await import('fs');
            const path = await import('path');

            console.log('📋 Loading top 500 players from ADP CSV...');

            const adpFilePath = path.join(process.cwd(), 'data/adp/2025_sleeper_adp_ppr.csv');
            const adpContent = fs.readFileSync(adpFilePath, 'utf-8');
            const lines = adpContent.split('\n').slice(1); // Skip header

            const top500Names: string[] = [];

            // Take first 500 lines (top 500 ADP players)
            for (let i = 0; i < Math.min(500, lines.length); i++) {
                const line = lines[i].trim();
                if (line) {
                    const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
                    if (columns.length >= 1 && columns[0]) {
                        top500Names.push(columns[0]); // Player name is first column
                    }
                }
            }

            console.log(`✅ Loaded ${top500Names.length} top ADP players`);
            return top500Names;

        } catch (error) {
            console.error('❌ Error loading ADP file:', error);
            return [];
        }
    }

    public async generateTop500EnhancedSummaries(forceRegenerate: boolean = false): Promise<void> {
        try {
            console.log('🚀 Starting Enhanced Player Summary Generation (Top 500 ADP Players)...');
            await this.initialize();

            // Get top 500 player names from ADP CSV
            const top500Names = await this.getTop500PlayersFromADP();

            if (top500Names.length === 0) {
                console.error('❌ No players found in ADP file');
                return;
            }

            // Fetch all players from Supabase
            const { data: allPlayers, error } = await supabase
                .from('players')
                .select('sleeper_id, name, position, team, summary_2025, summary_updated_at, adp_2025, ownership_percent, start_percent, fantasy_points_2024, positional_rank_2024');

            if (error) {
                throw new Error(`Failed to fetch players: ${error.message}`);
            }

            // Filter to only top 500 ADP players
            const top500Players = (allPlayers || []).filter(player =>
                top500Names.some(adpName =>
                    this.normalizePlayerName(player.name) === this.normalizePlayerName(adpName)
                )
            );

            console.log(`🎯 Matched ${top500Players.length} players from top 500 ADP list`);

            // Filter players that need summaries
            const playersToProcess = forceRegenerate
                ? top500Players
                : top500Players.filter(p => !p.summary_2025 || !p.summary_updated_at);

            console.log(`📝 Found ${playersToProcess.length} top 500 players to process`);

            if (playersToProcess.length === 0) {
                console.log('✅ All top 500 players already have enhanced summaries. Use --force to regenerate.');
                return;
            }

            let processed = 0;
            let successful = 0;
            let failed = 0;

            for (const player of playersToProcess) {
                try {
                    console.log(`\n[${++processed}/${playersToProcess.length}] Processing ${player.name} (Top 500)...`);

                    // Generate enhanced context
                    const context = await this.generateEnhancedPlayerContext(player);

                    // Show context preview
                    if (context.adpData) {
                        console.log(`   💰 ADP: ${context.adpData.ppr} (Round ${Math.ceil(context.adpData.ppr / 12)})`);
                    }
                    console.log(`   🧠 Context: ${context.contextualInsights.slice(0, 2).join(', ')}...`);

                    // Generate AI summary
                    const summary = await this.generateAISummary(context);

                    // Update database
                    await this.updatePlayerSummary(player.sleeper_id, summary);

                    successful++;
                    console.log(`✅ Successfully updated ${player.name}`);

                    // Rate limiting: 1 second between calls
                    if (processed < playersToProcess.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                } catch (error: any) {
                    failed++;
                    console.error(`❌ Failed to process ${player.name}:`, error.message);
                }
            }

            console.log('\n📊 Top 500 Enhanced Summary Generation Complete!');
            console.log(`✅ Successful: ${successful}`);
            console.log(`❌ Failed: ${failed}`);
            console.log(`📝 Total Processed: ${processed}`);
            console.log(`🎯 Focused on top ${top500Names.length} ADP players`);

        } catch (error: any) {
            console.error('💥 Critical error:', error.message);
            process.exit(1);
        }
    }

    private async updatePlayerSummary(sleeperId: string, summary: string): Promise<void> {
        const { error } = await supabase
            .from('players')
            .update({
                summary_2025: summary,
                summary_updated_at: new Date().toISOString(),
                summary_type: 'enhanced',
                summary_week: null,
            })
            .eq('sleeper_id', sleeperId);

        if (error) {
            throw new Error(`Failed to update player ${sleeperId}: ${error.message}`);
        }
    }

    private normalizePlayerName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ')        // Normalize spaces
            .trim();
    }

    /**
     * Get team change context for players who switched teams
     */
    private getTeamChangeContext(playerName: string, currentTeam: string, position: string): string {
        // Known 2025 team changes that affect context
        const teamChanges: Record<string, { from: string; to: string; impact: string }> = {
            'Najee Harris': { from: 'PIT', to: 'LAC', impact: ' but now with LAC competing with rookie Omarion Hampton' },
            'Calvin Ridley': { from: 'TEN', to: 'JAX', impact: ' but reunited with proven QB in Jacksonville' },
            'T.J. Hockenson': { from: 'MIN', to: 'MIN', impact: ' returning from injury as TE1' },
            'Saquon Barkley': { from: 'NYG', to: 'PHI', impact: ' in explosive Eagles offense' },
            // Add more known team changes
        };

        const change = teamChanges[playerName];
        if (change && change.to === currentTeam) {
            return change.impact;
        }

        // Check for injury return context
        if (playerName.includes('Hockenson')) {
            return ' returning from 2024 injury';
        }

        return '';
    }

    /**
     * Get veteran player context based on situation and expert analysis
     */
    private getVeteranContext(player: Player, stats?: PlayerStats, expertAnalysis?: string): string | null {
        // Analyze expert analysis for key context clues
        if (expertAnalysis) {
            const analysis = expertAnalysis.toLowerCase();

            if (analysis.includes('injury') || analysis.includes('injured')) {
                return 'veteran returning from injury concerns';
            }
            if (analysis.includes('new team') || analysis.includes('signed with')) {
                return 'veteran in new system/team';
            }
            if (analysis.includes('competition') || analysis.includes('threat')) {
                return 'veteran facing increased competition';
            }
            if (analysis.includes('decline') || analysis.includes('aging')) {
                return 'veteran showing signs of decline';
            }
            if (analysis.includes('proven') || analysis.includes('consistent')) {
                return 'proven veteran producer';
            }
        }

        // Fallback to stats-based analysis
        if (stats && stats.fantasy_points) {
            if (stats.fantasy_points > 250) {
                return 'established high-end producer';
            } else if (stats.fantasy_points > 150) {
                return 'solid veteran contributor';
            } else {
                return 'veteran seeking bounce-back season';
            }
        }

        return 'veteran player with established role';
    }

    /**
     * Extract key insights from expert analysis
     */
    private extractExpertInsights(expertAnalysis: string, player: Player): string[] {
        const insights: string[] = [];
        const analysis = expertAnalysis.toLowerCase();

        // Look for specific situation keywords
        if (analysis.includes('breakout') || analysis.includes('emerge')) {
            insights.push('breakout candidate per experts');
        }
        if (analysis.includes('bust') || analysis.includes('avoid')) {
            insights.push('expert concerns about value');
        }
        if (analysis.includes('sleeper') || analysis.includes('undervalued')) {
            insights.push('potential sleeper value');
        }
        if (analysis.includes('target share') || analysis.includes('volume')) {
            insights.push('volume/opportunity questions');
        }

        return insights.slice(0, 2); // Limit to 2 expert insights
    }
}

// Run the FULL AI test
const generator = new EnhancedPlayerSummaryGenerator();
const forceRegenerate = process.argv.includes('--force');
await generator.generateTop500EnhancedSummaries(forceRegenerate); // TOP 500 MODE
