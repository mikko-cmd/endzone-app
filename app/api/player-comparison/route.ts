// COMPLETE FIXED VERSION - Replace your entire file with this:

import { NextResponse } from 'next/server';
import { dataParser } from '@/lib/dataParser';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface EnhancedPlayerAnalysis {
    playerId: string;
    playerName: string;
    position: string;
    team: string;
    adpData?: any;
    marketShare?: any;
    redZoneData?: any;
    coachingChange?: any;
    rookieAnalysis?: any;
    expertAnalysis?: string;
    contextualInsights: string[];
    scores: {
        adpValue: number;
        usage: number;
        efficiency: number;
        situation: number;
        overall: number;
    };
}

interface EnhancedComparisonDetails {
    player1: string;
    player2: string;
    player3?: string;
    advantages: {
        player1: string[];
        player2: string[];
        player3?: string[];
    };
    categories: {
        adpValue: 'player1' | 'player2' | 'player3' | 'tie';
        usage: 'player1' | 'player2' | 'player3' | 'tie';
        efficiency: 'player1' | 'player2' | 'player3' | 'tie';
        situation: 'player1' | 'player2' | 'player3' | 'tie';
        redZone: 'player1' | 'player2' | 'player3' | 'tie';
    };
    overallWinner: 'player1' | 'player2' | 'player3' | 'tie';
    confidence: number;
    reasoning: string[];
}

class EnhancedPlayerComparison {

    static async initialize(): Promise<void> {
        await dataParser.initializeData();
    }

    static async getPlayerFromDatabase(sleeperId: string): Promise<{ name: string, position: string, team: string } | null> {
        try {
            const { data: player } = await supabase
                .from('players')
                .select('name, position, team')
                .eq('sleeper_id', sleeperId)
                .single();

            return player;
        } catch (error) {
            console.error(`Failed to fetch player ${sleeperId}:`, error);
            return null;
        }
    }

    static generateEnhancedPlayerAnalysis(playerName: string, position: string, team: string): EnhancedPlayerAnalysis {
        const adpData = dataParser.getPlayerADP(playerName);
        const marketShare = dataParser.getMarketShareByPosition(playerName, position);
        const redZoneData = dataParser.getRedZoneData(playerName, position);
        const coachingChange = dataParser.getCoachingChange(team);
        const rookieAnalysis = dataParser.getRookieAnalysis(playerName);
        const expertAnalysis = dataParser.getExpertAnalysis(playerName);

        const contextualInsights: string[] = [];

        const scores = {
            adpValue: this.calculateADPValueScore(adpData, position),
            usage: this.calculateUsageScore(marketShare, position),
            efficiency: this.calculateEfficiencyScore(redZoneData, marketShare, position),
            situation: this.calculateSituationScore(coachingChange, rookieAnalysis),
            overall: 0
        };

        // Calculate overall score (weighted for weekly performance, not draft value)
        scores.overall = Math.round(
            (scores.adpValue * 0.10) +     // Reduced from 0.25 - ADP less important for weekly
            (scores.usage * 0.40) +        // Increased from 0.30 - Usage most important for weekly
            (scores.efficiency * 0.30) +   // Increased from 0.25 - Efficiency crucial for weekly
            (scores.situation * 0.20)      // Same - Team context still matters
        );

        // Generate insights
        if (scores.adpValue >= 80) contextualInsights.push('excellent draft value');
        else if (scores.adpValue >= 60) contextualInsights.push('solid draft value');
        else if (scores.adpValue <= 40) contextualInsights.push('expensive for expected return');

        if (scores.usage >= 80) contextualInsights.push('elite usage rate');
        else if (scores.usage >= 60) contextualInsights.push('good usage rate');
        else if (scores.usage <= 40) contextualInsights.push('limited usage opportunities');

        if (scores.efficiency >= 80) contextualInsights.push('elite efficiency metrics');
        else if (scores.efficiency >= 60) contextualInsights.push('solid efficiency');

        if (rookieAnalysis) {
            contextualInsights.push(`rookie with ${rookieAnalysis.draftRound === 1 ? 'high' : 'moderate'} expectations`);
        }

        if (coachingChange) {
            contextualInsights.push(`coaching change impact (${coachingChange.newCoach})`);
        }

        return {
            playerId: playerName,
            playerName,
            position,
            team,
            adpData,
            marketShare,
            redZoneData,
            coachingChange,
            rookieAnalysis,
            expertAnalysis,
            contextualInsights,
            scores
        };
    }

