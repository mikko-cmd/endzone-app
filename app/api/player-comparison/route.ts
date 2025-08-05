import { NextResponse } from 'next/server';
import { dataAggregator } from '@/lib/dataAggregator';
import OpenAI from 'openai';
import { espnAdvancedStats } from '@/lib/espnAdvancedStats';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface PlayerAnalysis {
    playerId: string;
    playerName: string;
    position: string;
    team: string;
    seasonStats: any;
    recentGames: any[];
    injuries: any[];
    matchup: any;
    projections: any;
    qbStatus: any;
    defenseRanking?: any;
    weatherImpact?: any;
    espnAdvanced?: any; // Add this field
}

interface ComparisonDetails {
    player1: string;
    player2: string;
    advantages: {
        player1: string[];
        player2: string[];
    };
    categories: {
        matchup: 'player1' | 'player2' | 'tie';
        form: 'player1' | 'player2' | 'tie';
        ceiling: 'player1' | 'player2' | 'tie';
        floor: 'player1' | 'player2' | 'tie';
        weather: 'player1' | 'player2' | 'tie';
    };
    overallWinner: 'player1' | 'player2' | 'tie';
    confidence: number;
}

interface PlayerRanking {
    playerId: string;
    playerName: string;
    score: number;
    rank: number;
    reasoning: string[];
}

interface ComparisonResult {
    players: PlayerAnalysis[];
    headToHead: {
        player1VsPlayer2: ComparisonDetails;
        player1VsPlayer3?: ComparisonDetails;
        player2VsPlayer3?: ComparisonDetails;
    };
    rankings: {
        overall: PlayerRanking[];
        byCategory: {
            matchup: PlayerRanking[];
            form: PlayerRanking[];
            weather: PlayerRanking[];
            ceiling: PlayerRanking[];
            floor: PlayerRanking[];
        };
    };
    recommendation: {
        startPlayer: string;
        confidence: number;
        reasoning: string[];
        aiAnalysis: string;
    };
}

// Fetch defense rankings for a team
async function getDefenseRanking(team: string) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/defense-rankings`);
        if (!response.ok) return null;

        const data = await response.json();
        return data.rankings.find((ranking: any) => ranking.team === team);
    } catch (error) {
        console.error('Failed to fetch defense rankings:', error);
        return null;
    }
}

// Fetch weather impact for a team's location
async function getWeatherImpact(team: string) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/weather/${team}`);
        if (!response.ok) return null;

        const data = await response.json();
        return {
            severity: data.severity,
            impactAnalysis: data.impactAnalysis,
            recommendations: data.recommendations
        };
    } catch (error) {
        console.error('Failed to fetch weather impact:', error);
        return null;
    }
}

// Enhanced player analysis with defense and weather data
async function getEnhancedPlayerAnalysis(playerId: string, week?: number): Promise<PlayerAnalysis> {
    // Get base player analysis
    const baseAnalysis = await dataAggregator.aggregatePlayerData(playerId, week);

    // Get defense ranking for opponent
    const defenseRanking = await getDefenseRanking(baseAnalysis.matchup?.opponent || baseAnalysis.team);

    // Get weather impact for player's team
    const weatherImpact = await getWeatherImpact(baseAnalysis.team);

    // Add ESPN advanced stats for WRs/TEs only
    let espnAdvanced = null;
    if (baseAnalysis.position === 'WR' || baseAnalysis.position === 'TE') {
        // You'll need to map Sleeper ID to ESPN ID (create a mapping)
        // For now, we'll just fetch for all WR/TEs if available
        const espnPlayerId = await mapSleeperToESPN(playerId);
        if (espnPlayerId) {
            espnAdvanced = await espnAdvancedStats.getAdvancedReceivingStats(espnPlayerId);
        }
    }

    return {
        playerId: baseAnalysis.playerId,
        playerName: baseAnalysis.playerName,
        position: baseAnalysis.position,
        team: baseAnalysis.team,
        seasonStats: baseAnalysis.seasonStats,
        recentGames: baseAnalysis.recentGames,
        injuries: baseAnalysis.injuries,
        matchup: baseAnalysis.matchup,
        projections: baseAnalysis.projections,
        qbStatus: baseAnalysis.qbStatus,
        defenseRanking,
        weatherImpact,
        espnAdvanced // Add this new field
    };
}

