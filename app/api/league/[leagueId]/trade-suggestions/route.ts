import { createClient } from '@/lib/supabase/server';
import { NextResponse, NextRequest } from 'next/server';
import axios from 'axios';

// Type definitions - keeping compatible with your existing frontend
interface ProjectionData {
    pos: string;
    team: string;
    longName: string;
    playerID: string;
    adp_rank?: number;
    fantasyPointsDefault?: {
        standard?: string;
        PPR?: string;
        halfPPR?: string;
    };
}

interface EnhancedPlayerValue {
    player_id: string;
    name: string;
    position: string;
    team: string;
    value: number; // Keep compatible with existing frontend
    projected_points: number;
    positional_rank?: number;
    scarcity_bonus: number;
    adp_rank?: number;
    is_starter?: boolean;
    replacement_value?: number;
    endzone_value?: number; // NEW: Our primary value metric
}

interface SleeperLeagueSettings {
    roster_positions: string[];
    scoring_settings: { [key: string]: number };
    num_teams: number;
    playoff_week_start: number;
}

interface TeamAnalysis {
    owner_id: string;
    team_name: string;
    players: EnhancedPlayerValue[];
    position_counts: { [pos: string]: number };
    needs: { [pos: string]: 'high' | 'medium' | 'low' | 'surplus' };
    surplus_positions: string[];
    need_positions: string[];
    starter_slots: { [pos: string]: number };
    bench_depth: { [pos: string]: number };
    adp_strength?: { [pos: string]: { strength: number; strengthTier: 'weak' | 'below_average' | 'average' | 'strong' | 'elite' } };
}

interface TradeProposal {
    trade_id: string;
    team_a: {
        owner_id: string;
        team_name: string;
        giving: {
            player_id: string;
            name: string;
            position: string;
            trade_value: number;
            value: number;
        }[];
        receiving: {
            player_id: string;
            name: string;
            position: string;
            trade_value: number;
            value: number;
        }[];
        net_value: number;
        addresses_needs?: string[];
    };
    team_b: {
        owner_id: string;
        team_name: string;
        giving: {
            player_id: string;
            name: string;
            position: string;
            trade_value: number;
            value: number;
        }[];
        receiving: {
            player_id: string;
            name: string;
            position: string;
            trade_value: number;
            value: number;
        }[];
        net_value: number;
        addresses_needs?: string[];
    };
    fairness_score: number;
    trade_type?: string;
    reasoning: string[];
    need_fulfillment_score?: number;
    fairness_tier: 'fleece' | 'somewhat_fair' | 'very_strict';
    mutual_benefit?: number;
}

// Get season projections mapped by player name
async function getSeasonProjections(): Promise<{ [playerName: string]: number }> {
    try {
        console.log('[Endzone Value] Fetching 2025 season projections...');

        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
        const RAPIDAPI_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

        if (!RAPIDAPI_KEY) {
            throw new Error('RAPIDAPI_KEY not configured');
        }

        const response = await axios.get(`https://${RAPIDAPI_HOST}/getNFLProjections`, {
            params: {
                archiveSeason: '2025',
                pointsPerReception: 1,
                rushTD: 6,
                receivingTD: 6,
                passTD: 4
            },
            headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': RAPIDAPI_KEY
            },
            timeout: 15000
        });

        const projections: { [playerName: string]: number } = {};
        const playerProjections = response.data?.body?.playerProjections || {};

        Object.keys(playerProjections).forEach(playerId => {
            const player = playerProjections[playerId];
            const playerName = player?.longName?.toLowerCase();
            const pprPoints = parseFloat(player?.fantasyPointsDefault?.PPR || '0');

            if (playerName && pprPoints > 0) {
                projections[playerName] = pprPoints;
            }
        });

        console.log(`[Endzone Value] Loaded projections for ${Object.keys(projections).length} players by name`);
        return projections;
    } catch (error: any) {
        console.error('[Endzone Value] Failed to load projections:', error);
        return {};
    }
}