    static calculateADPValueScore(adpData: any, position: string): number {
        if (!adpData) return 50;

        const adp = adpData.ppr;

        if (position === 'QB') {
            if (adp <= 36) return 85;
            if (adp <= 72) return 70;
            if (adp <= 120) return 80;
            return 60;
        } else if (position === 'RB') {
            if (adp <= 24) return 75;
            if (adp <= 48) return 80;
            if (adp <= 84) return 70;
            return 65;
        } else if (['WR', 'TE'].includes(position)) {
            if (adp <= 36) return 80;
            if (adp <= 72) return 75;
            if (adp <= 120) return 85;
            return 60;
        }

        return 50;
    }

    static calculateUsageScore(marketShare: any, position: string): number {
        if (!marketShare) return 40;

        let primaryUsage = 0;

        if (position === 'RB') {
            primaryUsage = Math.max(marketShare.attPercent || 0, marketShare.tgtPercent || 0);
        } else if (['WR', 'TE'].includes(position)) {
            primaryUsage = marketShare.tgtPercent || 0;
        }

        if (primaryUsage >= 70) return 95;
        if (primaryUsage >= 50) return 85;
        if (primaryUsage >= 30) return 70;
        if (primaryUsage >= 15) return 55;
        return 35;
    }

    static calculateEfficiencyScore(redZoneData: any, marketShare: any, position: string): number {
        if (!redZoneData && !marketShare) return 50;

        let efficiencyScore = 50;

        if (redZoneData) {
            const rzEfficiency = redZoneData.rzTdPercent || 0;
            if (rzEfficiency >= 80) efficiencyScore += 25;
            else if (rzEfficiency >= 60) efficiencyScore += 15;
            else if (rzEfficiency >= 40) efficiencyScore += 5;
            else efficiencyScore -= 10;

            if (redZoneData.glTdPercent >= 70) efficiencyScore += 10;
        }

        if (marketShare) {
            const opportunities = (marketShare.attPercent || 0) + (marketShare.tgtPercent || 0);

            if (opportunities > 0) {
                const efficiencyRatio = (marketShare.rbPointsPercent || marketShare.recPercent || 0) / opportunities;
                if (efficiencyRatio >= 1.2) efficiencyScore += 15;
                else if (efficiencyRatio >= 1.0) efficiencyScore += 10;
                else if (efficiencyRatio >= 0.8) efficiencyScore += 5;
            }
        }

        return Math.min(Math.max(efficiencyScore, 0), 100);
    }

    static calculateSituationScore(coachingChange: any, rookieAnalysis: any): number {
        let situationScore = 60;

        if (coachingChange) {
            if (coachingChange.fantasyImpact.toLowerCase().includes('offense') ||
                coachingChange.fantasyImpact.toLowerCase().includes('production')) {
                situationScore += 15;
            } else {
                situationScore += 5;
            }
        }

        if (rookieAnalysis) {
            if (rookieAnalysis.draftRound === 1) {
                situationScore += 20;
            } else if (rookieAnalysis.draftRound <= 3) {
                situationScore += 10;
            } else {
                situationScore -= 5;
            }
        } else {
            situationScore += 10;
        }

        return Math.min(Math.max(situationScore, 0), 100);
    }

