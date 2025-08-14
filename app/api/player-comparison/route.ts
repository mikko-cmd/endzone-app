// COMPLETE ENHANCED VERSION WITH SCHEDULE INTEGRATION

import { NextResponse } from 'next/server';
import { dataParser } from '@/lib/dataParser';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { contextEngine } from '@/lib/contextEngine';
import { projectionService } from '@/lib/services/projectionService';

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
    weeklyOpponent?: {
        opponent: string;
        isHome: boolean;
        defenseRank: number;
        isBye: boolean;
    };
    scores: {
        efficiency: number;
        recentPerformance: number;
        defensiveMatchup: number;
        overall: number;
    };
    derived?: {
        redZoneEff?: string;
        positionRank?: string;
    };
}

interface EnhancedComparisonDetails {
    player1: string;
    player2: string;
    player3?: string;
    advantages: string[];
    categories: {
        efficiency: 'player1' | 'player2' | 'player3' | 'tie';
        recentPerformance: 'player1' | 'player2' | 'player3' | 'tie';
        defensiveMatchup: 'player1' | 'player2' | 'player3' | 'tie';
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
            const { data, error } = await supabase
                .from('players')
                .select('name, position, team')
                .eq('sleeper_id', sleeperId)
                .single();

            if (error || !data) return null;
            return data;
        } catch (error: any) {
            console.error('Database lookup error:', error);
            return null;
        }
    }

    // Enhanced version with real data and scoring
    static async generateEnhancedPlayerAnalysis(playerName: string, position: string, team: string, week: number = 1): Promise<EnhancedPlayerAnalysis> {
        const adpData = dataParser.getPlayerADP(playerName);
        const marketShare = dataParser.getMarketShareByPosition(playerName, position);
        const redZoneData = dataParser.getRedZoneData(playerName, position);
        const coachingChange = dataParser.getCoachingChange2025(team);
        const rookieAnalysis = dataParser.getRookieAnalysis(playerName);
        const expertAnalysis = dataParser.getExpertAnalysis(playerName);

        // Get current week opponent data using schedule system
        const matchup = dataParser.getWeekMatchup(team, week, position);
        const weeklyOpponent = {
            opponent: matchup.opponent,
            isHome: matchup.isHome,
            defenseRank: matchup.opponentDefenseRank || 16,
            isBye: matchup.isBye
        };

        const contextualInsights: string[] = [];

        // Calculate real scores based on data
        const scores = {
            efficiency: this.calculateEfficiencyScore(redZoneData, marketShare, position),
            recentPerformance: this.calculateRecentPerformanceScore(marketShare, position, redZoneData),
            defensiveMatchup: this.calculateDefensiveMatchupScore(weeklyOpponent.defenseRank, position, weeklyOpponent.isBye),
            overall: 0
        };

        // Calculate overall score with position-specific weighting
        if (position === 'QB') {
            scores.overall = Math.round(
                (scores.efficiency * 0.35) +
                (scores.recentPerformance * 0.35) +
                (scores.defensiveMatchup * 0.30)
            );
        } else {
            scores.overall = Math.round(
                (scores.efficiency * 0.30) +
                (scores.recentPerformance * 0.40) +
                (scores.defensiveMatchup * 0.30)
            );
        }

        // Add contextual insights based on real data
        if (marketShare) {
            const usage = marketShare.tgtPercent || marketShare.attPercent || 0;
            if (usage >= 25) {
                contextualInsights.push('High usage rate in 2024');
            } else if (usage >= 15) {
                contextualInsights.push('Moderate usage rate in 2024');
            } else {
                contextualInsights.push('Limited usage in 2024');
            }

            const efficiency = marketShare.ydPercent || 0;
            if (efficiency >= 25) {
                contextualInsights.push('Elite efficiency metrics');
            } else if (efficiency >= 15) {
                contextualInsights.push('Solid efficiency metrics');
            }
        }

        // Add coaching change context
        if (coachingChange && coachingChange.length > 0) {
            const change = coachingChange[0];
            if (change.fantasyImpact.includes('High positive')) {
                contextualInsights.push('Positive coaching change impact expected');
            } else if (change.fantasyImpact.includes('negative')) {
                contextualInsights.push('Coaching change concerns');
            }
        }

        // Add matchup context
        if (weeklyOpponent.defenseRank <= 10) {
            contextualInsights.push('Facing tough defense this week');
        } else if (weeklyOpponent.defenseRank >= 25) {
            contextualInsights.push('Favorable defensive matchup');
        }

        // Derived display fields
        const derived: any = {};
        if (redZoneData) {
            const t = redZoneData.rzTouchdowns || 0;
            const a = redZoneData.rzAttempts || 0;
            const r = a ? ((t / a) * 100).toFixed(1) : '0.0';
            derived.redZoneEff = `${t} / ${a} (${r}%)`;
        }

        const posRank = dataParser.getPositionRank(playerName, position);
        if (posRank && position) {
            derived.positionRank = `${position.toUpperCase()}${posRank}`;
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
            weeklyOpponent,
            scores,
            derived
        };
    }

    // Add the scoring methods that were missing
    static calculateEfficiencyScore(redZoneData: any, marketShare: any, position: string): number {
        let score = 50; // Base score

        if (position === 'QB') {
            if (redZoneData) {
                const touchdowns = redZoneData.rzTouchdowns || 0;
                const attempts = redZoneData.rzAttempts || 1;
                const tdRate = (touchdowns / attempts) * 100;

                if (tdRate >= 60) score = 95;
                else if (tdRate >= 50) score = 90;
                else if (tdRate >= 40) score = 85;
                else if (tdRate >= 30) score = 80;
                else if (tdRate >= 20) score = 75;
                else score = 65;
            }
        } else {
            if (marketShare) {
                const yardageShare = marketShare.ydPercent || 0;
                const touchdownShare = marketShare.tdPercent || 0;

                if (yardageShare >= 30) score += 25;
                else if (yardageShare >= 25) score += 20;
                else if (yardageShare >= 20) score += 15;
                else if (yardageShare >= 15) score += 10;

                if (touchdownShare >= 30) score += 25;
                else if (touchdownShare >= 25) score += 20;
                else if (touchdownShare >= 20) score += 15;
                else if (touchdownShare >= 15) score += 10;
            }
        }

        return Math.min(Math.max(score, 0), 100);
    }

    static calculateRecentPerformanceScore(marketShare: any, position: string, redZoneData?: any): number {
        let score = 50;

        if (position === 'QB') {
            if (redZoneData) {
                const touchdowns = redZoneData.rzTouchdowns || 0;
                if (touchdowns >= 25) score = 90;
                else if (touchdowns >= 20) score = 85;
                else if (touchdowns >= 15) score = 80;
                else if (touchdowns >= 10) score = 75;
                else score = 65;
            }
        } else if (marketShare) {
            const usage = marketShare.attPercent || marketShare.tgtPercent || 0;
            if (usage >= 25) score = 90;
            else if (usage >= 20) score = 80;
            else if (usage >= 15) score = 70;
            else if (usage >= 10) score = 60;
            else score = 40;
        }

        return Math.min(Math.max(score, 0), 100);
    }

    static calculateDefensiveMatchupScore(defenseRank: number, position: string, isBye: boolean = false): number {
        if (isBye) return 0;

        // Better matchup score: higher rank = easier matchup = higher score
        const matchupScore = Math.round(20 + ((defenseRank - 1) * 2.5));
        return Math.min(Math.max(matchupScore, 20), 100);
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const player1Id = searchParams.get('player1');
        const player2Id = searchParams.get('player2');
        const week = parseInt(searchParams.get('week') || '1');

        console.log('🔍 Comparison request:', { player1Id, player2Id, week });

        if (!player1Id || !player2Id) {
            return NextResponse.json({ error: 'player1 and player2 parameters are required' }, { status: 400 });
        }

        // Initialize data
        console.log('🔄 Initializing data...');
        await EnhancedPlayerComparison.initialize();

        // Get player info
        console.log('🔍 Looking up players...');
        const player1Info = await EnhancedPlayerComparison.getPlayerFromDatabase(player1Id);
        const player2Info = await EnhancedPlayerComparison.getPlayerFromDatabase(player2Id);

        if (!player1Info || !player2Info) {
            return NextResponse.json({
                error: 'Players not found in database',
                details: {
                    player1Found: !!player1Info,
                    player2Found: !!player2Info
                }
            }, { status: 404 });
        }

        // Generate player analyses
        console.log('🧠 Generating analyses...');
        const player1Analysis = await EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
            player1Info.name, player1Info.position, player1Info.team, week
        );
        const player2Analysis = await EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
            player2Info.name, player2Info.position, player2Info.team, week
        );

        // Enhanced comparison logic
        const winner = player1Analysis.scores.overall >= player2Analysis.scores.overall ? player1Analysis : player2Analysis;
        const loser = player1Analysis.scores.overall >= player2Analysis.scores.overall ? player2Analysis : player1Analysis;

        const scoreDiff = Math.abs(player1Analysis.scores.overall - player2Analysis.scores.overall);
        let confidence = 60 + Math.min(scoreDiff * 2, 35); // 60-95% confidence range

        const advantages: string[] = [];
        if (winner.scores.efficiency > loser.scores.efficiency + 5) {
            advantages.push(`${winner.playerName}: Superior efficiency metrics`);
        }
        if (winner.scores.defensiveMatchup > loser.scores.defensiveMatchup + 5) {
            advantages.push(`${winner.playerName}: Better defensive matchup`);
        }
        if (winner.redZoneData?.rzTouchdowns && winner.redZoneData.rzTouchdowns > (loser.redZoneData?.rzTouchdowns || 0)) {
            advantages.push(`${winner.playerName}: More red zone production`);
        }

        const reasoning: string[] = [];
        reasoning.push(`${winner.playerName} edges out ${loser.playerName} with an overall score of ${winner.scores.overall} vs ${loser.scores.overall}`);

        if (scoreDiff <= 5) {
            reasoning.push("This is a very close matchup with minimal separation");
        } else if (scoreDiff <= 10) {
            reasoning.push("Moderate advantage based on key metrics");
        } else {
            reasoning.push("Clear advantage across multiple categories");
        }

        // Add contextual reasoning
        if (winner.contextualInsights.some(insight => insight.includes('Positive coaching change'))) {
            reasoning.push("Benefits from positive coaching changes this season");
        }
        if (winner.contextualInsights.some(insight => insight.includes('Favorable defensive matchup'))) {
            reasoning.push("Faces a favorable defensive matchup this week");
        }

        // Enhanced comparison object
        const comparison: EnhancedComparisonDetails = {
            player1: player1Analysis.playerName,
            player2: player2Analysis.playerName,
            advantages,
            categories: {
                efficiency: player1Analysis.scores.efficiency >= player2Analysis.scores.efficiency ? 'player1' : 'player2',
                recentPerformance: player1Analysis.scores.recentPerformance >= player2Analysis.scores.recentPerformance ? 'player1' : 'player2',
                defensiveMatchup: player1Analysis.scores.defensiveMatchup >= player2Analysis.scores.defensiveMatchup ? 'player1' : 'player2'
            },
            overallWinner: winner === player1Analysis ? 'player1' : 'player2',
            confidence: Math.round(confidence),
            reasoning
        };

        // Enhanced AI analysis with OpenAI integration
        const usageText = winner.marketShare ?
            `about ${(winner.marketShare.tgtPercent || winner.marketShare.attPercent || 0).toFixed(0)}% of team's ${winner.position === 'RB' ? 'carries' : 'targets'} in 2024` :
            'a solid 2024 season';

        const matchupText = winner.weeklyOpponent ?
            `Facing ${winner.weeklyOpponent.opponent}'s defense (ranked ${winner.weeklyOpponent.defenseRank}) ${winner.weeklyOpponent.isHome ? 'at home' : 'on the road'}` :
            'The matchup looks favorable';

        const redZoneText = winner.redZoneData?.rzTouchdowns ?
            `Found paydirt ${winner.redZoneData.rzTouchdowns} times last season, showing solid red zone production.` :
            'Should have opportunities to contribute.';

        const confidenceText = scoreDiff <= 5 ? 'This one is a close call, but' : 'The data supports';

        // Generate full AI analysis using OpenAI
        let aiAnalysis = '';
        try {
            const contextData = {
                winner: {
                    name: winner.playerName,
                    position: winner.position,
                    team: winner.team,
                    opponent: winner.weeklyOpponent?.opponent || 'Unknown',
                    defenseRank: winner.weeklyOpponent?.defenseRank ?? 16,
                    isHome: !!winner.weeklyOpponent?.isHome,
                    targetShare: winner.marketShare?.tgtPercent?.toFixed(1) || '0.0',
                    yardageShare: winner.marketShare?.ydPercent?.toFixed(1) || '0.0',
                    touchdownShare: winner.marketShare?.tdPercent?.toFixed(1) || '0.0',
                    attemptShare: winner.marketShare?.attPercent?.toFixed(1) || '0.0',
                    redZoneTouchdowns: winner.redZoneData?.rzTouchdowns || 0,
                    redZoneAttempts: winner.redZoneData?.rzAttempts || 0,
                    redZoneEfficiency: winner.redZoneData ? (((winner.redZoneData.rzTouchdowns || 0) / Math.max(1, (winner.redZoneData.rzAttempts || 0))) * 100).toFixed(1) : '0.0',
                },
                loser: {
                    name: loser.playerName,
                    position: loser.position,
                    team: loser.team,
                    opponent: loser.weeklyOpponent?.opponent || 'Unknown',
                    defenseRank: loser.weeklyOpponent?.defenseRank ?? 16,
                    isHome: !!loser.weeklyOpponent?.isHome,
                    targetShare: loser.marketShare?.tgtPercent?.toFixed(1) || '0.0',
                    yardageShare: loser.marketShare?.ydPercent?.toFixed(1) || '0.0',
                    touchdownShare: loser.marketShare?.tdPercent?.toFixed(1) || '0.0',
                    attemptShare: loser.marketShare?.attPercent?.toFixed(1) || '0.0',
                    redZoneTouchdowns: loser.redZoneData?.rzTouchdowns || 0,
                    redZoneAttempts: loser.redZoneData?.rzAttempts || 0,
                    redZoneEfficiency: loser.redZoneData ? (((loser.redZoneData.rzTouchdowns || 0) / Math.max(1, (loser.redZoneData.rzAttempts || 0))) * 100).toFixed(1) : '0.0',
                },
                confidence: comparison.confidence,
                diff: winner.scores.overall - loser.scores.overall
            };

            const userPrompt = `
Statistical Context:
Winner: ${contextData.winner.name} (${contextData.winner.position}, ${contextData.winner.team}) vs ${contextData.winner.opponent} (def rank ${contextData.winner.defenseRank})
- Market Share: Targets ${contextData.winner.targetShare}%, Yards ${contextData.winner.yardageShare}%, TDs ${contextData.winner.touchdownShare}%${contextData.winner.position === 'RB' ? `, Attempts ${contextData.winner.attemptShare}%` : ''}
- Red Zone: ${contextData.winner.redZoneTouchdowns}/${contextData.winner.redZoneAttempts} (${contextData.winner.redZoneEfficiency}%)
- Home/Away: ${contextData.winner.isHome ? 'Home' : 'Away'}

Loser: ${contextData.loser.name} (${contextData.loser.position}, ${contextData.loser.team}) vs ${contextData.loser.opponent} (def rank ${contextData.loser.defenseRank})
- Market Share: Targets ${contextData.loser.targetShare}%, Yards ${contextData.loser.yardageShare}%, TDs ${contextData.loser.touchdownShare}%${contextData.loser.position === 'RB' ? `, Attempts ${contextData.loser.attemptShare}%` : ''}
- Red Zone: ${contextData.loser.redZoneTouchdowns}/${contextData.loser.redZoneAttempts} (${contextData.loser.redZoneEfficiency}%)
- Home/Away: ${contextData.loser.isHome ? 'Home' : 'Away'}

CONFIDENCE LEVEL: ${contextData.confidence}%
SCORE DIFFERENTIAL: ${contextData.diff} points

Writing Style Guidelines:
- Use conversational, natural language like "about 25%" not "25.1%"
- Specify team names (Jacksonville, Miami, etc.) not "previous team"
- Use football vernacular naturally: "finding paydirt", "signal callers", "play the match-ups"
- Include reality checks like "don't get lost in the sauce of 2024"
- Give specific defense context: "29th-ranked defense that gave up 24.5 fantasy points per game"
- 200-250 words, conversational but knowledgeable

CONFIDENCE INSTRUCTIONS:
- If confidence > 85%: Use decisive language like "clear choice", "obvious pick", "not even close", "easy decision"
- If confidence 70-85%: Use moderate language like "solid edge", "lean towards", "moderate advantage"
- If confidence < 70%: Use cautious language like "close call", "tough decision", "flip a coin"

Task: Write a start/sit analysis matching the confidence level. DO NOT say "close call" if confidence is above 85%.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                temperature: 0.6,
                max_tokens: 400,
                messages: [
                    {
                        role: "system",
                        content: "You are a seasoned, old-school American football coach. Stoic, direct, no fluff. Dry humor only. Speak like a coach in film room: analytical, but still conversational."
                    },
                    { role: "user", content: userPrompt }
                ]
            });

            aiAnalysis = completion.choices[0].message.content || `Start ${winner.playerName}. Coming off ${usageText}, ${winner.playerName} has the edge this week. ${matchupText}. ${redZoneText} ${confidenceText} going with ${winner.playerName} in Week ${week}.`;
        } catch (err: any) {
            console.error('OpenAI API error:', err);
            aiAnalysis = `Start ${winner.playerName}. Coming off ${usageText}, ${winner.playerName} has the edge this week. ${matchupText}. ${redZoneText} ${confidenceText} going with ${winner.playerName} in Week ${week}.`;
        }

        // Create category rankings that the frontend expects
        const categoryRankings = {
            efficiency: [...[player1Analysis, player2Analysis]].sort((a, b) => b.scores.efficiency - a.scores.efficiency),
            recentPerformance: [...[player1Analysis, player2Analysis]].sort((a, b) => b.scores.recentPerformance - a.scores.recentPerformance),
            defensiveMatchup: [...[player1Analysis, player2Analysis]].sort((a, b) => b.scores.defensiveMatchup - a.scores.defensiveMatchup),
        };

        // Full response structure that frontend expects
        const response = {
            players: [player1Analysis, player2Analysis].map(p => ({
                name: p.playerName,
                position: p.position,
                team: p.team,
                scores: p.scores,
                insights: p.contextualInsights.filter(insight => !insight.includes('draft value')),
                weeklyOpponent: p.weeklyOpponent,
                usage: p.position !== 'QB' ? (p.marketShare ? (p.marketShare.attPercent || p.marketShare.tgtPercent) : null) : null,
                redZoneTDs: p.redZoneData?.rzTouchdowns || null,
                derived: p.derived,
                projections: {
                    fantasyPoints: 0, // Will be enhanced later
                    week: week,
                    source: 'Enhanced Analysis',
                    details: null
                }
            })),
            headToHead: comparison,
            rankings: {
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
            defensiveMatchupDetails: [player1Analysis, player2Analysis].map(p => {
                const opponentAbbr = p.weeklyOpponent?.opponent;
                const defenseStats = opponentAbbr ? dataParser.getDefenseStats(opponentAbbr) : undefined;

                return {
                    player: p.playerName,
                    team: p.team,
                    opponent: opponentAbbr,
                    defenseRank: p.weeklyOpponent?.defenseRank,
                    home: p.weeklyOpponent?.isHome,
                    matchupScore: p.scores.defensiveMatchup,
                    defenseStats: defenseStats ? {
                        teamAbbr: opponentAbbr,
                        teamName: defenseStats.teamName || opponentAbbr,
                        pointsAllowed: defenseStats.pointsAllowed || 0,
                        totalYardsAllowed: defenseStats.totalYardsAllowed || 0,
                        yardsPerPlayAllowed: defenseStats.yardsPerPlayAllowed || 0,
                        passYardsAllowed: defenseStats.passYardsAllowed || 0,
                        passTDsAllowed: defenseStats.passTDsAllowed || 0,
                        netYardsPerAttemptAllowed: defenseStats.netYardsPerAttemptAllowed || 0,
                        rushYardsAllowed: defenseStats.rushYardsAllowed || 0,
                        rushTDsAllowed: defenseStats.rushTDsAllowed || 0,
                        yardsPerRushAllowed: defenseStats.yardsPerRushAllowed || 0,
                        scorePct: defenseStats.scorePct || 0,
                        turnoverPct: defenseStats.turnoverPct || 0,
                        exp: defenseStats.exp || 0,
                        passCompletionsAllowed: defenseStats.passCompletionsAllowed || 0,
                        passAttemptsAllowed: defenseStats.passAttemptsAllowed || 0,
                        rushAttemptsFaced: defenseStats.rushAttemptsFaced || 0
                    } : undefined
                };
            }),
            recommendation: {
                startPlayer: winner.playerName,
                confidence: comparison.confidence,
                reasoning: comparison.reasoning,
                aiAnalysis: aiAnalysis
            },
            analysis: aiAnalysis,
            metadata: {
                comparisonId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                week,
                winner: winner.playerName,
                confidence: comparison.confidence
            }
        };

        console.log('✅ Enhanced comparison complete');
        return NextResponse.json(response);

    } catch (error: any) {
        console.error('💥 Enhanced player comparison error:', error);
        return NextResponse.json({
            error: 'Failed to generate enhanced comparison',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