// Calculate Endzone Value (0-1000) based on projection ranking
function calculateEndzoneValue(projectedPoints: number, allProjections: number[]): number {
    if (projectedPoints <= 0) return 0;

    const validProjections = allProjections.filter(p => p > 0).sort((a, b) => b - a);
    const playerRank = validProjections.findIndex(p => p <= projectedPoints) + 1;

    // Convert rank to 0-1000 scale (1000 = #1 overall)
    return Math.round((validProjections.length - playerRank + 1) / validProjections.length * 1000);
}

// Main GET Function
export async function GET(request: NextRequest, { params }: { params: { leagueId: string } }) {
    try {
        const url = new URL(request.url);
        const min_fairness = parseFloat(url.searchParams.get('min_fairness') || '0.3');
        const max_results = parseInt(url.searchParams.get('max_results') || '10');

        console.log(`[Enhanced Trade] Generating best trade suggestions for league ${params.leagueId}`);

        // Convert to fairness tier system instead of exact percentages
        const fairnessTier = getFairnessTier(min_fairness);
        console.log(`[Enhanced Trade] Fairness tier: ${fairnessTier}`);

        // Get user info and sleeper username from leagues table
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get sleeper username from the leagues table for this specific league
        const { data: leagueData, error: leagueError } = await supabase
            .from('leagues')
            .select('sleeper_username')
            .eq('sleeper_league_id', params.leagueId)
            .eq('user_email', user.email)
            .single();

        if (leagueError || !leagueData?.sleeper_username) {
            console.log(`[Enhanced Trade] League data error:`, leagueError);
            console.log(`[Enhanced Trade] Looking for league ${params.leagueId} with email ${user.email}`);
            return NextResponse.json({
                error: 'League not found or sleeper username not configured for this league',
                details: 'Please make sure you have synced this league with your sleeper username'
            }, { status: 400 });
        }

        const sleeperUsername = leagueData.sleeper_username;
        console.log(`[Enhanced Trade] Found sleeper username: ${sleeperUsername}`);

        // Fetch league data from Sleeper
        console.log('[Enhanced Trade] Fetching league data from Sleeper...');
        const [rostersResponse, usersResponse, leagueResponse] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${params.leagueId}/rosters`),
            fetch(`https://api.sleeper.app/v1/league/${params.leagueId}/users`),
            fetch(`https://api.sleeper.app/v1/league/${params.leagueId}`)
        ]);

        const rosters = await rostersResponse.json();
        const users = await usersResponse.json();
        const leagueSettings: SleeperLeagueSettings = await leagueResponse.json();

        // Get projections
        const [sleeperPlayers, seasonProjections] = await Promise.all([
            getSleeperPlayers(),
            getSeasonProjections()
        ]);

        const enhancedTeams = await enhanceTeamsWithProjections(rosters, users, sleeperPlayers, seasonProjections, leagueSettings);

        // Find user's team using the sleeper username from the leagues table
        const userTeam = enhancedTeams.find(team => {
            const teamNameLower = team.team_name?.toLowerCase();
            const sleeperUsernameLower = sleeperUsername.toLowerCase();
            return teamNameLower === sleeperUsernameLower ||
                team.owner_id?.toLowerCase() === sleeperUsernameLower;
        });

        if (!userTeam) {
            console.log(`[Enhanced Trade] Could not find user team. Sleeper username: "${sleeperUsername}"`);
            console.log(`[Enhanced Trade] Available teams:`, enhancedTeams.map(t => `${t.team_name} (${t.owner_id})`));
            return NextResponse.json({
                error: 'Could not find your team in this league',
                details: `Looking for team with sleeper username: ${sleeperUsername}`
            }, { status: 400 });
        }

        const otherTeams = enhancedTeams.filter(team => team.owner_id !== userTeam.owner_id);

        // Calculate exact split for different max_results values
        let simpleTradeCount: number;
        let multiPlayerTradeCount: number;

        if (max_results <= 5) {
            simpleTradeCount = Math.ceil(max_results / 2);     // 5 → 3 simple, 2 multi
            multiPlayerTradeCount = Math.floor(max_results / 2);
        } else {
            simpleTradeCount = Math.ceil(max_results * 0.5);   // 50% simple trades
            multiPlayerTradeCount = Math.floor(max_results * 0.5); // 50% multi-player trades
        }

        console.log(`[Trade Generation] Generating ${simpleTradeCount} simple + ${multiPlayerTradeCount} multi-player trades (total: ${max_results})`);

        // Generate both types with exact counts
        const simpleTrades = generateSimpleTrades(userTeam, otherTeams, simpleTradeCount * 2); // Generate extra to ensure quality
        const multiPlayerTrades = generateMultiPlayerTrades(userTeam, otherTeams, multiPlayerTradeCount * 2); // Generate extra to ensure quality

        // Take the best from each category, then combine
        const bestSimpleTrades = simpleTrades
            .sort((a, b) => b.fairness_score - a.fairness_score)
            .slice(0, simpleTradeCount);

        const bestMultiPlayerTrades = multiPlayerTrades
            .sort((a, b) => b.fairness_score - a.fairness_score)
            .slice(0, multiPlayerTradeCount);

        // Combine and ensure we don't exceed max_results
        const allTrades = [...bestSimpleTrades, ...bestMultiPlayerTrades]
            .sort((a, b) => b.fairness_score - a.fairness_score) // Best trades first
            .slice(0, max_results);

        console.log(`[Trade Generation] Final result: ${allTrades.filter(t => t.trade_type?.includes('1v')).length} simple + ${allTrades.filter(t => t.trade_type?.includes('2v') || t.trade_type?.includes('3v')).length} multi-player trades`);

        return NextResponse.json({
            success: true,
            data: {
                trade_proposals: allTrades,
                total_players_analyzed: enhancedTeams.reduce((sum, team) => sum + team.players.length, 0),
                team_analyses: enhancedTeams.map(t => ({
                    team_id: t.owner_id,
                    team_name: t.team_name,
                    position_counts: t.position_counts,
                    needs: t.needs,
                    starter_slots: t.starter_slots
                })),
                user_team_analysis: {
                    team_name: userTeam.team_name,
                    needs: userTeam.needs,
                    surplus_positions: userTeam.surplus_positions,
                    need_positions: userTeam.need_positions,
                    position_counts: userTeam.position_counts,
                    starter_slots: userTeam.starter_slots,
                    bench_depth: userTeam.bench_depth
                },
                methodology: 'best_available_trades'
            }
        });

    } catch (error: any) {
        console.error('[Enhanced Trade] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to generate trade suggestions'
        }, { status: 500 });
    }
}