    static comparePlayersEnhanced(players: EnhancedPlayerAnalysis[]): EnhancedComparisonDetails {
        if (players.length < 2) {
            throw new Error('Need at least 2 players to compare');
        }

        const [player1, player2, player3] = players;

        const categories = {
            adpValue: this.determineWinner(players, 'adpValue'),
            usage: this.determineWinner(players, 'usage'),
            efficiency: this.determineWinner(players, 'efficiency'),
            situation: this.determineWinner(players, 'situation'),
            redZone: this.determineRedZoneWinner(players)
        };

        const overallWinner = this.determineWinner(players, 'overall');

        const scores = players.map(p => p.scores.overall);
        const maxScore = Math.max(...scores);
        const secondMax = scores.sort((a, b) => b - a)[1];
        const confidence = Math.min(95, Math.max(55, maxScore - secondMax + 50));

        const advantages = this.generateAdvantages(players);
        const reasoning = this.generateReasoning(players, categories, overallWinner);

        return {
            player1: player1.playerName,
            player2: player2.playerName,
            player3: player3?.playerName,
            advantages,
            categories,
            overallWinner,
            confidence,
            reasoning
        };
    }

    static determineWinner(players: EnhancedPlayerAnalysis[], category: keyof EnhancedPlayerAnalysis['scores']): 'player1' | 'player2' | 'player3' | 'tie' {
        const scores = players.map(p => p.scores[category]);
        const maxScore = Math.max(...scores);
        const winners = scores.map((score, index) => score === maxScore ? index : -1).filter(i => i !== -1);

        // If tied, use tiebreaker logic
        if (winners.length > 1) {
            console.log(`🤝 Tie detected in ${category}, using tiebreakers...`);

            // Tiebreaker 1: Efficiency score
            if (category !== 'efficiency') {
                const efficiencyScores = winners.map(i => players[i].scores.efficiency);
                const maxEff = Math.max(...efficiencyScores);
                const effWinners = winners.filter(i => players[i].scores.efficiency === maxEff);
                if (effWinners.length === 1) {
                    const winnerIndex = effWinners[0];
                    return winnerIndex === 0 ? 'player1' : winnerIndex === 1 ? 'player2' : 'player3';
                }
            }

            // Tiebreaker 2: Usage score
            if (category !== 'usage') {
                const usageScores = winners.map(i => players[i].scores.usage);
                const maxUsage = Math.max(...usageScores);
                const usageWinners = winners.filter(i => players[i].scores.usage === maxUsage);
                if (usageWinners.length === 1) {
                    const winnerIndex = usageWinners[0];
                    return winnerIndex === 0 ? 'player1' : winnerIndex === 1 ? 'player2' : 'player3';
                }
            }

            // Tiebreaker 3: ADP Value (lower ADP = better)
            if (category !== 'adpValue') {
                const adpValues = winners.map(i => players[i].adpData?.ppr || 999);
                const minADP = Math.min(...adpValues);
                const adpWinners = winners.filter(i => (players[i].adpData?.ppr || 999) === minADP);
                if (adpWinners.length === 1) {
                    const winnerIndex = adpWinners[0];
                    return winnerIndex === 0 ? 'player1' : winnerIndex === 1 ? 'player2' : 'player3';
                }
            }

            // Final tiebreaker: Prefer player1 (first in comparison)
            console.log(`🎲 Using final tiebreaker: player1`);
            return 'player1';
        }

        const winnerIndex = winners[0];
        return winnerIndex === 0 ? 'player1' : winnerIndex === 1 ? 'player2' : 'player3';
    }

    static determineRedZoneWinner(players: EnhancedPlayerAnalysis[]): 'player1' | 'player2' | 'player3' | 'tie' {
        const redZoneScores = players.map(p => {
            if (!p.redZoneData) return 0;
            return p.redZoneData.rzTdPercent + (p.redZoneData.rzTouchdowns / 5);
        });

        const maxScore = Math.max(...redZoneScores);
        if (maxScore === 0) return 'tie';

        const winnerIndex = redZoneScores.indexOf(maxScore);
        return winnerIndex === 0 ? 'player1' : winnerIndex === 1 ? 'player2' : 'player3';
    }

