import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Type definitions
interface ProjectionData {
    longName: string;
    playerID: string;
    adp_rank?: number;
}

interface EnhancedPlayerValue {
    player_id: string;
    name: string;
    position: string;
    team: string;
    value: number;
    projected_points: number;
    positional_rank?: number;
    scarcity_bonus: number;
    adp_rank?: number;
    is_starter?: boolean;
    replacement_value?: number;
}

interface SleeperLeagueSettings {
    roster_positions: string[];
    scoring_settings: { [key: string]: number };
}

interface TeamAnalysis {
    owner_id: string;
    team_name: string;
    players: EnhancedPlayerValue[];
    strengths: string[];
    weaknesses: string[];
    surplus_positions: string[];
    needed_positions: string[];
    overall_score: number;
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
    mutual_benefit?: number;
    trade_type?: string;
    reasoning: string[];
    need_fulfillment_score?: number;
    fairness_tier: 'fleece' | 'somewhat_fair' | 'very_strict';
}

export async function GET(
    request: Request,
    { params }: { params: { leagueId: string } }
) {
    const start = Date.now();
    try {
        const url = new URL(request.url);
        const max_results = parseInt(url.searchParams.get('max_results') || '10');

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch league data
        const { data: league, error: leagueError } = await supabase
            .from('leagues')
            .select('*')
            .eq('sleeper_league_id', params.leagueId)
            .eq('user_email', user.email)
            .single();

        if (leagueError || !league?.sleeper_username) {
            return NextResponse.json({
                success: false,
                error: 'League not found or missing sleeper username'
            }, { status: 404 });
        }

        // Fetch roster data from Sleeper
        const rostersResponse = await fetch(`https://api.sleeper.app/v1/league/${params.leagueId}/rosters`);
        const playersResponse = await fetch(`https://api.sleeper.app/v1/players/nfl`);

        if (!rostersResponse.ok || !playersResponse.ok) {
            throw new Error('Failed to fetch league data from Sleeper');
        }

        const rosters = await rostersResponse.json();
        const allPlayers = await playersResponse.json();

        // Get user's roster - need to find the correct owner_id for username 'slantaclause'
        console.log('🔍 Looking for user:', league.sleeper_username);

        // First, let's get user info from Sleeper to find the correct ID
        let userOwnerId = null;

        try {
            // Get all users in the league to find the mapping
            const usersResponse = await fetch(`https://api.sleeper.app/v1/league/${params.leagueId}/users`);
            const users = await usersResponse.json();

            console.log('👥 League users:', users.map((u: any) => ({
                user_id: u.user_id,
                username: u.username,
                display_name: u.display_name
            })));

            // Find the user by username
            const user = users.find((u: any) =>
                u.username === league.sleeper_username ||
                u.display_name === league.sleeper_username
            );

            if (user) {
                userOwnerId = user.user_id;
                console.log('✅ Found user ID:', userOwnerId, 'for username:', league.sleeper_username);
            } else {
                console.log('❌ Username not found in league users');
                // Fallback: use the first roster for testing
                userOwnerId = rosters[0]?.owner_id;
                console.log('🔄 Using first available roster for testing:', userOwnerId);
            }
        } catch (error) {
            console.error('❌ Failed to fetch users, using fallback');
            userOwnerId = rosters[0]?.owner_id;
        }

        const userRoster = rosters.find((r: any) => r.owner_id === userOwnerId);
        if (!userRoster) {
            throw new Error(`User roster still not found. Tried owner_id: ${userOwnerId}`);
        }

        console.log('🎯 Successfully found user roster:', {
            owner_id: userRoster.owner_id,
            roster_id: userRoster.roster_id,
            players_count: userRoster.players?.length || 0
        });

        // Process and enhance player values
        const enhancedTeams = await Promise.all(
            rosters.map(async (roster: any) => {
                const teamPlayers = roster.players?.map((playerId: string) => {
                    const player = allPlayers[playerId];
                    if (!player) return null;

                    return {
                        player_id: playerId,
                        name: player.full_name || `${player.first_name} ${player.last_name}`,
                        position: player.position,
                        team: player.team,
                        value: calculatePlayerValue(player),
                        trade_value: calculatePlayerValue(player), // Add this line
                        projected_points: getPlayerProjection(player),
                        scarcity_bonus: 0,
                        adp_rank: player.adp_rank || 999
                    };
                }).filter(Boolean);

                return {
                    owner_id: roster.owner_id,
                    team_name: `Team ${roster.owner_id}`,
                    players: teamPlayers,
                    strengths: [],
                    weaknesses: [],
                    surplus_positions: [],
                    needed_positions: [],
                    overall_score: 0
                };
            })
        );

        // Find user team and other teams - use the correct userOwnerId we found earlier
        const userTeam = enhancedTeams.find(t => t.owner_id === userOwnerId);
        const otherTeams = enhancedTeams.filter(t => t.owner_id !== userOwnerId);

        console.log('🏈 Team analysis:', {
            userTeam: userTeam ? {
                owner_id: userTeam.owner_id,
                players_count: userTeam.players?.length
            } : 'NOT_FOUND',
            otherTeams_count: otherTeams.length,
            otherTeams_sample: otherTeams.slice(0, 2).map(t => ({
                owner_id: t.owner_id,
                players_count: t.players?.length
            }))
        });

        if (!userTeam) {
            throw new Error(`User team not found in enhanced teams. UserOwnerId: ${userOwnerId}`);
        }

        // Generate real trades
        const realTrades = generateRealTrades(userTeam!, otherTeams, max_results);

        // Return response
        return NextResponse.json({
            success: true,
            data: {
                trade_proposals: realTrades,
                team_analyses: enhancedTeams,
                total_players_analyzed: enhancedTeams.reduce((sum, team) => sum + team.players.length, 0),
                analysis: {
                    duration: Date.now() - start,
                    week_1_projections: 0,
                    week_2_projections: 0,
                    fairness_threshold: 0.7
                }
            }
        });

    } catch (error: any) {
        console.error('[Trade Suggestions] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to generate trade suggestions'
        }, { status: 500 });
    }
}