// Helper Functions
function getFairnessTier(min_fairness: number): 'fleece' | 'somewhat_fair' | 'very_strict' {
    if (min_fairness >= 0.80) return 'very_strict';    // Very Strict: 80-100%
    if (min_fairness >= 0.70) return 'somewhat_fair';  // Somewhat Fair: 70-80%
    return 'fleece';                                    // Fleece: 50-70%
}

function getFairnessBucket(tier: 'fleece' | 'somewhat_fair' | 'very_strict'): { min: number; max: number } {
    switch (tier) {
        case 'very_strict': return { min: 0.80, max: 1.0 };   // 80-100%
        case 'somewhat_fair': return { min: 0.70, max: 0.80 }; // 70-80%
        case 'fleece': return { min: 0.50, max: 0.70 };       // 50-70%
        default: return { min: 0.70, max: 1.0 };
    }
}

function calculateStarterSlots(rosterPositions: string[]): { [pos: string]: number } {
    const starterSlots: { [pos: string]: number } = {
        QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, FLEX: 0, SUPER_FLEX: 0
    };

    rosterPositions.forEach(position => {
        if (starterSlots.hasOwnProperty(position)) {
            starterSlots[position]++;
        }
    });

    return starterSlots;
}

async function getSleeperPlayers(): Promise<{ [playerId: string]: ProjectionData }> {
    try {
        console.log('[Sleeper API] Fetching player database...');
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');
        const players = await response.json();

        console.log('[Sleeper API] Loaded players:', Object.keys(players).length);

        // Convert to our ProjectionData format
        const convertedPlayers: { [playerId: string]: ProjectionData } = {};
        Object.keys(players).forEach(playerId => {
            const player = players[playerId];
            if (player && player.full_name) {
                convertedPlayers[playerId] = {
                    longName: player.full_name,
                    pos: player.position || player.fantasy_positions?.[0] || 'FLEX',
                    team: player.team || 'FA',
                    playerID: playerId,
                    fantasyPointsDefault: { standard: '0', PPR: '0', halfPPR: '0' }
                };
            }
        });

        console.log('[Sleeper API] Converted players with names:', Object.keys(convertedPlayers).length);
        return convertedPlayers;
    } catch (error: any) {
        console.error('[Sleeper API] Failed to load players:', error);
        return {};
    }
}