// Compare two players across different categories
function comparePlayersHeadToHead(player1: PlayerAnalysis, player2: PlayerAnalysis): ComparisonDetails {
    const advantages = { player1: [], player2: [] };
    const categories = {
        matchup: 'tie' as 'player1' | 'player2' | 'tie',
        form: 'tie' as 'player1' | 'player2' | 'tie',
        ceiling: 'tie' as 'player1' | 'player2' | 'tie',
        floor: 'tie' as 'player1' | 'player2' | 'tie',
        weather: 'tie' as 'player1' | 'player2' | 'tie'
    };

    // Matchup Analysis (Defense Rankings)
    if (player1.defenseRanking && player2.defenseRanking) {
        const pos = player1.position.toLowerCase();
        const p1DefenseRank = player1.defenseRanking[pos]?.rank || 16;
        const p2DefenseRank = player2.defenseRanking[pos]?.rank || 16;

        if (p1DefenseRank > p2DefenseRank + 2) { // Higher rank = worse defense = better for player
            categories.matchup = 'player1';
            advantages.player1.push(`Better matchup (defense ranks ${p1DefenseRank}th vs ${pos.toUpperCase()}s)`);
        } else if (p2DefenseRank > p1DefenseRank + 2) {
            categories.matchup = 'player2';
            advantages.player2.push(`Better matchup (defense ranks ${p2DefenseRank}th vs ${pos.toUpperCase()}s)`);
        }
    }

    // Recent Form Analysis (Last 3 games average)
    const p1RecentAvg = player1.recentGames.slice(0, 3).reduce((sum, game) => sum + (game.fantasy_points || 0), 0) / Math.max(1, player1.recentGames.slice(0, 3).length);
    const p2RecentAvg = player2.recentGames.slice(0, 3).reduce((sum, game) => sum + (game.fantasy_points || 0), 0) / Math.max(1, player2.recentGames.slice(0, 3).length);

    if (p1RecentAvg > p2RecentAvg + 2) {
        categories.form = 'player1';
        advantages.player1.push(`Better recent form (${p1RecentAvg.toFixed(1)} vs ${p2RecentAvg.toFixed(1)} fantasy points)`);
    } else if (p2RecentAvg > p1RecentAvg + 2) {
        categories.form = 'player2';
        advantages.player2.push(`Better recent form (${p2RecentAvg.toFixed(1)} vs ${p1RecentAvg.toFixed(1)} fantasy points)`);
    }

    // Season Stats Comparison (Ceiling - best game)
    const p1BestGame = Math.max(...player1.recentGames.map(g => g.fantasy_points || 0));
    const p2BestGame = Math.max(...player2.recentGames.map(g => g.fantasy_points || 0));

    if (p1BestGame > p2BestGame + 3) {
        categories.ceiling = 'player1';
        advantages.player1.push(`Higher ceiling (${p1BestGame.toFixed(1)} point best game)`);
    } else if (p2BestGame > p1BestGame + 3) {
        categories.ceiling = 'player2';
        advantages.player2.push(`Higher ceiling (${p2BestGame.toFixed(1)} point best game)`);
    }

    // Floor Analysis (worst game in recent stretch)
    const p1WorstGame = Math.min(...player1.recentGames.map(g => g.fantasy_points || 0));
    const p2WorstGame = Math.min(...player2.recentGames.map(g => g.fantasy_points || 0));

    if (p1WorstGame > p2WorstGame + 2) {
        categories.floor = 'player1';
        advantages.player1.push(`Higher floor (${p1WorstGame.toFixed(1)} point worst game)`);
    } else if (p2WorstGame > p1WorstGame + 2) {
        categories.floor = 'player2';
        advantages.player2.push(`Higher floor (${p2WorstGame.toFixed(1)} point worst game)`);
    }

    // Weather Impact Analysis
    if (player1.weatherImpact && player2.weatherImpact) {
        const p1Impact = getWeatherScore(player1.weatherImpact, player1.position);
        const p2Impact = getWeatherScore(player2.weatherImpact, player2.position);

        if (p1Impact > p2Impact) {
            categories.weather = 'player1';
            advantages.player1.push(`Better weather conditions (${player1.weatherImpact.severity} conditions)`);
        } else if (p2Impact > p1Impact) {
            categories.weather = 'player2';
            advantages.player2.push(`Better weather conditions (${player2.weatherImpact.severity} conditions)`);
        }
    }

    // Overall winner based on category wins
    const p1Wins = Object.values(categories).filter(winner => winner === 'player1').length;
    const p2Wins = Object.values(categories).filter(winner => winner === 'player2').length;

    let overallWinner: 'player1' | 'player2' | 'tie' = 'tie';
    let confidence = 50;

    if (p1Wins > p2Wins) {
        overallWinner = 'player1';
        confidence = 50 + (p1Wins - p2Wins) * 15;
    } else if (p2Wins > p1Wins) {
        overallWinner = 'player2';
        confidence = 50 + (p2Wins - p1Wins) * 15;
    }

    return {
        player1: player1.playerName,
        player2: player2.playerName,
        advantages,
        categories,
        overallWinner,
        confidence: Math.min(confidence, 85) // Cap confidence at 85%
    };
}

