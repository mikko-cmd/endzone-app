// COMPLETE ENHANCED VERSION WITH SCHEDULE INTEGRATION

import { NextResponse } from 'next/server';
import { dataParser } from '@/lib/dataParser';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { contextEngine } from '@/lib/contextEngine';
import { espnAPI } from './espnAPI';
import { NewsAnalyzer } from './newsAnalyzer';
import { playerMapping } from './playerMapping';

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
        redZoneEff?: string; // formatted "X / Y (Z%)"
        positionRank?: string; // e.g., WR9
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

    static async generateEnhancedPlayerAnalysis(playerName: string, position: string, team: string, week: number = 1): Promise<EnhancedPlayerAnalysis> {
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

        // Add contextual insights using the new engine
        const playerContext = await contextEngine.getPlayerContext(playerName, team, position);

        if (playerContext.transactions) {
            contextualInsights.push(playerContext.transactions.fantasyImpact);
        }

        if (playerContext.coachingImpact) {
            contextualInsights.push(playerContext.coachingImpact);
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

    static async comparePlayersEnhanced(players: EnhancedPlayerAnalysis[]): Promise<EnhancedComparisonDetails> {
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

        // Base confidence calculation
        let confidence = 50; // Base confidence

        // Score difference bonus (0-25 points)
        confidence += Math.min(scoreDifference * 2, 25);

        // Category dominance bonus adjusted for 3 categories (0-18 points)
        if (categoryAdvantages === 3) confidence += 18; // Sweep all categories
        else if (categoryAdvantages === 2) confidence += 12;
        else if (categoryAdvantages === 1) confidence += 6;

        // Matchup Certainty Weighting (#4) - ONLY ADDITION
        // When players are very similar, matchup becomes more important
        // When players have large gaps, efficiency/usage dominates
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

        let matchupCertainty = 1.0;
        if (maxGap >= 12) {
            // Large talent gap = high confidence regardless of matchup
            matchupCertainty = 1.2;
        } else if (maxGap <= 4) {
            // Very similar players = matchup dependent = lower confidence
            matchupCertainty = 0.85;
        }

        confidence *= matchupCertainty;

        // Cap confidence between 52% and 95%
        confidence = Math.min(95, Math.max(52, Math.round(confidence)));

        const advantages = this.generateAdvantages(players);
        const reasoning = await this.generateEnhancedReasoning(players, categories, overallWinner, categoryAdvantages);

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

    static async generateContextualFactors(winnerPlayer: EnhancedPlayerAnalysis, allPlayers: EnhancedPlayerAnalysis[]): Promise<string[]> {
        const factors: string[] = [];

        // Get enhanced context with ESPN data (will automatically look up ESPN ID from database)
        const context = await contextEngine.getEnhancedPlayerContext(
            winnerPlayer.playerName,
            winnerPlayer.team,
            winnerPlayer.position
        );

        // Use ESPN-powered contextual factors
        const espnFactors = contextEngine.getPlayerContextualFactors(context);
        factors.push(...espnFactors);

        // Add defensive matchup context only if significant
        if (winnerPlayer.weeklyOpponent && !winnerPlayer.weeklyOpponent.isBye) {
            const defenseContext = this.getDefensiveMatchupContext(winnerPlayer);
            if (defenseContext) {
                factors.push(defenseContext);
            }
        }

        // Red zone context only if player actually has advantage
        const loser = allPlayers.find(p => p.playerName !== winnerPlayer.playerName);
        if (winnerPlayer.redZoneData && loser?.redZoneData) {
            const winnerTDs = winnerPlayer.redZoneData.rzTouchdowns || 0;
            const loserTDs = loser.redZoneData.rzTouchdowns || 0;

            if (winnerTDs > loserTDs && winnerTDs > 2) {
                factors.push(`Superior red zone production (${winnerTDs} vs ${loserTDs} TDs in 2024)`);
            }
        }

        return factors.slice(0, 2); // Limit to 2 most relevant factors
    }

    static getSituationalContext(playerName: string, team: string): string | null {
        // Handle specific known situations - this could be expanded with a database
        const situationalMap: Record<string, string> = {
            'Jonnu Smith': 'New to Pittsburgh offense with Aaron Rodgers - chemistry and role still developing',
            'Calvin Ridley': 'Fresh start with Titans after productive return season',
            'Brian Robinson Jr.': 'Established role but competing with Austin Ekeler for passing work',
            'Saquon Barkley': 'First season in Philadelphia system after Giants departure',
            // Add more as needed...
        };

        return situationalMap[playerName] || null;
    }

    static getDefensiveMatchupContext(player: EnhancedPlayerAnalysis): string | null {
        const defenseRank = player.weeklyOpponent?.defenseRank || 16;
        const opponent = player.weeklyOpponent?.opponent || '';
        const position = player.position;

        // Only mention defense if it's notably good or bad
        if (defenseRank <= 8) {
            return `Faces tough ${opponent} defense (ranked ${defenseRank} vs ${position})`;
        } else if (defenseRank >= 25) {
            return `Favorable matchup vs ${opponent} defense (ranked ${defenseRank} vs ${position})`;
        }

        return null; // Don't mention mediocre defenses
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

    static async generateEnhancedReasoning(players: EnhancedPlayerAnalysis[], categories: any, winner: string, categoryAdvantages: number): Promise<string[]> {
        // Fix: Safely handle winner selection to prevent undefined access
        let winnerPlayer: EnhancedPlayerAnalysis;

        if (winner === 'player1') {
            winnerPlayer = players[0];
        } else if (winner === 'player2') {
            winnerPlayer = players[1];
        } else if (winner === 'player3' && players[2]) {
            winnerPlayer = players[2];
        } else {
            // Fallback to player1 if winner is invalid or player3 doesn't exist
            winnerPlayer = players[0];
        }

        // Additional safety check
        if (!winnerPlayer || !winnerPlayer.playerName) {
            console.error('Winner player is undefined or missing playerName:', { winner, playersLength: players.length });
            return ['Analysis unavailable due to missing player data'];
        }

        const reasoning: string[] = [];

        if (categoryAdvantages >= 3) {
            reasoning.push(`${winnerPlayer.playerName} has the clear edge in this matchup`);
            reasoning.push(`Dominates in ${categoryAdvantages} of 3 key areas`);
        } else {
            reasoning.push(`${winnerPlayer.playerName} has the slight edge in this close comparison`);

            // Instead of generic "competitive across categories", add specific context
            // Check if defensive matchup was the deciding factor
            const defenseDecided = Math.abs(players[0].scores.defensiveMatchup - players[1].scores.defensiveMatchup) >= 5;
            if (defenseDecided && categoryAdvantages <= 1) {
                reasoning.push(`Tight matchup decided primarily by defensive matchup favorability`);
            } else {
                reasoning.push(`Very close across statistical categories with minimal separation`);
            }
        }

        // Add contextual factors instead of just opponent info
        const contextualFactors = await this.generateContextualFactors(winnerPlayer, players);
        reasoning.push(...contextualFactors);

        return reasoning;
    }

    static buildCoachismsContext(comparison: EnhancedComparisonDetails, players: EnhancedPlayerAnalysis[]) {
        const [p1, p2, p3] = players;
        const winnerKey = comparison.overallWinner;
        const scores = players.map(p => p.scores.overall);
        const maxScore = Math.max(...scores);
        const sorted = [...scores].sort((a, b) => b - a);
        const diff = (sorted[0] ?? 0) - (sorted[1] ?? 0);
        const runaway = diff >= 12;

        const winner = winnerKey === 'player1' ? p1 :
            winnerKey === 'player2' ? p2 :
                winnerKey === 'player3' ? (p3 ?? p1) : p1;

        const loser = winnerKey === 'player1' ? p2 :
            winnerKey === 'player2' ? p1 :
                winnerKey === 'player3' ? (p1 ?? p2) : p2;

        // Check for specific situations
        const winnerIsStud = winner.scores.overall >= 85;
        const isCloseCall = !runaway && Math.abs(winner.scores.overall - loser.scores.overall) <= 8;
        const winnerHasVolume = (winner.marketShare?.attPercent || winner.marketShare?.tgtPercent || 0) >= 20;
        const toughDefense = (winner.weeklyOpponent?.defenseRank || 16) <= 8;
        const weatherConcern = false; // Could add weather data later

        const coachisms: string[] = [];

        // Runaway winners (clear advantage)
        if (runaway && winnerIsStud) {
            coachisms.push("Trust your studs.");
            coachisms.push("Don't get cute.");
            coachisms.push("Never sit talent for a hunch.");
        } else if (runaway) {
            coachisms.push("Opportunities > Names.");
            coachisms.push("Chase volume, not touchdowns.");
            coachisms.push("Don't overthink it.");
        }

        // Close calls
        if (isCloseCall) {
            coachisms.push("Floor wins weeks, ceiling wins championships.");
            coachisms.push("Trust your gut.");
            coachisms.push("Dance with the one that brought you.");
            coachisms.push("Good teams feed their stars.");
        }

        // Volume-based decisions
        if (winnerHasVolume) {
            coachisms.push("Targets are king.");
            coachisms.push("Chase volume, not touchdowns.");
            coachisms.push("You can't score from the bench.");
        }

        // Tough matchups but still starting the player
        if (toughDefense && winnerIsStud) {
            coachisms.push("Don't bench elite players because of a matchup scare.");
            coachisms.push("Start your studs in bad weather… unless they throw the ball.");
        }

        // Generic backup options
        if (coachisms.length === 0) {
            coachisms.push("The best ability is availability.");
            coachisms.push("Play the waiver wire like it owes you money.");
            coachisms.push("Luck is just preparation meeting opportunity… and a broken tackle.");
        }

        // De-dup and keep it short
        const unique = Array.from(new Set(coachisms)).slice(0, 4);

        return { coachisms: unique, winner, loser, runaway };
    }

    static async generateAIAnalysis(
        comparison: EnhancedComparisonDetails,
        players: EnhancedPlayerAnalysis[],
        opts?: { voice?: 'coach_old_school' | 'default' }
    ): Promise<string> {
        const voice = opts?.voice ?? 'coach_old_school';

        const [player1, player2, player3] = players;

        // pick winner/loser safely (keeps your prior logic)
        let winner: EnhancedPlayerAnalysis;
        let loser: EnhancedPlayerAnalysis;
        if (comparison.overallWinner === 'player1') { winner = player1; loser = player2; }
        else if (comparison.overallWinner === 'player2') { winner = player2; loser = player1; }
        else if (comparison.overallWinner === 'player3' && player3) { winner = player3; loser = player1; }
        else if (comparison.overallWinner === 'tie') {
            winner = player1.scores.overall >= player2.scores.overall ? player1 : player2;
            loser = player1.scores.overall >= player2.scores.overall ? player2 : player1;
        } else { winner = player1; loser = player2; }

        if (!winner || !loser) return 'Analysis unavailable due to missing player data';

        const wM = winner.weeklyOpponent, lM = loser.weeklyOpponent;
        const wRZ = winner.redZoneData, lRZ = loser.redZoneData;
        const wMS = winner.marketShare, lMS = loser.marketShare;

        // Enhanced context data with more statistical information and team context
        const contextData = {
            winner: {
                name: winner.playerName,
                position: winner.position,
                team: winner.team,
                opponent: wM?.opponent || 'Unknown',
                defenseRank: wM?.defenseRank ?? 16,
                isHome: !!wM?.isHome,
                // Red zone stats
                redZoneTouchdowns: wRZ?.rzTouchdowns || 0,
                redZoneAttempts: wRZ?.rzAttempts || 0,
                redZoneEfficiency: wRZ ? (((wRZ.rzTouchdowns || 0) / Math.max(1, (wRZ.rzAttempts || 0))) * 100).toFixed(1) : '0.0',
                // Market share stats  
                targetShare: wMS?.tgtPercent?.toFixed(1) || '0.0',
                yardageShare: wMS?.ydPercent?.toFixed(1) || '0.0',
                touchdownShare: wMS?.tdPercent?.toFixed(1) || '0.0',
                attemptShare: wMS?.attPercent?.toFixed(1) || '0.0', // For RBs
                // Team context flags
                hasTeamChange: winner.contextualInsights.some(insight =>
                    insight.includes('previous team') || insight.includes('New team') || insight.includes('First season')
                ),
                // Scoring data
                efficiencyScore: winner.scores.efficiency,
                recentPerformanceScore: winner.scores.recentPerformance,
                matchupScore: winner.scores.defensiveMatchup
            },
            loser: {
                name: loser.playerName,
                position: loser.position,
                team: loser.team,
                opponent: lM?.opponent || 'Unknown',
                defenseRank: lM?.defenseRank ?? 16,
                isHome: !!lM?.isHome,
                // Red zone stats
                redZoneTouchdowns: lRZ?.rzTouchdowns || 0,
                redZoneAttempts: lRZ?.rzAttempts || 0,
                redZoneEfficiency: lRZ ? (((lRZ.rzTouchdowns || 0) / Math.max(1, (lRZ.rzAttempts || 0))) * 100).toFixed(1) : '0.0',
                // Market share stats
                targetShare: lMS?.tgtPercent?.toFixed(1) || '0.0',
                yardageShare: lMS?.ydPercent?.toFixed(1) || '0.0',
                touchdownShare: lMS?.tdPercent?.toFixed(1) || '0.0',
                attemptShare: lMS?.attPercent?.toFixed(1) || '0.0', // For RBs
                // Team context flags
                hasTeamChange: loser.contextualInsights.some(insight =>
                    insight.includes('previous team') || insight.includes('New team') || insight.includes('First season')
                ),
                // Scoring data
                efficiencyScore: loser.scores.efficiency,
                recentPerformanceScore: loser.scores.recentPerformance,
                matchupScore: loser.scores.defensiveMatchup
            },
            confidence: comparison.confidence,
            diff: winner.scores.overall - loser.scores.overall
        };

        const formatTeamContext = (playerData: any) => {
            if (playerData.statsFromPreviousTeam && playerData.previousTeam) {
                return `with ${playerData.previousTeam} in 2024`;
            }
            return `with ${playerData.team} in 2024`;
        };

        const userPrompt = `
Statistical Context:
Winner: ${contextData.winner.name} (${contextData.winner.position}, ${contextData.winner.team}) vs ${contextData.winner.opponent} (def rank ${contextData.winner.defenseRank})
- Market Share: Targets ${contextData.winner.targetShare}%, Yards ${contextData.winner.yardageShare}%, TDs ${contextData.winner.touchdownShare}%${contextData.winner.position === 'RB' ? `, Attempts ${contextData.winner.attemptShare}%` : ''}
- Red Zone: ${contextData.winner.redZoneTouchdowns}/${contextData.winner.redZoneAttempts} (${contextData.winner.redZoneEfficiency}%)
- Team Status: ${contextData.winner.hasTeamChange ? 'NEW TEAM (stats from previous team)' : 'Same team as 2024'}
- Home/Away: ${contextData.winner.isHome ? 'Home' : 'Away'}

Loser: ${contextData.loser.name} (${contextData.loser.position}, ${contextData.loser.team}) vs ${contextData.loser.opponent} (def rank ${contextData.loser.defenseRank})
- Market Share: Targets ${contextData.loser.targetShare}%, Yards ${contextData.loser.yardageShare}%, TDs ${contextData.loser.touchdownShare}%${contextData.loser.position === 'RB' ? `, Attempts ${contextData.loser.attemptShare}%` : ''}
- Red Zone: ${contextData.loser.redZoneTouchdowns}/${contextData.loser.redZoneAttempts} (${contextData.loser.redZoneEfficiency}%)
- Team Status: ${contextData.loser.hasTeamChange ? 'NEW TEAM (stats from previous team)' : 'Same team as 2024'}
- Home/Away: ${contextData.loser.isHome ? 'Home' : 'Away'}

Writing Style Guidelines:
- Use conversational, natural language like "about 25%" not "25.1%"
- Specify team names (Jacksonville, Miami, etc.) not "previous team"
- For players on new teams, acknowledge the uncertainty: "it remains to be seen if production will carry over"
- Use football vernacular naturally: "finding paydirt", "signal callers", "play the match-ups"
- Include reality checks like "don't get lost in the sauce of 2024"
- Give specific defense context: "29th-ranked defense that gave up 24.5 fantasy points per game"
- End with confidence level but acknowledge when it's a "close call"

Task:
Write a start/sit analysis in a conversational, knowledgeable tone. 

IMPORTANT RULES:
- For RBs: Focus on rushing dominance (attempts %, yards %, TDs %). Only mention receiving stats if significant (>15% target share)
- Verify claims: If calling someone "main target", ensure they led the team in targets
- Team continuity: Only mention team status if a player changed teams. Don't mention "same team" unnecessarily
- Use accurate superlatives: "workhorse", "main target", "go-to guy" should be data-backed

For players on new teams, address the uncertainty while using last season's stats for context. Use natural percentages, specific team names, and acknowledge the challenges of projecting new team roles. Use natural percentages, specific team names, and acknowledge the challenges of projecting new team roles.`;

        // Coachisms context - but limit usage
        const { coachisms, runaway } = this.buildCoachismsContext(comparison, players);

        // Persona + style scaffolding
        const systemCoach = (voice === 'coach_old_school')
            ? `You are a seasoned, old-school American football coach. Stoic, direct, no fluff. Dry humor only.
Speak like a coach in film room: analytical, but still conversational. dont be afraid to extend sentences with commas and semicolons but dont overdo it. Avoid cheerleading.
No "buddy", no emojis, no condescension.`
            : `You are a concise fantasy analyst.`;

        const styleGuide = `
Style & Tone:
- Start with the decision ("Go with X" or "Start X")
- Use conversational percentages ("about 25% of the teams targets" not "25.1% tgt")
- Specify team names (Jacksonville, Miami) not "previous team"
- Acknowledge new team uncertainty naturally
- Use football vernacular: "finding paydirt", "signal callers", "match-ups"
- Include reality checks: "don't get lost in the sauce", "gotta do what we can with what we got"
- End with confidence but acknowledge close calls
- 200-250 words, conversational but knowledgeable
- One natural coachism if it fits: ${coachisms.slice(0, 2).join(', ')}`;

        // Updated example to show data-first approach
        const microExample = `
Example tone:
"Engram was Jacksonville's go-to guy in 2024, seeing about 25% of the team's targets. Smith wasn't far behind in Miami, with about 20% of the target share. As these two are now with new teams (Engram in Denver and Smith in Pittsburgh) it remains to be seen if their production will carry over. The most compelling argument for Smith is his habit of finding paydirt. Jonnu caught 7 touchdowns in the redzone last season, which ranks 3rd behind only George Kittle and Mark Andrews. 

But lets not get lost in the sauce of 2024. These two tight-ends are on new offenses with new signal callers and play callers. Until we know for sure what their role will be, we gotta do what we can with what we got.

Lets look at the opposing defenses: Engram's facing Tennessee's 29th-ranked defense that gave up an average of 24.5 fantasy points per game to opposing tight ends. Smith's up against the Jets, whose defense ranks 16th, allowing a stiffer 18.7 points. Factoring in last seasons stats, I say go with Engram. He's at home, facing a weaker defense, and sometimes you just gotta play the match-ups. Engram's got the opportunity to shine in Denver, but this one is definitely a  close call."`;

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                temperature: 0.6,
                max_tokens: 400,
                messages: [
                    { role: "system", content: systemCoach },
                    { role: "system", content: styleGuide },
                    { role: "system", content: microExample },
                    { role: "user", content: userPrompt }
                ]
            });

            return completion.choices[0].message.content || 'Analysis unavailable';
        } catch (err: any) {
            console.error('OpenAI API error:', err);
            // Updated fallback with more data focus
            if (comparison.confidence >= 60) {
                return `Start ${contextData.winner.name}. He commands ${contextData.winner.targetShare}% target share vs ${contextData.loser.targetShare}% for ${contextData.loser.name}, plus ${contextData.winner.redZoneEfficiency}% red zone efficiency. Defense rank ${contextData.winner.defenseRank} vs ${contextData.loser.defenseRank} - the numbers support the pick.`;
            }
            return `Lean ${contextData.winner.name}. Slight edge in market share (${contextData.winner.targetShare}% vs ${contextData.loser.targetShare}%) and matchup (rank ${contextData.winner.defenseRank} vs ${contextData.loser.defenseRank}). Close call backed by the data.`;
        }
    }
}