async function enhanceTeamsWithProjections(
    rosters: any[],
    users: any[],
    projections: { [playerId: string]: ProjectionData },
    seasonProjections: { [playerName: string]: number },
    leagueSettings: SleeperLeagueSettings
): Promise<TeamAnalysis[]> {
    const enhancedTeams: TeamAnalysis[] = [];

    // Get all projection values for ranking
    const allProjectionValues = Object.values(seasonProjections).filter(p => p > 0);

    for (const roster of rosters) {
        const ownerId = roster.owner_id;
        const teamName = roster.metadata?.team_name ||
            users.find((user: any) => user.user_id === ownerId)?.display_name ||
            `Team ${ownerId}`;

        const players = roster.players.map((playerId: string) => {
            const playerData = projections[playerId];

            // Match by name instead of ID
            const playerName = playerData?.longName?.toLowerCase();
            const projectedPoints = playerName ? (seasonProjections[playerName] || 0) : 0;
            const endzoneValue = calculateEndzoneValue(projectedPoints, allProjectionValues);

            return {
                player_id: playerId,
                name: playerData?.longName || playerId,
                position: playerData?.pos || 'FLEX',
                team: playerData?.team || 'FA',
                value: endzoneValue,
                projected_points: projectedPoints,
                scarcity_bonus: 0,
                endzone_value: endzoneValue,
                is_starter: false,
                replacement_value: 0
            };
        });

        enhancedTeams.push({
            team_name: teamName,
            owner_id: ownerId,
            players: players,
            position_counts: {
                QB: players.filter((p: any) => p.position === 'QB').length,
                RB: players.filter((p: any) => p.position === 'RB').length,
                WR: players.filter((p: any) => p.position === 'WR').length,
                TE: players.filter((p: any) => p.position === 'TE').length,
                K: players.filter((p: any) => p.position === 'K').length,
                DEF: players.filter((p: any) => p.position === 'DEF').length,
                FLEX: players.filter((p: any) => p.position === 'FLEX').length,
                SUPER_FLEX: players.filter((p: any) => p.position === 'SUPER_FLEX').length
            },
            needs: { QB: 'low', RB: 'high', WR: 'high', TE: 'high', K: 'low', DEF: 'low' },
            starter_slots: calculateStarterSlots(leagueSettings.roster_positions),
            bench_depth: {},
            surplus_positions: [],
            need_positions: ['RB', 'WR', 'TE']
        });
    }

    return enhancedTeams;
}

