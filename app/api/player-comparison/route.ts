// COMPLETE ENHANCED VERSION WITH SCHEDULE INTEGRATION

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
        } catch (error) {
            console.error('Database lookup error:', error);
            return null;
        }
    }

    static generateEnhancedPlayerAnalysis(playerName: string, position: string, team: string, week: number = 1): EnhancedPlayerAnalysis {
        const adpData = dataParser.getPlayerADP(playerName);
        const marketShare = dataParser.getMarketShareByPosition(playerName, position);
        const redZoneData = dataParser.getRedZoneData(playerName, position);
        const coachingChange = dataParser.getCoachingChange(team);
        const rookieAnalysis = dataParser.getRookieAnalysis(playerName);
        const expertAnalysis = dataParser.getExpertAnalysis(playerName);

        // Get current week opponent data using our new schedule system
        const matchup = dataParser.getWeekMatchup(team, week, position);
        const weeklyOpponent = {
            opponent: matchup.opponent,
            isHome: matchup.isHome,
            defenseRank: matchup.opponentDefenseRank || 16,
            isBye: matchup.isBye
        };

        const contextualInsights: string[] = [];

        // Updated category scoring system (removing redundant red zone efficiency)
        const scores = {
            efficiency: this.calculateEfficiencyScore(redZoneData, marketShare, position),
            recentPerformance: this.calculateRecentPerformanceScore(marketShare, position, redZoneData),
            defensiveMatchup: this.calculateDefensiveMatchupScore(weeklyOpponent.defenseRank, position, weeklyOpponent.isBye),
            overall: 0
        };

        // Position-specific weighting for overall score with Week 1 emphasis on defensive matchup
        if (position === 'QB') {
            if (week === 1) {
                // Week 1: Heavy emphasis on defensive matchup since we don't have current season data
                scores.overall = Math.round(
                    (scores.efficiency * 0.20) +        // Reduced from 35% to 20%
                    (scores.recentPerformance * 0.25) +  // Reduced from 35% to 25%
                    (scores.defensiveMatchup * 0.55)     // Increased from 30% to 55%
                );
            } else {
                // Later weeks: More balanced approach as we get current season data
                scores.overall = Math.round(
                    (scores.efficiency * 0.35) +
                    (scores.recentPerformance * 0.35) +
                    (scores.defensiveMatchup * 0.30)
                );
            }
        } else {
            // For skill positions, similar Week 1 emphasis
            if (week === 1) {
                scores.overall = Math.round(
                    (scores.efficiency * 0.20) +
                    (scores.recentPerformance * 0.25) +
                    (scores.defensiveMatchup * 0.55)
                );
            } else {
                scores.overall = Math.round(
                    (scores.efficiency * 0.30) +
                    (scores.recentPerformance * 0.40) +
                    (scores.defensiveMatchup * 0.30)
                );
            }
        }

        // Efficiency insights: derive from market share for non-QBs, fallback to score for QBs
        if (position !== 'QB' && marketShare) {
            const yardageShare = marketShare.ydPercent ?? 0;
            const touchdownShare = marketShare.tdPercent ?? 0;

            if (yardageShare >= 25 && touchdownShare >= 25) {
                contextualInsights.push('elite efficiency metrics');
            } else if (yardageShare >= 18 || touchdownShare >= 20) {
                contextualInsights.push('solid efficiency metrics');
            } else if (yardageShare <= 12 && touchdownShare <= 12) {
                contextualInsights.push('efficiency concerns');
            }
        } else {
            if (scores.efficiency >= 80) contextualInsights.push('elite efficiency metrics');
            else if (scores.efficiency >= 60) contextualInsights.push('solid efficiency metrics');
            else if (scores.efficiency <= 40) contextualInsights.push('efficiency concerns');
        }

        // Add position-specific usage insights (skip default note for QBs)
        if (position !== 'QB' && marketShare) {
            const usageTgt = marketShare.tgtPercent ?? 0;
            const usageAtt = marketShare.attPercent ?? 0;
            const usage = usageTgt || usageAtt; // WR/TE: tgtPercent; RB: attPercent

            if (usage >= 25) contextualInsights.push('significant usage rate');
            else if (usage >= 18) contextualInsights.push('moderate usage rate');
            else contextualInsights.push('limited usage opportunities');
        }

        // Add bye week context
        if (weeklyOpponent.isBye) {
            contextualInsights.push('on bye week');
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
            scores
        };
    }

    // New scoring methods for the updated categories
    static calculateEfficiencyScore(redZoneData: any, marketShare: any, position: string): number {
        let score = 50; // Base score

        if (position === 'QB') {
            // QBs: efficiency based on actual red zone TD conversion rate
            if (redZoneData) {
                const touchdowns = redZoneData.rzTouchdowns || 0;
                const attempts = redZoneData.rzAttempts || 1;
                const tdRate = (touchdowns / attempts) * 100;

                if (tdRate >= 60) score = 95; // Exceptional
                else if (tdRate >= 50) score = 90; // Very good
                else if (tdRate >= 40) score = 85; // Good
                else if (tdRate >= 30) score = 80; // Above average
                else if (tdRate >= 20) score = 75; // Average
                else if (tdRate >= 15) score = 70; // Below average
                else if (tdRate >= 10) score = 65; // Poor
                else score = 60; // Very poor
            }
        } else {
            // Non-QB (WR/TE/RB): incorporate 2024 market share yd% and td% as primary efficiency signals
            if (marketShare) {
                const yardageShare: number = marketShare.ydPercent ?? 0;
                const touchdownShare: number = marketShare.tdPercent ?? 0;

                // Yardage share contribution
                if (yardageShare >= 30) score += 25;
                else if (yardageShare >= 25) score += 20;
                else if (yardageShare >= 20) score += 15;
                else if (yardageShare >= 15) score += 10;

                // Touchdown share contribution
                if (touchdownShare >= 30) score += 25;
                else if (touchdownShare >= 25) score += 20;
                else if (touchdownShare >= 20) score += 15;
                else if (touchdownShare >= 15) score += 10;
            }

            // Red-zone conversion offers a smaller efficiency boost for non-QBs
            if (redZoneData) {
                const rzTdPercent: number = redZoneData.rzTdPercent || 0;
                if (rzTdPercent >= 15) score += 10;
                else if (rzTdPercent >= 10) score += 6;
                else if (rzTdPercent >= 5) score += 3;
            }
        }

        return Math.min(Math.max(score, 0), 100);
    }

    static calculateRecentPerformanceScore(marketShare: any, position: string, redZoneData?: any): number {
        let score = 50; // Base score

        if (position === 'QB') {
            // For QBs, use red zone efficiency and touchdown production as performance indicators
            if (redZoneData) {
                const touchdowns = redZoneData.rzTouchdowns || 0;
                const attempts = redZoneData.rzAttempts || 1;
                const tdRate = (touchdowns / attempts) * 100;

                // Base QB performance on touchdown production and efficiency
                if (touchdowns >= 30 && tdRate >= 50) score = 95; // Elite
                else if (touchdowns >= 25 && tdRate >= 45) score = 90; // Very good
                else if (touchdowns >= 20 && tdRate >= 40) score = 85; // Good
                else if (touchdowns >= 15 && tdRate >= 35) score = 80; // Above average
                else if (touchdowns >= 10 && tdRate >= 30) score = 75; // Average
                else if (touchdowns >= 5 && tdRate >= 25) score = 70; // Below average
                else score = 65; // Poor
            } else {
                score = 75; // Default QB score if no red zone data
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
        if (isBye) return 0; // No matchup on bye week

        // Map defense rank to matchup score: Rank 1 (best defense) ~20, Rank 32 (worst defense) ~98
        const matchupScore = Math.round(20 + ((defenseRank - 1) * 2.5));
        return Math.min(Math.max(matchupScore, 20), 100);
    }

    static calculateRedZoneEfficiencyScore(redZoneData: any, position: string): number {
        let score = 50; // Base score

        if (redZoneData) {
            const touchdowns = redZoneData.rzTouchdowns || 0;
            const attempts = redZoneData.rzAttempts || 1;
            const tdRate = (touchdowns / attempts) * 100;

            // More granular scoring based on actual efficiency
            if (tdRate >= 60) score = 95; // Exceptional efficiency
            else if (tdRate >= 50) score = 90; // Very good efficiency  
            else if (tdRate >= 40) score = 85; // Good efficiency
            else if (tdRate >= 30) score = 80; // Above average
            else if (tdRate >= 20) score = 75; // Average
            else if (tdRate >= 15) score = 70; // Below average
            else if (tdRate >= 10) score = 65; // Poor
            else if (tdRate >= 5) score = 60; // Very poor
            else score = 55; // Minimal efficiency
        }

        return Math.min(Math.max(score, 0), 100);
    }

    // Determine dynamic weights based on similarity of usage/efficiency between players (non-QB)
    private static getDynamicWeights(players: EnhancedPlayerAnalysis[]): { eff: number; recent: number; def: number } {
        const position = players[0]?.position || 'WR';
        // QBs: keep more balanced, matchup relevant but not dominant
        if (position === 'QB') {
            return { eff: 0.35, recent: 0.35, def: 0.30 };
        }

        // For WR/RB/TE, compute gaps across tgt%, td%, yd%
        const shares = players.map(p => ({
            tgt: p.marketShare?.tgtPercent ?? null,
            td: p.marketShare?.tdPercent ?? null,
            yd: p.marketShare?.ydPercent ?? null,
        }));

        const gap = (key: 'tgt' | 'td' | 'yd') => {
            const vals = shares.map(s => (s[key] ?? 0)).filter(v => typeof v === 'number');
            if (vals.length === 0) return 0;
            return Math.max(...vals) - Math.min(...vals);
        };

        const maxGap = Math.max(gap('tgt'), gap('td'), gap('yd'));

        // Thresholds: large gaps -> downweight matchup heavily
        if (maxGap >= 12) return { eff: 0.50, recent: 0.35, def: 0.15 };
        if (maxGap >= 8) return { eff: 0.45, recent: 0.35, def: 0.20 };
        if (maxGap >= 6) return { eff: 0.40, recent: 0.35, def: 0.25 };
        if (maxGap >= 4) return { eff: 0.35, recent: 0.35, def: 0.30 };
        // Very similar players -> matchup can matter more
        return { eff: 0.30, recent: 0.30, def: 0.40 };
    }

    static comparePlayersEnhanced(players: EnhancedPlayerAnalysis[]): EnhancedComparisonDetails {
        if (players.length < 2) {
            throw new Error('Need at least 2 players to compare');
        }

        const [player1, player2, player3] = players;

        // Recompute overall scores using dynamic weights based on similarity
        const weights = this.getDynamicWeights(players);
        players.forEach(p => {
            p.scores.overall = Math.round(
                (p.scores.efficiency * weights.eff) +
                (p.scores.recentPerformance * weights.recent) +
                (p.scores.defensiveMatchup * weights.def)
            );
        });

        // Updated categories (removed redundant red zone efficiency)
        const categories = {
            efficiency: this.determineWinner(players, 'efficiency'),
            recentPerformance: this.determineWinner(players, 'recentPerformance'),
            defensiveMatchup: this.determineWinner(players, 'defensiveMatchup')
        };

        const overallWinner = this.determineWinner(players, 'overall');

        // Enhanced confidence calculation
        const scores = players.map(p => p.scores.overall);
        const maxScore = Math.max(...scores);
        const secondMax = scores.sort((a, b) => b - a)[1] || 0;
        const scoreDifference = maxScore - secondMax;

        // Count category advantages for the winner
        const winnerIndex = overallWinner === 'player1' ? 0 : overallWinner === 'player2' ? 1 : 2;
        const winnerPlayer = players[winnerIndex];

        let categoryAdvantages = 0;
        Object.values(categories).forEach(winner => {
            if (winner === overallWinner) categoryAdvantages++;
        });

        // More dynamic confidence calculation
        let confidence = 50; // Base confidence

        // Score difference bonus (0-25 points)
        confidence += Math.min(scoreDifference * 2, 25);

        // Category dominance bonus adjusted for 3 categories (0-18 points)
        if (categoryAdvantages === 3) confidence += 18; // Sweep all categories
        else if (categoryAdvantages === 2) confidence += 12;
        else if (categoryAdvantages === 1) confidence += 6;

        // Cap confidence between 52% and 95%
        confidence = Math.min(95, Math.max(52, Math.round(confidence)));

        const advantages = this.generateAdvantages(players);
        const reasoning = this.generateEnhancedReasoning(players, categories, overallWinner, categoryAdvantages);

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
        const winnersCount = scores.filter(score => score === maxScore).length;

        if (winnersCount > 1) return 'tie';

        const winnerIndex = scores.indexOf(maxScore);
        return winnerIndex === 0 ? 'player1' : winnerIndex === 1 ? 'player2' : 'player3';
    }

    static generateAdvantages(players: EnhancedPlayerAnalysis[]): string[] {
        const advantages: string[] = [];

        players.forEach((player, index) => {
            const playerLabel = `player${index + 1}` as 'player1' | 'player2' | 'player3';

            if (player.scores.efficiency >= 80) {
                advantages.push(`${playerLabel}: Elite efficiency metrics`);
            }

            if (player.scores.defensiveMatchup >= 80) {
                advantages.push(`${playerLabel}: Favorable matchup this week`);
            }

            if (player.redZoneData?.rzTouchdowns >= 8) {
                advantages.push(`${playerLabel}: Strong red zone production`);
            }
        });

        return advantages;
    }

    static generateEnhancedReasoning(players: EnhancedPlayerAnalysis[], categories: any, winner: string, categoryAdvantages: number): string[] {
        const winnerPlayer = winner === 'player1' ? players[0] : winner === 'player2' ? players[1] : players[2];
        const reasoning: string[] = [];

        if (categoryAdvantages >= 3) {
            reasoning.push(`${winnerPlayer.playerName} has a clear edge in this matchup (${winnerPlayer.scores.overall}/100)`);
            reasoning.push(`Holds advantages in ${categoryAdvantages} of 3 key areas`);
        } else {
            reasoning.push(`${winnerPlayer.playerName} has a slight edge in this close matchup (${winnerPlayer.scores.overall}/100)`);
            reasoning.push(`Competitive across all categories with ${categoryAdvantages} slight advantages`);
        }

        // Add current week opponent context
        if (winnerPlayer.weeklyOpponent && !winnerPlayer.weeklyOpponent.isBye) {
            const homeAway = winnerPlayer.weeklyOpponent.isHome ? 'vs' : '@';
            reasoning.push(`Week 1: ${homeAway} ${winnerPlayer.weeklyOpponent.opponent} (Rank ${winnerPlayer.weeklyOpponent.defenseRank} defense vs ${winnerPlayer.position})`);
        } else if (winnerPlayer.weeklyOpponent?.isBye) {
            reasoning.push(`Week 1: On bye week - not available to start`);
        }

        // Add red zone context if available
        if (winnerPlayer.redZoneData && winnerPlayer.redZoneData.rzTouchdowns > 0) {
            reasoning.push(`Proven red zone producer with ${winnerPlayer.redZoneData.rzTouchdowns} TDs in 2024`);
        }

        return reasoning;
    }

    // Enhanced AI analysis with opponent context
    static async generateAIAnalysis(comparison: EnhancedComparisonDetails, players: EnhancedPlayerAnalysis[]): Promise<string> {
        const [player1, player2, player3] = players;
        const winner = comparison.overallWinner === 'player1' ? player1 : comparison.overallWinner === 'player2' ? player2 : player3;
        const loser = comparison.overallWinner === 'player1' ? player2 : player1;

        // Get matchup information
        const winnerMatchup = winner.weeklyOpponent;
        const loserMatchup = loser.weeklyOpponent;

        // Get red zone data for accurate analysis
        const winnerRedZone = winner.redZoneData;
        const loserRedZone = loser.redZoneData;

        let analysis = `**RECOMMENDED START: ${winner.playerName} (${winner.position}, ${winner.team})** `;

        // Add matchup context
        if (winnerMatchup && loserMatchup) {
            const winnerOpponent = winnerMatchup.opponent;
            const loserOpponent = loserMatchup.opponent;
            const winnerDefenseRank = winnerMatchup.defenseRank;
            const loserDefenseRank = loserMatchup.defenseRank;

            analysis += `${winner.playerName} faces the ${winnerOpponent} defense (ranked ${winnerDefenseRank} against ${winner.position}s in 2024), `;
            analysis += `while ${loser.playerName} faces the ${loserOpponent} defense (ranked ${loserDefenseRank}). `;
        }

        // Add performance context with non-QB efficiency details
        analysis += `${winner.playerName}'s Weekly Performance Score of ${winner.scores.overall} indicates ${winner.scores.overall >= 80 ? 'excellent' : winner.scores.overall >= 70 ? 'strong' : 'solid'} fantasy potential. `;
        if (winner.position !== 'QB' && winner.marketShare && loser.marketShare) {
            const wTeam = winner.team;
            const lTeam = loser.team;
            const wTgt = winner.marketShare.tgtPercent ?? 0;
            const lTgt = loser.marketShare.tgtPercent ?? 0;
            const wTd = winner.marketShare.tdPercent ?? 0;
            const lTd = loser.marketShare.tdPercent ?? 0;
            const wYd = winner.marketShare.ydPercent ?? 0;
            const lYd = loser.marketShare.ydPercent ?? 0;

            // Target share narrative (higher is better)
            if (wTgt > lTgt) {
                analysis += `${winner.playerName} accounts for ${wTgt.toFixed(1)}% of the ${wTeam} total targets (vs ${loser.playerName} ${lTgt.toFixed(1)}%), indicating a stronger opportunity share. `;
            } else if (wTgt < lTgt) {
                analysis += `${loser.playerName} holds a higher target share (${lTgt.toFixed(1)}% vs ${wTgt.toFixed(1)}%), which generally correlates with more weekly opportunities. `;
            } else {
                analysis += `Both players carry a similar target share (${wTgt.toFixed(1)}%). `;
            }

            // Touchdown share narrative (higher is better)
            if (wTd > lTd) {
                analysis += `${winner.playerName} also led in team receiving TD share (${wTd.toFixed(1)}% vs ${lTd.toFixed(1)}%), supporting touchdown upside. `;
            } else if (wTd < lTd) {
                analysis += `${loser.playerName} leads in receiving TD share (${lTd.toFixed(1)}% vs ${wTd.toFixed(1)}%), signaling stronger TD potential. `;
            } else {
                analysis += `Team receiving TD share is similar (${wTd.toFixed(1)}%). `;
            }

            // Yardage share mention
            if (wYd !== lYd) {
                const leader = wYd >= lYd ? winner.playerName : loser.playerName;
                analysis += `Yardage share favors ${leader} (${wYd.toFixed(1)}% vs ${lYd.toFixed(1)}%). `;
            } else {
                analysis += `Yardage share is virtually identical (${wYd.toFixed(1)}%). `;
            }
        }

        // Add red zone efficiency comparison
        if (winnerRedZone && loserRedZone) {
            const winnerTdRate = ((winnerRedZone.rzTouchdowns || 0) / (winnerRedZone.rzAttempts || 1)) * 100;
            const loserTdRate = ((loserRedZone.rzTouchdowns || 0) / (loserRedZone.rzAttempts || 1)) * 100;

            if (Math.abs(winnerTdRate - loserTdRate) < 0.1 && (winnerRedZone.rzAttempts || 0) === (loserRedZone.rzAttempts || 0) && (winnerRedZone.rzTouchdowns || 0) === (loserRedZone.rzTouchdowns || 0)) {
                analysis += `And check this out: both have matching red-zone efficiency — ${winnerRedZone.rzTouchdowns} TDs on ${winnerRedZone.rzAttempts} attempts (${winnerTdRate.toFixed(1)}%). `;
            } else {
                analysis += `${winner.playerName} converted ${winnerRedZone.rzTouchdowns} touchdowns on ${winnerRedZone.rzAttempts} red zone attempts (${winnerTdRate.toFixed(1)}% efficiency), `;
                analysis += `compared to ${loser.playerName}'s ${loserRedZone.rzTouchdowns} touchdowns on ${loserRedZone.rzAttempts} attempts (${loserTdRate.toFixed(1)}% efficiency). `;
            }
        }

        // Add confidence explanation
        const confidence = comparison.confidence;
        if (confidence >= 80) {
            analysis += `The ${confidence}% confidence reflects ${winner.playerName}'s clear advantages across multiple categories.`;
        } else if (confidence >= 65) {
            analysis += `The ${confidence}% confidence indicates a competitive matchup with ${winner.playerName} holding slight advantages.`;
        } else {
            analysis += `The ${confidence}% confidence reflects a very close matchup where either player could outperform.`;
        }

        return analysis;
    }
}

// Main API endpoint
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const player1Id = searchParams.get('player1');
        const player2Id = searchParams.get('player2');
        const player3Id = searchParams.get('player3');
        const week = parseInt(searchParams.get('week') || '1'); // Default to Week 1

        console.log('🔍 Comparison request:', { player1Id, player2Id, player3Id, week });

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
                player1Info.name, player1Info.position, player1Info.team, week
            );
            players.push(player1Analysis);

            const player2Analysis = EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
                player2Info.name, player2Info.position, player2Info.team, week
            );
            players.push(player2Analysis);

            if (player3Info) {
                const player3Analysis = EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
                    player3Info.name, player3Info.position, player3Info.team, week
                );
                players.push(player3Analysis);
            }

            console.log(`✅ Generated analysis for ${players.length} players`);

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

        // Create category rankings (updated categories). We removed overall rankings.
        const categoryRankings = {
            efficiency: [...players].sort((a, b) => b.scores.efficiency - a.scores.efficiency),
            recentPerformance: [...players].sort((a, b) => b.scores.recentPerformance - a.scores.recentPerformance),
            defensiveMatchup: [...players].sort((a, b) => b.scores.defensiveMatchup - a.scores.defensiveMatchup),
        };

        const response = {
            players: players.map(p => ({
                name: p.playerName,
                position: p.position,
                team: p.team,
                scores: p.scores,
                insights: p.contextualInsights.filter(insight => !insight.includes('draft value')), // Remove draft insights
                weeklyOpponent: p.weeklyOpponent,
                usage: p.position !== 'QB' ? (p.marketShare ? (p.marketShare.attPercent || p.marketShare.tgtPercent) : null) : null,
                redZoneTDs: p.redZoneData?.rzTouchdowns || null
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
            defensiveMatchupDetails: players.map(p => ({
                player: p.playerName,
                team: p.team,
                opponent: p.weeklyOpponent?.opponent,
                defenseRank: p.weeklyOpponent?.defenseRank,
                home: p.weeklyOpponent?.isHome,
                matchupScore: p.scores.defensiveMatchup,
                // attach parsed defense stats if available
                defenseStats: ((): any => {
                    try {
                        const stats = dataParser.getDefenseStats(p.weeklyOpponent?.opponent || '');
                        if (!stats) return undefined;
                        const { teamAbbr, teamName, games, pointsAllowed, totalYardsAllowed, yardsPerPlayAllowed, passCompletionsAllowed, passYardsAllowed, passTDsAllowed, netYardsPerAttemptAllowed, rushYardsAllowed, rushTDsAllowed, yardsPerRushAllowed, scorePct, turnoverPct, exp } = stats as any;
                        return { teamAbbr, teamName, games, pointsAllowed, totalYardsAllowed, yardsPerPlayAllowed, passCompletionsAllowed, passYardsAllowed, passTDsAllowed, netYardsPerAttemptAllowed, rushYardsAllowed, rushTDsAllowed, yardsPerRushAllowed, scorePct, turnoverPct, exp };
                    } catch { return undefined; }
                })()
            })),
            recommendation: {
                startPlayer: winnerPlayer?.playerName || 'Analysis Unavailable',
                confidence: comparison.confidence || 50,
                reasoning: comparison.reasoning || ['Analysis unavailable'],
                aiAnalysis: aiAnalysis || 'AI analysis unavailable',
                winner: comparison.overallWinner || 'tie'
            },
            enhanced: true,
            week: week,
            dataSourcesUsed: [
                'Sleeper Player Database',
                '2024 Season Performance Data',
                '2024 Defensive Rankings',
                `2025 Week ${week} Schedule`,
                'Red Zone Efficiency Analytics',
                'Market Share Analytics'
            ]
        };

        console.log('🎉 Comparison response ready:', {
            playersCount: response.players.length,
            winner: response.recommendation.startPlayer,
            confidence: response.recommendation.confidence,
            week: week
        });

        return NextResponse.json(response);

    } catch (error) {
        console.error('💥 Enhanced player comparison error:', error);
        return NextResponse.json({
            error: 'Failed to generate enhanced comparison',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