// Calculate weather impact score for a position
function getWeatherScore(weather: any, position: string): number {
    let score = 50; // Neutral baseline

    const { severity, impactAnalysis } = weather;

    // Position-specific weather impact
    if (position === 'QB') {
        if (impactAnalysis.passingImpact === 'SEVERE') score -= 20;
        else if (impactAnalysis.passingImpact === 'HIGH') score -= 15;
        else if (impactAnalysis.passingImpact === 'MODERATE') score -= 10;
    } else if (position === 'RB') {
        if (impactAnalysis.gameScript === 'RUN_HEAVY') score += 15;
        if (impactAnalysis.turnoverRisk === 'HIGH' || impactAnalysis.turnoverRisk === 'SEVERE') score -= 10;
    } else if (position === 'WR' || position === 'TE') {
        if (impactAnalysis.passingImpact === 'SEVERE') score -= 15;
        else if (impactAnalysis.passingImpact === 'HIGH') score -= 10;
        else if (impactAnalysis.passingImpact === 'MODERATE') score -= 5;
    }

    return score;
}

// Generate rankings for all players
function generateRankings(players: PlayerAnalysis[]): ComparisonResult['rankings'] {
    const rankings = {
        overall: [] as PlayerRanking[],
        byCategory: {
            matchup: [] as PlayerRanking[],
            form: [] as PlayerRanking[],
            weather: [] as PlayerRanking[],
            ceiling: [] as PlayerRanking[],
            floor: [] as PlayerRanking[]
        }
    };

    // Calculate scores for each category
    players.forEach(player => {
        const scores = {
            matchup: calculateMatchupScore(player),
            form: calculateFormScore(player),
            weather: getWeatherScore(player.weatherImpact, player.position),
            ceiling: calculateCeilingScore(player),
            floor: calculateFloorScore(player)
        };

        // Overall score (weighted average)
        const overallScore =
            scores.matchup * 0.25 +
            scores.form * 0.30 +
            scores.weather * 0.15 +
            scores.ceiling * 0.15 +
            scores.floor * 0.15;

        rankings.overall.push({
            playerId: player.playerId,
            playerName: player.playerName,
            score: overallScore,
            rank: 0, // Will be set after sorting
            reasoning: generateReasoningForPlayer(player, scores)
        });

        // Category-specific rankings
        Object.entries(scores).forEach(([category, score]) => {
            rankings.byCategory[category as keyof typeof rankings.byCategory].push({
                playerId: player.playerId,
                playerName: player.playerName,
                score,
                rank: 0,
                reasoning: []
            });
        });
    });

    // Sort and assign ranks
    rankings.overall.sort((a, b) => b.score - a.score);
    rankings.overall.forEach((player, index) => player.rank = index + 1);

    Object.keys(rankings.byCategory).forEach(category => {
        const categoryRankings = rankings.byCategory[category as keyof typeof rankings.byCategory];
        categoryRankings.sort((a, b) => b.score - a.score);
        categoryRankings.forEach((player, index) => player.rank = index + 1);
    });

    return rankings;
}

// Helper functions for scoring
function calculateMatchupScore(player: PlayerAnalysis): number {
    if (!player.defenseRanking) return 50;

    const pos = player.position.toLowerCase();
    const defenseRank = player.defenseRanking[pos]?.rank || 16;

    // Higher defense rank = worse defense = better for player
    return Math.min(90, 30 + (defenseRank * 2));
}

function calculateFormScore(player: PlayerAnalysis): number {
    if (!player.recentGames.length) return 50;

    const recentAvg = player.recentGames.slice(0, 3)
        .reduce((sum, game) => sum + (game.fantasy_points || 0), 0) /
        Math.max(1, player.recentGames.slice(0, 3).length);

    return Math.min(90, Math.max(10, recentAvg * 3));
}