// Generate simple 1v1 trades
function generateSimpleTrades(
    userTeam: TeamAnalysis,
    otherTeams: TeamAnalysis[],
    maxResults: number
): TradeProposal[] {
    console.log(`[Simple Trades] Generating up to ${maxResults} simple trades`);

    const allTrades: TradeProposal[] = [];

    for (const otherTeam of otherTeams) {
        for (const userPlayer of userTeam.players) {
            for (const otherPlayer of otherTeam.players) {
                if (!userPlayer.endzone_value || !otherPlayer.endzone_value ||
                    userPlayer.endzone_value <= 0 || otherPlayer.endzone_value <= 0) continue;

                // Only consider trades where you gain value
                if (otherPlayer.endzone_value <= userPlayer.endzone_value) continue;

                const trade = createEndzoneValueTrade(
                    userTeam, [userPlayer], [otherPlayer],
                    otherTeam, [otherPlayer], [userPlayer],
                    '1v1'
                );

                if (trade && trade.team_a.net_value > 0) {
                    allTrades.push(trade);
                }
            }
        }
    }

    // Sort by fairness score (best first) and take top results
    return allTrades
        .sort((a, b) => b.fairness_score - a.fairness_score)
        .slice(0, maxResults);
}

// Generate multi-player trades
function generateMultiPlayerTrades(
    userTeam: TeamAnalysis,
    otherTeams: TeamAnalysis[],
    maxResults: number
): TradeProposal[] {
    console.log(`[Multi-Player Trades] Generating up to ${maxResults} multi-player trades`);

    const allTrades: TradeProposal[] = [];

    for (const otherTeam of otherTeams) {
        // Generate 2v2 trades
        const trades2v2 = generate2v2Trades(userTeam, otherTeam);
        allTrades.push(...trades2v2);

        // Generate 3v3 trades
        const trades3v3 = generate3v3Trades(userTeam, otherTeam);
        allTrades.push(...trades3v3);
    }

    // Sort by fairness score and value gained
    return allTrades
        .filter(trade => trade.team_a.net_value > 0)
        .sort((a, b) => b.fairness_score - a.fairness_score)
        .slice(0, maxResults);
}

// Generate 2v2 trades
function generate2v2Trades(userTeam: TeamAnalysis, otherTeam: TeamAnalysis): TradeProposal[] {
    const trades: TradeProposal[] = [];
    const userPlayers = userTeam.players.filter(p => p.endzone_value && p.endzone_value > 0);
    const otherPlayers = otherTeam.players.filter(p => p.endzone_value && p.endzone_value > 0);

    // Try different 2v2 combinations
    for (let i = 0; i < userPlayers.length - 1; i++) {
        for (let j = i + 1; j < userPlayers.length; j++) {
            const userPair = [userPlayers[i], userPlayers[j]];
            const userValue = userPair.reduce((sum, p) => sum + (p.endzone_value || 0), 0);

            for (let x = 0; x < otherPlayers.length - 1; x++) {
                for (let y = x + 1; y < otherPlayers.length; y++) {
                    const otherPair = [otherPlayers[x], otherPlayers[y]];
                    const otherValue = otherPair.reduce((sum, p) => sum + (p.endzone_value || 0), 0);

                    // Only consider if you gain value
                    if (otherValue <= userValue) continue;

                    const trade = createEndzoneValueTrade(
                        userTeam, userPair, otherPair,
                        otherTeam, otherPair, userPair,
                        '2v2'
                    );

                    if (trade && trade.fairness_score >= 0.60 && trade.team_a.net_value > 0) {
                        trades.push(trade);
                    }
                }
            }
        }
    }

    return trades.slice(0, 10); // Limit to prevent too many combinations
}