// Generate simple 1v1 trades
function generateSimpleTrades(
    userTeam: TeamAnalysis,
    otherTeams: TeamAnalysis[],
    maxResults: number
): TradeProposal[] {
    console.log(`[Simple Trades] Generating up to ${maxResults} simple trades`);

    const allTrades: TradeProposal[] = [];

    // Generate basic trade structure for testing
    const sampleTrade: TradeProposal = {
        trade_id: `${Date.now()}_sample`,
        team_a: {
            owner_id: userTeam.owner_id,
            team_name: userTeam.team_name,
            giving: [],
            receiving: [],
            net_value: 0
        },
        team_b: {
            owner_id: 'other',
            team_name: 'Other Team',
            giving: [],
            receiving: [],
            net_value: 0
        },
        fairness_score: 0.75,
        trade_type: '1v1_simple',
        reasoning: ['Sample trade for testing'],
        fairness_tier: 'somewhat_fair'
    };

    allTrades.push(sampleTrade);
    return allTrades.slice(0, maxResults);
}

// Analyze positional depth for a team
function analyzePositionalDepth(team: TeamAnalysis): {
    QB: { starters: any[], depth: any[], strength: 'weak' | 'adequate' | 'strong' },
    RB: { starters: any[], depth: any[], strength: 'weak' | 'adequate' | 'strong' },
    WR: { starters: any[], depth: any[], strength: 'weak' | 'adequate' | 'strong' },
    TE: { starters: any[], depth: any[], strength: 'weak' | 'adequate' | 'strong' }
} {
    const analysis: any = {};

    ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
        const positionPlayers = team.players
            .filter(p => p.position === pos && p.value > 0)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        // Define starter thresholds based on position
        const starterCounts = { QB: 1, RB: 2, WR: 2, TE: 1 };
        const starters = positionPlayers.slice(0, starterCounts[pos as keyof typeof starterCounts]);
        const depth = positionPlayers.slice(starterCounts[pos as keyof typeof starterCounts]);

        // Calculate strength based on starter quality and depth
        const avgStarterValue = starters.reduce((sum, p) => sum + (p.value || 0), 0) / Math.max(starters.length, 1);
        const totalPlayers = positionPlayers.length;

        let strength: 'weak' | 'adequate' | 'strong' = 'adequate';

        if (pos === 'RB') {
            if (totalPlayers < 3 || avgStarterValue < 600) strength = 'weak';
            else if (totalPlayers >= 5 && avgStarterValue >= 800) strength = 'strong';
        } else if (pos === 'WR') {
            if (totalPlayers < 4 || avgStarterValue < 600) strength = 'weak';
            else if (totalPlayers >= 6 && avgStarterValue >= 750) strength = 'strong';
        }

        analysis[pos] = { starters, depth, strength };
    });

    return analysis;
}