    static generateAdvantages(players: EnhancedPlayerAnalysis[]): any {
        const advantages: any = {
            player1: [],
            player2: [],
        };

        if (players[2]) advantages.player3 = [];

        players.forEach((player, index) => {
            const playerKey = index === 0 ? 'player1' : index === 1 ? 'player2' : 'player3';

            if (player.scores.adpValue >= 80) {
                advantages[playerKey].push(`Excellent draft value (ADP ${player.adpData?.ppr})`);
            }

            if (player.scores.usage >= 80) {
                const usage = player.marketShare?.attPercent || player.marketShare?.tgtPercent || 0;
                advantages[playerKey].push(`Elite usage rate (${usage}% of team opportunities)`);
            }

            if (player.redZoneData && player.redZoneData.rzTdPercent >= 70) {
                advantages[playerKey].push(`Elite red zone efficiency (${player.redZoneData.rzTdPercent}% TD rate)`);
            }

            player.contextualInsights.forEach(insight => {
                if (insight.includes('elite') || insight.includes('excellent')) {
                    advantages[playerKey].push(insight);
                }
            });
        });

        return advantages;
    }

    static generateReasoning(players: EnhancedPlayerAnalysis[], categories: any, winner: string): string[] {
        const winnerPlayer = winner === 'player1' ? players[0] : winner === 'player2' ? players[1] : players[2];

        if (!winnerPlayer) return ['Comparison analysis unavailable'];

        const reasons: string[] = [];

        // Check if it's a close matchup
        const scores = players.map(p => p.scores.overall);
        const maxScore = Math.max(...scores);
        const secondMax = scores.sort((a, b) => b - a)[1];
        const scoreDifference = maxScore - secondMax;

        if (scoreDifference <= 10) {
            reasons.push(`${winnerPlayer.playerName} has a slight edge in this close matchup (${winnerPlayer.scores.overall}/100)`);

            // For close matchups, focus on weekly factors
            const categoryWins = Object.values(categories).filter(cat => cat === winner).length;
            const totalCategories = Object.keys(categories).length;

            if (categoryWins >= 3) {
                reasons.push(`Holds advantages in ${categoryWins} of ${totalCategories} key areas`);
            } else {
                reasons.push(`Very competitive matchup with marginal differences`);
            }
        } else {
            reasons.push(`${winnerPlayer.playerName} emerges as the stronger start with ${winnerPlayer.scores.overall}/100`);

            const categoryWins = Object.values(categories).filter(cat => cat === winner).length;
            reasons.push(`Clear advantages in ${categoryWins} out of 5 key categories`);
        }

        // Focus on weekly performance factors (remove ADP completely)
        if (winnerPlayer.scores.usage >= 70) {
            const usage = winnerPlayer.marketShare?.attPercent || winnerPlayer.marketShare?.tgtPercent || 0;
            if (usage > 0) {
                if (usage >= 50) {
                    reasons.push(`High-volume role with ${usage}% team usage for consistent touches`);
                } else {
                    reasons.push(`Solid ${usage}% team usage provides weekly floor`);
                }
            } else {
                reasons.push(`Projected for increased weekly opportunity share`);
            }
        }

        // Red zone opportunities (weekly scoring potential)
        if (winnerPlayer.redZoneData && winnerPlayer.redZoneData.rzTdPercent >= 60) {
            reasons.push(`Strong red zone role (${winnerPlayer.redZoneData.rzTdPercent}% conversion rate) boosts touchdown ceiling`);
        } else if (winnerPlayer.redZoneData && winnerPlayer.redZoneData.rzTouchdowns >= 5) {
            reasons.push(`Proven red zone producer with ${winnerPlayer.redZoneData.rzTouchdowns} TDs in 2024`);
        }

        // Team situation factors (weekly game script impact)
        if (winnerPlayer.coachingChange) {
            reasons.push(`Potential scheme upgrade under new coaching staff`);
        }

        if (winnerPlayer.rookieAnalysis) {
            reasons.push(`Emerging opportunity for increased weekly involvement`);
        }

        // Add relevant weekly performance insights
        const weeklyInsights = winnerPlayer.contextualInsights.filter(insight =>
            !insight.includes('draft') &&
            !insight.includes('adp') &&
            !insight.includes('round') &&
            (insight.includes('usage') || insight.includes('efficiency') || insight.includes('opportunity'))
        );

        weeklyInsights.forEach(insight => {
            if (insight.includes('elite') || insight.includes('high') || insight.includes('solid')) {
                reasons.push(insight.charAt(0).toUpperCase() + insight.slice(1));
            }
        });

        // Ensure we have at least 3 reasons
        if (reasons.length < 3) {
            if (winnerPlayer.position === 'RB') {
                reasons.push(`Running back usage typically provides weekly consistency`);
            } else if (winnerPlayer.position === 'WR') {
                reasons.push(`Wide receiver target share offers weekly upside potential`);
            } else if (winnerPlayer.position === 'TE') {
                reasons.push(`Tight end role provides weekly floor in target-limited position`);
            } else if (winnerPlayer.position === 'QB') {
                reasons.push(`Quarterback position offers highest weekly fantasy ceiling`);
            }
        }

        return reasons.slice(0, 5); // Limit to 5 key reasons
    }