// Main API endpoint - MOVED OUTSIDE THE CLASS
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const player1Id = searchParams.get('player1');
        const player2Id = searchParams.get('player2');
        const player3Id = searchParams.get('player3');
        const week = parseInt(searchParams.get('week') || '1');
        const voice = (searchParams.get('voice') as 'coach_old_school' | 'default') || 'coach_old_school'; // ADD THIS LINE

        console.log('🔍 Comparison request:', { player1Id, player2Id, player3Id, week, voice }); // Update log

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
            const player1Analysis = await EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
                player1Info.name, player1Info.position, player1Info.team, week
            );
            players.push(player1Analysis);

            const player2Analysis = await EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
                player2Info.name, player2Info.position, player2Info.team, week
            );
            players.push(player2Analysis);

            if (player3Info) {
                const player3Analysis = await EnhancedPlayerComparison.generateEnhancedPlayerAnalysis(
                    player3Info.name, player3Info.position, player3Info.team, week
                );
                players.push(player3Analysis);
            }

            console.log(`✅ Generated analysis for ${players.length} players`);

        } catch (analysisError: any) {
            console.error('❌ Error generating player analysis:', analysisError);
            return NextResponse.json({
                error: 'Failed to generate player analysis',
                details: analysisError instanceof Error ? analysisError.message : 'Unknown analysis error'
            }, { status: 500 });
        }

        // Generate enhanced comparison
        console.log('⚖️ Generating comparison...');
        const comparison = await EnhancedPlayerComparison.comparePlayersEnhanced(players);
        console.log('✅ Comparison result:', {
            winner: comparison.overallWinner,
            confidence: comparison.confidence,
            categories: comparison.categories
        });

        // Generate AI analysis
        console.log('🤖 Generating AI analysis...');
        const aiAnalysis = await EnhancedPlayerComparison.generateAIAnalysis(comparison, players, { voice }); // ADD { voice }
        console.log('✅ AI analysis generated:', aiAnalysis.substring(0, 100) + '...');

        const winnerPlayer = comparison.overallWinner === 'player1' ? players[0] :
            comparison.overallWinner === 'player2' ? players[1] :
                comparison.overallWinner === 'player3' && players[2] ? players[2] : players[0];

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
                redZoneTDs: p.redZoneData?.rzTouchdowns || null,
                derived: p.derived
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
            defensiveMatchupDetails: players.map(p => {
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
                        teamName: defenseStats.teamName,
                        pointsAllowed: defenseStats.pointsAllowed,
                        totalYardsAllowed: defenseStats.totalYardsAllowed,
                        yardsPerPlayAllowed: defenseStats.yardsPerPlayAllowed,
                        passYardsAllowed: defenseStats.passYardsAllowed,
                        passTDsAllowed: defenseStats.passTDsAllowed,
                        netYardsPerAttemptAllowed: defenseStats.netYardsPerAttemptAllowed,
                        rushYardsAllowed: defenseStats.rushYardsAllowed,
                        rushTDsAllowed: defenseStats.rushTDsAllowed,
                        yardsPerRushAllowed: defenseStats.yardsPerRushAllowed,
                        scorePct: defenseStats.scorePct,
                        turnoverPct: defenseStats.turnoverPct,
                        exp: defenseStats.exp,
                        // Add the specific stats the frontend needs for the table
                        passCompletionsAllowed: defenseStats.passCompletionsAllowed,
                        passAttemptsAllowed: defenseStats.passAttemptsAllowed,
                        rushAttemptsFaced: defenseStats.rushAttemptsFaced
                    } : undefined
                };
            }),
            // ADD THIS: Frontend expects recommendation object
            recommendation: {
                startPlayer: winnerPlayer?.playerName || 'Analysis Unavailable',
                confidence: comparison.confidence,
                reasoning: comparison.reasoning || [],
                aiAnalysis: aiAnalysis
            },
            analysis: aiAnalysis,
            metadata: {
                comparisonId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                week,
                winner: winnerPlayer?.playerName || 'Analysis Unavailable',
                confidence: comparison.confidence
            }
        };

        console.log('🎉 Comparison response ready:', {
            playersCount: players.length,
            winner: response.metadata.winner,
            confidence: response.metadata.confidence,
            week
        });

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('💥 Enhanced player comparison error:', error);
        return NextResponse.json({
            error: 'Failed to generate enhanced comparison',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