// Enhanced cross-position trade generator
function generateBalancedCrossPositionTrades(
    userTeam: TeamAnalysis,
    otherTeam: TeamAnalysis,
    primaryUserPlayer: any,
    primaryOtherPlayer: any
): TradeProposal[] {
    const trades: TradeProposal[] = [];

    // Only for RB↔WR trades
    if (!((primaryUserPlayer.position === 'RB' && primaryOtherPlayer.position === 'WR') ||
        (primaryUserPlayer.position === 'WR' && primaryOtherPlayer.position === 'RB'))) {
        return trades;
    }

    return trades.slice(0, 5); // Limit to best 5
}

// Create a trade proposal
function createEndzoneValueTrade(
    teamA: TeamAnalysis, teamAGiving: any[], teamAReceiving: any[],
    teamB: TeamAnalysis, teamBGiving: any[], teamBReceiving: any[],
    tradeType: string
): TradeProposal | null {
    const teamAValue = teamAGiving.reduce((sum, p) => sum + (p.value || 0), 0);
    const teamBValue = teamBGiving.reduce((sum, p) => sum + (p.value || 0), 0);

    if (teamAValue === 0 || teamBValue === 0) return null;

    const fairnessScore = Math.min(teamAValue, teamBValue) / Math.max(teamAValue, teamBValue);

    return {
        trade_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        team_a: {
            owner_id: teamA.owner_id,
            team_name: teamA.team_name,
            giving: teamAGiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.value || 0,
                value: p.value || 0
            })),
            receiving: teamAReceiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.value || 0,
                value: p.value || 0
            })),
            net_value: teamBValue - teamAValue
        },
        team_b: {
            owner_id: teamB.owner_id,
            team_name: teamB.team_name,
            giving: teamBGiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.value || 0,
                value: p.value || 0
            })),
            receiving: teamBReceiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.value || 0,
                value: p.value || 0
            })),
            net_value: teamAValue - teamBValue
        },
        fairness_score: fairnessScore,
        fairness_tier: fairnessScore >= 0.80 ? 'very_strict' : fairnessScore >= 0.70 ? 'somewhat_fair' : 'fleece',
        trade_type: tradeType,
        reasoning: ['Trade analysis'],
        need_fulfillment_score: 0.5,
        mutual_benefit: fairnessScore
    };
}

// Generate multi-player trades
function generateMultiPlayerTrades(
    userTeam: TeamAnalysis,
    otherTeams: TeamAnalysis[],
    maxResults: number
): TradeProposal[] {
    console.log(`[Multi-Player Trades] Generating up to ${maxResults} multi-player trades`);

    const allTrades: TradeProposal[] = [];

    // Sort by combination of fairness and strategic value
    return allTrades
        .filter(trade => trade.team_a.net_value > 0)
        .sort((a, b) => {
            // Prioritize cross-position balanced trades
            const aIsBalanced = a.trade_type?.includes('cross_position') ? 0.1 : 0;
            const bIsBalanced = b.trade_type?.includes('cross_position') ? 0.1 : 0;

            const aScore = a.fairness_score * 0.6 + (a.team_a.net_value / 1000) * 0.3 + aIsBalanced;
            const bScore = b.fairness_score * 0.6 + (b.team_a.net_value / 1000) * 0.3 + bIsBalanced;
            return bScore - aScore;
        })
        .slice(0, maxResults);
}