    static async generateAIAnalysis(comparison: EnhancedComparisonDetails, players: EnhancedPlayerAnalysis[]): Promise<string> {
        const winner = comparison.overallWinner;
        const winnerPlayer = winner === 'player1' ? players[0] : winner === 'player2' ? players[1] : players[2];

        if (!winnerPlayer) return 'AI analysis unavailable';

        const systemPrompt = `You are an expert fantasy football analyst providing Week 1 start/sit recommendations for the 2025 NFL season. 

CRITICAL CONTEXT FOR WEEK 1 ANALYSIS:
- This is Week 1 of the 2025 season - no 2025 game data exists yet
- Base your analysis entirely on FULL 2024 season performance data
- Do NOT focus on recent games or "hot streaks" from late 2024
- Emphasize season-long usage patterns, consistency, and role security
- Consider how 2024 full-season performance translates to Week 1 expectations
- Account for any coaching changes or team situation shifts entering 2025

APPROACH:
- Use specific 2024 season statistics and usage data
- Focus on weekly fantasy production reliability over the full season
- Avoid recent bias - treat all 2024 data equally, not just final games
- Be decisive but acknowledge Week 1 uncertainty when both players are close`;

        let userPrompt = `WEEK 1 START/SIT ANALYSIS (Based on 2024 Full Season Data):\n\n`;

        players.forEach((player, index) => {
            const playerNum = index + 1;
            userPrompt += `PLAYER ${playerNum}: ${player.playerName} (${player.position}, ${player.team})\n`;
            userPrompt += `- Weekly Performance Score: ${player.scores.overall}/100\n`;

            // Remove ADP from AI analysis since it's not relevant for start/sit
            if (player.marketShare) {
                const usage = player.marketShare.attPercent || player.marketShare.tgtPercent || 0;
                userPrompt += `- 2024 Season Usage: ${usage}% of team opportunities (full season average)\n`;
            }

            if (player.redZoneData) {
                userPrompt += `- 2024 Red Zone Production: ${player.redZoneData.rzTouchdowns} TDs on ${player.redZoneData.rzAttempts} attempts (${player.redZoneData.rzTdPercent}% rate)\n`;
            }

            // Add team context for 2025
            if (player.coachingChange) {
                userPrompt += `- 2025 Context: New coaching staff under ${player.coachingChange.newCoach}\n`;
            }

            if (player.rookieAnalysis) {
                userPrompt += `- 2025 Context: Rookie entering second season with established role\n`;
            }

            userPrompt += `- Performance Profile: ${player.contextualInsights.join(', ')}\n\n`;
        });

        userPrompt += `RECOMMENDED START: ${winnerPlayer.playerName}\n`;
        userPrompt += `ANALYSIS CONFIDENCE: ${comparison.confidence}%\n\n`;

        userPrompt += `INSTRUCTIONS:
Provide a decisive Week 1 start/sit recommendation explaining why ${winnerPlayer.playerName} is the better choice for Week 1. 

Focus on:
1. How their 2024 full-season performance translates to Week 1 expectations
2. Weekly fantasy production reliability and floor/ceiling based on 2024 data
3. Team role security and usage patterns from 2024
4. Any 2025 situation changes that impact Week 1 specifically

Keep under 130 words and be specific about why this choice makes sense for Week 1 specifically.`;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: 200,
                temperature: 0.7,
            });

            return response.choices[0]?.message?.content || 'AI analysis unavailable';
        } catch (error) {
            console.error('Error generating AI analysis:', error);
            return 'AI analysis unavailable due to technical error';
        }
    }
}