// Generate 3v3 trades
function generate3v3Trades(userTeam: TeamAnalysis, otherTeam: TeamAnalysis): TradeProposal[] {
    const trades: TradeProposal[] = [];
    const userPlayers = userTeam.players.filter(p => p.endzone_value && p.endzone_value > 0);
    const otherPlayers = otherTeam.players.filter(p => p.endzone_value && p.endzone_value > 0);

    // Limit combinations to prevent performance issues
    const maxCombinations = 50;
    let combinations = 0;

    for (let i = 0; i < userPlayers.length - 2 && combinations < maxCombinations; i++) {
        for (let j = i + 1; j < userPlayers.length - 1 && combinations < maxCombinations; j++) {
            for (let k = j + 1; k < userPlayers.length && combinations < maxCombinations; k++) {
                const userTriple = [userPlayers[i], userPlayers[j], userPlayers[k]];
                const userValue = userTriple.reduce((sum, p) => sum + (p.endzone_value || 0), 0);

                for (let x = 0; x < otherPlayers.length - 2 && combinations < maxCombinations; x++) {
                    for (let y = x + 1; y < otherPlayers.length - 1 && combinations < maxCombinations; y++) {
                        for (let z = y + 1; z < otherPlayers.length && combinations < maxCombinations; z++) {
                            combinations++;
                            const otherTriple = [otherPlayers[x], otherPlayers[y], otherPlayers[z]];
                            const otherValue = otherTriple.reduce((sum, p) => sum + (p.endzone_value || 0), 0);

                            // Only consider if you gain value
                            if (otherValue <= userValue) continue;

                            const trade = createEndzoneValueTrade(
                                userTeam, userTriple, otherTriple,
                                otherTeam, otherTriple, userTriple,
                                '3v3'
                            );

                            if (trade && trade.fairness_score >= 0.50 && trade.team_a.net_value > 0) {
                                trades.push(trade);
                            }
                        }
                    }
                }
            }
        }
    }

    return trades.slice(0, 5); // Limit to best 5
}

// Simplified trade creation
function createEndzoneValueTrade(
    teamA: TeamAnalysis, teamAGiving: any[], teamAReceiving: any[],
    teamB: TeamAnalysis, teamBGiving: any[], teamBReceiving: any[],
    tradeType: string
): TradeProposal | null {
    const teamAValue = teamAGiving.reduce((sum, p) => sum + (p.endzone_value || 0), 0);
    const teamBValue = teamBGiving.reduce((sum, p) => sum + (p.endzone_value || 0), 0);

    if (teamAValue === 0 || teamBValue === 0) return null;

    const fairnessScore = Math.min(teamAValue, teamBValue) / Math.max(teamAValue, teamBValue);

    // Simplified reasoning
    let reasoning: string[];
    if (teamAGiving.length > 1) {
        reasoning = [
            `Multi-player trade: ${teamAGiving.length}v${teamBGiving.length}`,
            `Trade fairness: ${(fairnessScore * 100).toFixed(1)}%`,
            `Net gain: +${teamBValue - teamAValue} EV`
        ];
    } else {
        reasoning = [
            `Trade fairness: ${(fairnessScore * 100).toFixed(1)}%`,
            `Net gain: +${teamBValue - teamAValue} EV`
        ];
    }

    return {
        trade_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        team_a: {
            team_name: teamA.team_name,
            owner_id: teamA.owner_id,
            giving: teamAGiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.endzone_value || 0,
                value: p.endzone_value || 0
            })),
            receiving: teamAReceiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.endzone_value || 0,
                value: p.endzone_value || 0
            })),
            net_value: teamBValue - teamAValue,
            addresses_needs: []
        },
        team_b: {
            team_name: teamB.team_name,
            owner_id: teamB.owner_id,
            giving: teamBGiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.endzone_value || 0,
                value: p.endzone_value || 0
            })),
            receiving: teamBReceiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.endzone_value || 0,
                value: p.endzone_value || 0
            })),
            net_value: teamAValue - teamBValue,
            addresses_needs: []
        },
        fairness_score: fairnessScore,
        fairness_tier: fairnessScore >= 0.80 ? 'very_strict' : fairnessScore >= 0.70 ? 'somewhat_fair' : 'fleece',
        trade_type: tradeType,
        reasoning: reasoning,
        need_fulfillment_score: 0.5,
        mutual_benefit: fairnessScore
    };
}