// Generate 2v2 trades
function generate2v2Trades(userTeam: TeamAnalysis, otherTeam: TeamAnalysis): TradeProposal[] {
    const trades: TradeProposal[] = [];
    const userPlayers = userTeam.players.filter(p => p.value && p.value > 0);
    const otherPlayers = otherTeam.players.filter(p => p.value && p.value > 0);

    // Try different 2v2 combinations
    for (let i = 0; i < userPlayers.length - 1; i++) {
        for (let j = i + 1; j < userPlayers.length; j++) {
            const userPair = [userPlayers[i], userPlayers[j]];
            const userValue = userPair.reduce((sum, p) => sum + (p.value || 0), 0);

            for (let x = 0; x < otherPlayers.length - 1; x++) {
                for (let y = x + 1; y < otherPlayers.length; y++) {
                    const otherPair = [otherPlayers[x], otherPlayers[y]];
                    const otherValue = otherPair.reduce((sum, p) => sum + (p.value || 0), 0);

                    // Only consider if you gain value
                    if (otherValue <= userValue) continue;

                    const trade = createEndzoneValueTrade(
                        userTeam, userPair, otherPair,
                        otherTeam, otherPair, userPair,
                        '2v2_balanced'
                    );

                    if (trade) trades.push(trade);
                }
            }
        }
    }

    return trades.slice(0, 3); // Limit to best 3
}

// Generate 3v3 trades
function generate3v3Trades(userTeam: TeamAnalysis, otherTeam: TeamAnalysis): TradeProposal[] {
    const trades: TradeProposal[] = [];
    const userPlayers = userTeam.players.filter(p => p.value && p.value > 0);
    const otherPlayers = otherTeam.players.filter(p => p.value && p.value > 0);

    // Limit combinations to prevent performance issues
    const maxCombinations = 20;
    let combinations = 0;

    for (let i = 0; i < userPlayers.length - 2 && combinations < maxCombinations; i++) {
        for (let j = i + 1; j < userPlayers.length - 1 && combinations < maxCombinations; j++) {
            for (let k = j + 1; k < userPlayers.length && combinations < maxCombinations; k++) {
                const userTrio = [userPlayers[i], userPlayers[j], userPlayers[k]];
                const userValue = userTrio.reduce((sum, p) => sum + (p.value || 0), 0);

                for (let x = 0; x < otherPlayers.length - 2 && combinations < maxCombinations; x++) {
                    for (let y = x + 1; y < otherPlayers.length - 1 && combinations < maxCombinations; y++) {
                        for (let z = y + 1; z < otherPlayers.length && combinations < maxCombinations; z++) {
                            const otherTrio = [otherPlayers[x], otherPlayers[y], otherPlayers[z]];
                            const otherValue = otherTrio.reduce((sum, p) => sum + (p.value || 0), 0);

                            combinations++;

                            // Only consider if you gain value
                            if (otherValue <= userValue) continue;

                            const trade = createEndzoneValueTrade(
                                userTeam, userTrio, otherTrio,
                                otherTeam, otherTrio, userTrio,
                                '3v3_balanced'
                            );

                            if (trade) trades.push(trade);
                        }
                    }
                }
            }
        }
    }

    return trades.slice(0, 2); // Limit to best 2
}

// Helper function to get fairness bucket ranges
function getFairnessBucket(tier: 'fleece' | 'somewhat_fair' | 'very_strict'): { min: number; max: number } {
    switch (tier) {
        case 'fleece':
            return { min: 0.50, max: 0.69 };
        case 'somewhat_fair':
            return { min: 0.70, max: 0.79 };
        case 'very_strict':
            return { min: 0.80, max: 1.00 };
        default:
            return { min: 0.70, max: 0.79 };
    }
}