function calculateCeilingScore(player: PlayerAnalysis): number {
    if (!player.recentGames.length) return 50;

    const bestGame = Math.max(...player.recentGames.map(g => g.fantasy_points || 0));
    return Math.min(90, Math.max(10, bestGame * 2.5));
}

function calculateFloorScore(player: PlayerAnalysis): number {
    if (!player.recentGames.length) return 50;

    const worstGame = Math.min(...player.recentGames.map(g => g.fantasy_points || 0));
    return Math.min(90, Math.max(10, 30 + (worstGame * 4)));
}

function generateReasoningForPlayer(player: PlayerAnalysis, scores: any): string[] {
    const reasoning = [];

    if (scores.matchup > 70) reasoning.push("Excellent matchup against weak defense");
    else if (scores.matchup < 40) reasoning.push("Tough matchup against strong defense");

    if (scores.form > 70) reasoning.push("Strong recent performance trend");
    else if (scores.form < 40) reasoning.push("Struggling in recent games");

    if (scores.weather < 40) reasoning.push("Weather conditions may negatively impact performance");
    else if (scores.weather > 60) reasoning.push("Weather conditions favor this player");

    if (scores.ceiling > 70) reasoning.push("High upside potential this week");
    if (scores.floor > 60) reasoning.push("Safe floor with consistent production");

    return reasoning;
}

// Generate AI analysis using OpenAI
async function generateAIAnalysis(players: PlayerAnalysis[], rankings: any): Promise<string> {
    try {
        const playerSummaries = players.map(player =>
            `${player.playerName} (${player.position}, ${player.team}): Recent form averaging ${player.recentGames.slice(0, 3).reduce((sum, game) => sum + (game.fantasy_points || 0), 0) /
            Math.max(1, player.recentGames.slice(0, 3).length)
            } fantasy points. ${player.injuries.length ? 'Has injury concerns.' : 'Healthy.'} Weather: ${player.weatherImpact?.severity || 'Unknown'}.`
        ).join('\n');

        const prompt = `Analyze these fantasy football players for start/sit decisions:

${playerSummaries}

Rankings: ${rankings.overall.map((p: any) => `${p.rank}. ${p.playerName} (${p.score.toFixed(1)})`).join(', ')}

Provide a concise 2-3 sentence recommendation focusing on the key differentiators and which player to start. Be specific about why.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
            temperature: 0.7,
        });

        return completion.choices[0]?.message?.content || "AI analysis unavailable";
    } catch (error) {
        console.error('AI analysis failed:', error);
        return "AI analysis unavailable due to an error.";
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const player1Id = searchParams.get('player1');
        const player2Id = searchParams.get('player2');
        const player3Id = searchParams.get('player3');
        const week = searchParams.get('week');

        if (!player1Id || !player2Id) {
            return NextResponse.json(
                { error: 'At least two player IDs are required (player1, player2)' },
                { status: 400 }
            );
        }

        console.log(`🔍 Starting player comparison: ${player1Id} vs ${player2Id}${player3Id ? ` vs ${player3Id}` : ''}`);

        // Gather enhanced analysis for all players
        const playerIds = [player1Id, player2Id, player3Id].filter(Boolean);
        const players = await Promise.all(
            playerIds.map(id => getEnhancedPlayerAnalysis(id!, week ? parseInt(week) : undefined))
        );

        console.log(`✅ Gathered analysis for ${players.length} players`);

        // Generate head-to-head comparisons
        const headToHead: any = {
            player1VsPlayer2: comparePlayersHeadToHead(players[0], players[1])
        };

        if (players[2]) {
            headToHead.player1VsPlayer3 = comparePlayersHeadToHead(players[0], players[2]);
            headToHead.player2VsPlayer3 = comparePlayersHeadToHead(players[1], players[2]);
        }

        // Generate rankings
        const rankings = generateRankings(players);

        // Generate AI analysis
        const aiAnalysis = await generateAIAnalysis(players, rankings);

        // Final recommendation
        const topPlayer = rankings.overall[0];
        const recommendation = {
            startPlayer: topPlayer.playerName,
            confidence: Math.round(topPlayer.score),
            reasoning: topPlayer.reasoning,
            aiAnalysis
        };

        const result: ComparisonResult = {
            players,
            headToHead,
            rankings,
            recommendation
        };

        console.log(`✅ Comparison complete. Recommendation: Start ${recommendation.startPlayer} (${recommendation.confidence}% confidence)`);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('❌ Player comparison error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to compare players' },
            { status: 500 }
        );
    }
}