// Main API endpoint
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const player1Id = searchParams.get('player1');
        const player2Id = searchParams.get('player2');
        const player3Id = searchParams.get('player3');

        console.log('🔍 Comparison request:', { player1Id, player2Id, player3Id });

        if (!player1Id || !player2Id) {
            return NextResponse.json({ error: 'player1 and player2 parameters are required' }, { status: 400 });
        }

        // Initialize enhanced data
        console.log('🔄 Initializing enhanced player comparison...');
        await EnhancedPlayerComparison.initialize();

        // Get player info from database using Sleeper IDs
        console.log('🔍 Looking up players in database...');
        const player1Info = await EnhancedPlayerComparison.getPlayerFromDatabase(player1Id);
        const player2Info = await EnhancedPlayerComparison.getPlayerFromDatabase(player2Id);
        const player3Info = player3Id ? await EnhancedPlayerComparison.getPlayerFromDatabase(player3Id) : null;

        console.log('👤 Player lookup results:', {
            player1Info,
            player2Info,
            player3Info
        });

        if (!player1Info || !player2Info) {
            console.error('❌ Players not found in database');
            return NextResponse.json({
                error: 'One or more players not found in database',
                details: {
                    player1Found: !!player1Info,
                    player2Found: !!player2Info,
                    player1Id,
                    player2Id
                }
            }, { status: 404 });
        }

        // Generate enhanced analysis for each player
        console.log('🧠 Generating enhanced analysis...');
        const players: EnhancedPlayerAnalysis[] = [];

        try {
            const player1Analysis = EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
                player1Info.name,
                player1Info.position,
                player1Info.team
            );
            console.log('✅ Player 1 analysis:', {
                name: player1Analysis.playerName,
                scores: player1Analysis.scores,
                insights: player1Analysis.contextualInsights
            });
            players.push(player1Analysis);

            const player2Analysis = EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
                player2Info.name,
                player2Info.position,
                player2Info.team
            );
            console.log('✅ Player 2 analysis:', {
                name: player2Analysis.playerName,
                scores: player2Analysis.scores,
                insights: player2Analysis.contextualInsights
            });
            players.push(player2Analysis);

            if (player3Info) {
                const player3Analysis = EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
                    player3Info.name,
                    player3Info.position,
                    player3Info.team
                );
                console.log('✅ Player 3 analysis:', {
                    name: player3Analysis.playerName,
                    scores: player3Analysis.scores,
                    insights: player3Analysis.contextualInsights
                });
                players.push(player3Analysis);
            }
        } catch (analysisError) {
            console.error('❌ Error generating player analysis:', analysisError);
            return NextResponse.json({
                error: 'Failed to generate player analysis',
                details: analysisError instanceof Error ? analysisError.message : 'Unknown analysis error'
            }, { status: 500 });
        }

        // Generate enhanced comparison
        console.log('⚖️ Generating comparison...');
        const comparison = EnhancedPlayerComparison.comparePlayersEnhanced(players);
        console.log('✅ Comparison result:', {
            winner: comparison.overallWinner,
            confidence: comparison.confidence,
            categories: comparison.categories
        });

        // Generate AI analysis
        console.log('🤖 Generating AI analysis...');
        const aiAnalysis = await EnhancedPlayerComparison.generateAIAnalysis(comparison, players);
        console.log('✅ AI analysis generated:', aiAnalysis.substring(0, 100) + '...');

        const winnerPlayer = comparison.overallWinner === 'player1' ? players[0] :
            comparison.overallWinner === 'player2' ? players[1] : players[2];

        // Sort players by overall score for rankings
        const sortedPlayers = [...players].sort((a, b) => b.scores.overall - a.scores.overall);

        // Create category rankings
        const categoryRankings = {
            adpValue: [...players].sort((a, b) => b.scores.adpValue - a.scores.adpValue),
            usage: [...players].sort((a, b) => b.scores.usage - a.scores.usage),
            efficiency: [...players].sort((a, b) => b.scores.efficiency - a.scores.efficiency),
            situation: [...players].sort((a, b) => b.scores.situation - a.scores.situation),
        };

        const response = {
            players: players.map(p => ({
                name: p.playerName,
                position: p.position,
                team: p.team,
                scores: p.scores,
                insights: p.contextualInsights,
                adp: p.adpData?.ppr,
                usage: p.marketShare ? (p.marketShare.attPercent || p.marketShare.tgtPercent) : null,
                redZoneTDs: p.redZoneData?.rzTouchdowns || null
            })),
            headToHead: comparison,
            rankings: {
                overall: sortedPlayers.map((p, index) => ({
                    playerId: p.playerName,
                    playerName: p.playerName,
                    rank: index + 1,
                    score: p.scores.overall,
                    overallScore: p.scores.overall,
                    matchupScore: p.scores.situation,
                    formScore: p.scores.usage,
                    ceilingScore: p.scores.efficiency,
                    floorScore: p.scores.adpValue,
                    weatherScore: 50,
                    reasoning: p.contextualInsights
                })),
                byCategory: Object.fromEntries(
                    Object.entries(categoryRankings).map(([category, rankingsArray]) => [
                        category,
                        rankingsArray.map((p, index) => ({
                            playerId: p.playerName,
                            playerName: p.playerName,
                            rank: index + 1,
                            score: p.scores[category as keyof typeof p.scores],
                            reasoning: p.contextualInsights
                        }))
                    ])
                )
            },
            recommendation: {
                startPlayer: winnerPlayer?.playerName || 'Analysis Unavailable',
                confidence: comparison.confidence || 50,
                reasoning: comparison.reasoning || ['Analysis unavailable'],
                aiAnalysis: aiAnalysis || 'AI analysis unavailable',
                winner: comparison.overallWinner || 'tie'
            },
            enhanced: true,
            dataSourcesUsed: [
                'Sleeper ADP Rankings',
                'Market Share Analytics',
                'Red Zone Efficiency',
                'Expert Analysis',
                'Coaching Changes',
                'Rookie Scouting'
            ]
        };

        console.log('🎉 Comparison response ready:', {
            playersCount: response.players.length,
            winner: response.recommendation.startPlayer,
            confidence: response.recommendation.confidence
        });

        return NextResponse.json(response);

    } catch (error) {
        console.error('💥 Enhanced player comparison error:', error);
        return NextResponse.json({
            error: 'Failed to generate enhanced comparison',
            details: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