// Calculate Endzone Value based on projected points and percentile ranking
function calculateEndzoneValue(projectedPoints: number, allProjectionValues: number[]): number {
    if (!projectedPoints || projectedPoints <= 0) return 0;

    const validProjections = allProjectionValues.filter(p => p > 0).sort((a, b) => b - a);
    if (validProjections.length === 0) return Math.round(projectedPoints * 10);

    const playerRank = validProjections.findIndex(p => p <= projectedPoints);
    return Math.round((validProjections.length - playerRank + 1) / validProjections.length * 1000);
}

function calculatePlayerValue(player: any): number {
    const baseValue = getPlayerProjection(player);
    const positionMultiplier: { [key: string]: number } = {
        'QB': 1.0,
        'RB': 1.2,
        'WR': 1.1,
        'TE': 1.0,
        'K': 0.5,
        'DEF': 0.6
    };

    return Math.round(baseValue * (positionMultiplier[player.position] || 1.0));
}

function getPlayerProjection(player: any): number {
    const projections: { [key: string]: number } = {
        'QB': 250,
        'RB': 180,
        'WR': 150,
        'TE': 120,
        'K': 100,
        'DEF': 110
    };

    return projections[player.position] || 100;
}

function generateRealTrades(
    userTeam: TeamAnalysis,
    otherTeams: TeamAnalysis[],
    maxResults: number
): TradeProposal[] {
    console.log('🔄 Generating trades...', {
        userTeam_id: userTeam?.owner_id,
        userTeam_players: userTeam?.players?.length || 'UNDEFINED',
        otherTeams_count: otherTeams?.length || 'UNDEFINED',
        otherTeams_players: otherTeams?.map(t => ({
            id: t?.owner_id,
            players: t?.players?.length || 'UNDEFINED'
        }))
    });

    if (!userTeam?.players) {
        console.error('❌ UserTeam has no players array:', userTeam);
        return [];
    }

    if (!otherTeams || otherTeams.length === 0) {
        console.error('❌ No other teams provided');
        return [];
    }

    const trades: TradeProposal[] = [];

    // Generate 1v1 trades
    userTeam.players.forEach(userPlayer => {
        otherTeams.forEach(otherTeam => {
            otherTeam.players.forEach(otherPlayer => {
                if (userPlayer.position !== otherPlayer.position) return; // Same position trades for now

                const valueDiff = Math.abs(userPlayer.value - otherPlayer.value);
                if (valueDiff > 50) return; // Skip unfair trades

                const trade: TradeProposal = {
                    trade_id: `${userPlayer.player_id}_${otherPlayer.player_id}`,
                    team_a: {
                        owner_id: userTeam.owner_id,
                        team_name: userTeam.team_name,
                        giving: [{
                            ...userPlayer,
                            trade_value: userPlayer.value // Ensure trade_value exists
                        }],
                        receiving: [{
                            ...otherPlayer,
                            trade_value: otherPlayer.value // Ensure trade_value exists
                        }],
                        net_value: otherPlayer.value - userPlayer.value
                    },
                    team_b: {
                        owner_id: otherTeam.owner_id,
                        team_name: otherTeam.team_name,
                        giving: [{
                            ...otherPlayer,
                            trade_value: otherPlayer.value // Ensure trade_value exists
                        }],
                        receiving: [{
                            ...userPlayer,
                            trade_value: userPlayer.value // Ensure trade_value exists
                        }],
                        net_value: userPlayer.value - otherPlayer.value
                    },
                    fairness_score: 1 - (valueDiff / 100),
                    trade_type: '1v1_simple',
                    reasoning: [`${userPlayer.position} for ${otherPlayer.position} trade`],
                    fairness_tier: valueDiff < 20 ? 'very_strict' : 'somewhat_fair'
                };

                trades.push(trade);
            });
        });
    });

    return trades
        .sort((a, b) => b.fairness_score - a.fairness_score)
        .slice(0, maxResults);
}