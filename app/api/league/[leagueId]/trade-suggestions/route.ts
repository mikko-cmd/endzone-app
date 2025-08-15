import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import axios from 'axios';

interface ProjectionData {
    Rushing?: { rushYds: string; carries: string; rushTD: string };
    Receiving?: { receptions: string; recTD: string; targets: string; recYds: string };
    Passing?: { passYds: string; passTD: string; passAttempts: string; int: string };
    fantasyPointsDefault?: { standard: string; PPR: string; halfPPR: string };
    pos: string;
    team: string;
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
    num_teams: number;
    playoff_week_start: number;
}

interface TeamAnalysis {
    team_name: string;
    owner_id: string;
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
    mutual_benefit?: number;
    trade_type?: string;
    reasoning: string[];
    need_fulfillment_score?: number;
    fairness_tier: 'fleece' | 'somewhat_fair' | 'very_strict';
}

// Remove the loadADPData function and replace with getSeasonProjections
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
        console.log(`[Endzone Value] Sample names:`, Object.keys(projections).slice(0, 5));
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
        const max_results = parseInt(url.searchParams.get('max_results') || '10');

        console.log(`[Enhanced Trade] Generating best trade suggestions for league ${params.leagueId}`);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: leagueData, error: leagueError } = await supabase
            .from('leagues')
            .select('sleeper_username')
            .eq('sleeper_league_id', params.leagueId)
            .eq('user_email', user.email)
            .single();

        if (leagueError || !leagueData?.sleeper_username) {
            return NextResponse.json({
                error: 'League not found or sleeper username not configured for this league',
                details: 'Please make sure you have synced this league with your sleeper username'
            }, { status: 400 });
        }

        const sleeperUsername = leagueData.sleeper_username;

        const [rostersResponse, usersResponse, leagueResponse] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${params.leagueId}/rosters`),
            fetch(`https://api.sleeper.app/v1/league/${params.leagueId}/users`),
            fetch(`https://api.sleeper.app/v1/league/${params.leagueId}`)
        ]);

        const rosters = await rostersResponse.json();
        const users = await usersResponse.json();
        const leagueSettings: SleeperLeagueSettings = await leagueResponse.json();

        const [sleeperPlayers, seasonProjections] = await Promise.all([
            getSleeperPlayers(),
            getSeasonProjections() // Now returns name-based mapping
        ]);

        const enhancedTeams = await enhanceTeamsWithProjections(rosters, users, sleeperPlayers, seasonProjections, leagueSettings);

        const userTeam = enhancedTeams.find(team => {
            const teamNameLower = team.team_name?.toLowerCase();
            const sleeperUsernameLower = sleeperUsername.toLowerCase();
            return teamNameLower === sleeperUsernameLower ||
                team.owner_id?.toLowerCase() === sleeperUsernameLower;
        });

        if (!userTeam) {
            return NextResponse.json({
                error: 'Could not find your team in this league',
                details: `Looking for team with sleeper username: ${sleeperUsername}`
            }, { status: 404 });
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

        console.log(`[Trade Generation] Final result: ${allTrades.filter(t => t.trade_type.includes('1v')).length} simple + ${allTrades.filter(t => t.trade_type.includes('2v') || t.trade_type.includes('3v')).length} multi-player trades`);

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
                    position_counts: userTeam.position_counts,
                    needs: userTeam.needs,
                    surplus_positions: userTeam.surplus_positions,
                    need_positions: userTeam.need_positions,
                    starter_slots: userTeam.starter_slots,
                    bench_depth: userTeam.bench_depth
                },
                methodology: 'best_available_trades'
            }
        });

    } catch (error: any) {
        console.error('[Enhanced Trade] Error:', error);
        return NextResponse.json({
            error: 'Failed to generate enhanced trade suggestions',
            details: error.message
        }, { status: 500 });
    }
}

// Helper Functions
function getFairnessTier(min_fairness: number): 'fleece' | 'somewhat_fair' | 'very_strict' {
    if (min_fairness >= 0.80) return 'very_strict';    // Very Strict: 80-100% (lowered from 85%)
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

// Update the ADP value calculation to use a proper value system
function getADPValue(adpRank: number | undefined): number {
    if (!adpRank) return 0;

    // Convert ADP rank to actual trade value
    // Earlier picks (lower ADP) = higher value
    // Use exponential decay to reflect true draft value differences
    const baseValue = 200;
    const decayRate = 0.15;

    return Math.round(baseValue * Math.exp(-decayRate * (adpRank - 1)));
}

// Add a helper to show readable ADP values
function formatADPValue(adpRank: number | undefined): string {
    if (!adpRank) return '$0';

    const value = getADPValue(adpRank);
    return `$${value}`;
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

// Add new function to find position-balancing players
function findPositionBalancingPlayers(
    teamA: TeamAnalysis,
    teamB: TeamAnalysis,
    primaryPlayerA: any,
    primaryPlayerB: any,
    fairnessTier: 'fleece' | 'somewhat_fair' | 'very_strict'
): { teamASecondary: any | null, teamBSecondary: any | null } {

    // Only balance cross-position trades
    if (primaryPlayerA.position === primaryPlayerB.position) {
        return { teamASecondary: null, teamBSecondary: null };
    }

    console.log(`[Position Balance] Looking for balance for ${primaryPlayerA.position}-for-${primaryPlayerB.position} trade`);

    // Define what positions each team needs to add
    let teamANeedsPosition: string[];
    let teamBNeedsPosition: string[];

    if (primaryPlayerA.position === 'WR' && primaryPlayerB.position === 'TE') {
        teamANeedsPosition = ['TE']; // Team A gives WR, needs to add TE
        teamBNeedsPosition = ['WR', 'RB']; // Team B gives TE, needs to add WR or RB
    } else if (primaryPlayerA.position === 'TE' && primaryPlayerB.position === 'WR') {
        teamANeedsPosition = ['WR', 'RB']; // Team A gives TE, needs to add WR or RB
        teamBNeedsPosition = ['TE']; // Team B gives WR, needs to add TE
    } else if (primaryPlayerA.position === 'RB' && primaryPlayerB.position === 'WR') {
        teamANeedsPosition = ['WR']; // Team A gives RB, could add WR
        teamBNeedsPosition = ['RB']; // Team B gives WR, could add RB
    } else {
        // For other position combinations, don't balance
        return { teamASecondary: null, teamBSecondary: null };
    }

    // Find candidates from each team
    const teamACandidates = teamA.players.filter(p =>
        teamANeedsPosition.includes(p.position) &&
        p.endzone_value &&
        p.endzone_value > 0 &&
        p.player_id !== primaryPlayerA.player_id
    );

    const teamBCandidates = teamB.players.filter(p =>
        teamBNeedsPosition.includes(p.position) &&
        p.endzone_value &&
        p.endzone_value > 0 &&
        p.player_id !== primaryPlayerB.player_id
    );

    if (teamACandidates.length === 0 || teamBCandidates.length === 0) {
        console.log(`[Position Balance] No candidates found`);
        return { teamASecondary: null, teamBSecondary: null };
    }

    // Find the best matching pair based on value similarity
    let bestMatch: { teamAPlayer: any, teamBPlayer: any, valueDiff: number } | null = null;

    for (const teamAPlayer of teamACandidates) {
        for (const teamBPlayer of teamBCandidates) {
            const valueDiff = Math.abs(teamAPlayer.endzone_value - teamBPlayer.endzone_value);
            const maxValue = Math.max(teamAPlayer.endzone_value, teamBPlayer.endzone_value);
            const fairnessRatio = Math.min(teamAPlayer.endzone_value, teamBPlayer.endzone_value) / maxValue;

            // Check if this secondary trade meets fairness requirements
            const { min, max } = getFairnessBucket(fairnessTier);
            if (fairnessRatio >= min && fairnessRatio <= max) {
                if (!bestMatch || valueDiff < bestMatch.valueDiff) {
                    bestMatch = { teamAPlayer, teamBPlayer, valueDiff };
                }
            }
        }
    }

    if (bestMatch) {
        console.log(`[Position Balance] Found match: ${bestMatch.teamAPlayer.name} (${bestMatch.teamAPlayer.endzone_value} EV) ↔ ${bestMatch.teamBPlayer.name} (${bestMatch.teamBPlayer.endzone_value} EV)`);
        return {
            teamASecondary: bestMatch.teamAPlayer,
            teamBSecondary: bestMatch.teamBPlayer
        };
    }

    return { teamASecondary: null, teamBSecondary: null };
}

// Update generateSimpleADPTrades to include position balancing
function generateSimpleADPTrades(
    userTeam: TeamAnalysis,
    otherTeams: TeamAnalysis[],
    fairnessTier: 'fleece' | 'somewhat_fair' | 'very_strict',
    maxResults: number
): TradeProposal[] {
    console.log(`[Trade Debug] Starting generation with fairness tier: ${fairnessTier}`);

    const allTrades: TradeProposal[] = [];
    const { min, max } = getFairnessBucket(fairnessTier);
    console.log(`[Trade Debug] Fairness range: ${min * 100}% - ${max * 100}%`);

    // Count players with Endzone Values
    const userPlayersWithValue = userTeam.players.filter(p => p.endzone_value && p.endzone_value > 0).length;
    console.log(`[Trade Debug] User team has ${userPlayersWithValue}/${userTeam.players.length} players with Endzone Value`);

    let totalComparisons = 0;
    let validValuePairs = 0;

    for (const otherTeam of otherTeams) {
        const otherPlayersWithValue = otherTeam.players.filter(p => p.endzone_value && p.endzone_value > 0).length;
        console.log(`[Trade Debug] ${otherTeam.team_name} has ${otherPlayersWithValue}/${otherTeam.players.length} players with Endzone Value`);

        for (const userPlayer of userTeam.players) {
            for (const otherPlayer of otherTeam.players) {
                totalComparisons++;

                if (!userPlayer.endzone_value || !otherPlayer.endzone_value ||
                    userPlayer.endzone_value <= 0 || otherPlayer.endzone_value <= 0) continue;

                validValuePairs++;

                // Adjust filtering based on fairness tier
                if (fairnessTier === 'very_strict') {
                    // For very strict: allow trades within 5% (small gains/losses)
                    const valueDifference = Math.abs(otherPlayer.endzone_value - userPlayer.endzone_value);
                    const maxValueDiff = Math.max(otherPlayer.endzone_value, userPlayer.endzone_value) * 0.05; // 5% tolerance
                    if (valueDifference > maxValueDiff) continue;
                } else {
                    // For fleece/somewhat fair: only trades where you gain
                    if (otherPlayer.endzone_value <= userPlayer.endzone_value) continue;
                }

                // Only consider trades where USER GAINS value
                if (otherPlayer.endzone_value <= userPlayer.endzone_value) {
                    continue;
                }

                // Check for position balancing opportunities
                const { teamASecondary, teamBSecondary } = findPositionBalancingPlayers(
                    userTeam, otherTeam, userPlayer, otherPlayer, fairnessTier
                );

                let trade: TradeProposal | null = null;

                if (teamASecondary && teamBSecondary) {
                    // Create multi-player position-balanced trade
                    console.log(`[Trade Debug] Creating position-balanced trade: ${userPlayer.name} + ${teamASecondary.name} ↔ ${otherPlayer.name} + ${teamBSecondary.name}`);

                    trade = createSimpleEndzoneValueTrade(
                        userTeam, [userPlayer, teamASecondary], [otherPlayer, teamBSecondary],
                        otherTeam, [otherPlayer, teamBSecondary], [userPlayer, teamASecondary],
                        '2v2_position_balanced'
                    );
                } else {
                    // Create simple 1v1 trade
                    trade = createSimpleEndzoneValueTrade(
                        userTeam, [userPlayer], [otherPlayer],
                        otherTeam, [otherPlayer], [userPlayer],
                        '1v1'
                    );
                }

                if (trade && trade.fairness_score >= min && trade.fairness_score <= max) {
                    if (trade.team_a.net_value > 0) {
                        console.log(`[Trade Debug] ✅ Trade added! Fairness: ${(trade.fairness_score * 100).toFixed(1)}%, you gain: +${trade.team_a.net_value} EV`);
                        allTrades.push(trade);
                    }
                }
            }
        }
    }

    console.log(`[Trade Debug] Summary: ${allTrades.length} trades generated`);
    return allTrades.slice(0, maxResults);
}

// Update createSimpleEndzoneValueTrade to handle multi-player trades
function createSimpleEndzoneValueTrade(
    teamA: TeamAnalysis, teamAGiving: any[], teamAReceiving: any[],
    teamB: TeamAnalysis, teamBGiving: any[], teamBReceiving: any[],
    tradeType: string
): TradeProposal | null {
    const teamAValue = teamAGiving.reduce((sum, p) => sum + (p.endzone_value || 0), 0);
    const teamBValue = teamBGiving.reduce((sum, p) => sum + (p.endzone_value || 0), 0);

    if (teamAValue === 0 || teamBValue === 0) return null;

    const fairnessScore = Math.min(teamAValue, teamBValue) / Math.max(teamAValue, teamBValue);

    // Enhanced reasoning for multi-player trades
    let reasoning: string[];
    if (teamAGiving.length > 1) {
        reasoning = [
            `You trade: ${teamAGiving.map(p => `${p.name} (${p.endzone_value || 0} EV)`).join(' + ')}`,
            `You receive: ${teamAReceiving.map(p => `${p.name} (${p.endzone_value || 0} EV)`).join(' + ')}`,
            `Total value: You give ${teamAValue} EV, get ${teamBValue} EV`,
            `Trade fairness: ${(fairnessScore * 100).toFixed(1)}%`,
            `Position balance: Cross-position trade with balanced roster needs`
        ];
    } else {
        reasoning = [
            `You trade: ${teamAGiving.map(p => `${p.name} (${p.endzone_value || 0} EV)`).join(', ')}`,
            `You receive: ${teamAReceiving.map(p => `${p.name} (${p.endzone_value || 0} EV)`).join(', ')}`,
            `Trade fairness: ${(fairnessScore * 100).toFixed(1)}%`
        ];
    }

    let fairnessTier: 'fleece' | 'somewhat_fair' | 'very_strict';
    if (fairnessScore >= 0.85) fairnessTier = 'very_strict';
    else if (fairnessScore >= 0.70) fairnessTier = 'somewhat_fair';
    else fairnessTier = 'fleece';

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
                value: p.endzone_value || 0,
                display_value: `${p.endzone_value || 0} EV` // Add explicit display format
            })),
            receiving: teamAReceiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.endzone_value || 0,
                value: p.endzone_value || 0,
                display_value: `${p.endzone_value || 0} EV` // Add explicit display format
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
                value: p.endzone_value || 0,
                display_value: `${p.endzone_value || 0} EV` // Add explicit display format
            })),
            receiving: teamBReceiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.endzone_value || 0,
                value: p.endzone_value || 0,
                display_value: `${p.endzone_value || 0} EV` // Add explicit display format
            })),
            net_value: teamAValue - teamBValue,
            addresses_needs: []
        },
        fairness_score: fairnessScore,
        fairness_tier: fairnessTier,
        trade_type: tradeType,
        reasoning: reasoning,
        need_fulfillment_score: 0.5,
        mutual_benefit: fairnessScore
    };
}

// Add this helper function for better name matching
function findADPMatch(playerName: string, adpData: Map<string, number>): number | undefined {
    if (!playerName) return undefined;

    const cleanName = playerName.toLowerCase();

    // Direct match first
    let adpRank = adpData.get(cleanName);
    if (adpRank) return adpRank;

    // Try without apostrophes/periods
    const normalized = cleanName.replace(/[''\.]/g, '');
    adpRank = adpData.get(normalized);
    if (adpRank) return adpRank;

    // Try "Last, First" format to "First Last"
    if (cleanName.includes(',')) {
        const [last, first] = cleanName.split(',').map(s => s.trim());
        adpRank = adpData.get(`${first} ${last}`);
        if (adpRank) return adpRank;
    }

    // Try partial matching on last name - Fix Map iteration
    const nameParts = cleanName.split(' ');
    if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];

        // Convert Map to Array for iteration
        for (const [adpName, rank] of Array.from(adpData.entries())) {
            const adpParts = adpName.split(' ');
            if (adpParts.length >= 2) {
                const adpFirst = adpParts[0];
                const adpLast = adpParts[adpParts.length - 1];

                if (firstName === adpFirst && lastName === adpLast) {
                    return rank;
                }
            }
        }
    }

    return undefined;
}

async function enhanceTeamsWithProjections(
    rosters: any[],
    users: any[],
    projections: { [playerId: string]: ProjectionData },
    seasonProjections: { [playerName: string]: number }, // Now mapped by name
    leagueSettings: SleeperLeagueSettings
): Promise<TeamAnalysis[]> {
    const enhancedTeams: TeamAnalysis[] = [];

    // Get all projection values for ranking
    const allProjectionValues = Object.values(seasonProjections).filter(p => p > 0);

    for (const roster of rosters) {
        const ownerId = roster.owner_id;
        const teamName = roster.metadata?.team_name ||
            users.find(user => user.user_id === ownerId)?.display_name ||
            `Team ${ownerId}`;

        // Debug: Log the first team's roster structure
        if (roster === rosters[0]) {
            console.log(`[Roster Debug] Team: ${teamName}`);
            console.log(`[Roster Debug] Players array:`, roster.players?.slice(0, 3));
            console.log(`[Roster Debug] Sample player IDs:`, roster.players?.slice(0, 3));
        }

        const players = roster.players.map((player: any, index: number) => {
            const playerId = player.player_id || player;
            const playerData = projections[playerId];

            // Match by name instead of ID
            const playerName = playerData?.longName?.toLowerCase();
            const projectedPoints = playerName ? (seasonProjections[playerName] || 0) : 0;
            const endzoneValue = calculateEndzoneValue(projectedPoints, allProjectionValues);

            // Debug: Log first 3 players from first team
            if (roster === rosters[0] && index < 3) {
                console.log(`[Endzone Debug] Player ${index + 1}:`);
                console.log(`  - Sleeper ID: ${playerId}`);
                console.log(`  - Name: "${playerData?.longName}"`);
                console.log(`  - Name (lowercase): "${playerName}"`);
                console.log(`  - Found in projections: ${!!seasonProjections[playerName || '']}`);
                console.log(`  - Projected Points: ${projectedPoints}`);
                console.log(`  - Endzone Value: ${endzoneValue}`);

                // Show similar names for debugging
                if (playerName && !seasonProjections[playerName]) {
                    const similarNames = Object.keys(seasonProjections)
                        .filter(name => name.includes(playerName.split(' ')[0]) || name.includes(playerName.split(' ')[1] || ''))
                        .slice(0, 3);
                    console.log(`  - Similar projection names:`, similarNames);
                }
            }

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

// Generate simple 1v1 and 1v2 trades
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

// Add function to analyze positional depth
function analyzePositionalDepth(team: TeamAnalysis): {
    QB: { starters: any[], depth: any[], strength: 'weak' | 'adequate' | 'strong' },
    RB: { starters: any[], depth: any[], strength: 'weak' | 'adequate' | 'strong' },
    WR: { starters: any[], depth: any[], strength: 'weak' | 'adequate' | 'strong' },
    TE: { starters: any[], depth: any[], strength: 'weak' | 'adequate' | 'strong' }
} {
    const analysis = {
        QB: { starters: [], depth: [], strength: 'adequate' as const },
        RB: { starters: [], depth: [], strength: 'adequate' as const },
        WR: { starters: [], depth: [], strength: 'adequate' as const },
        TE: { starters: [], depth: [], strength: 'adequate' as const }
    };

    ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
        const positionPlayers = team.players
            .filter(p => p.position === pos && p.endzone_value > 0)
            .sort((a, b) => (b.endzone_value || 0) - (a.endzone_value || 0));

        // Define starter thresholds based on position
        const starterThresholds = { QB: 1, RB: 2, WR: 3, TE: 1 };
        const minDepthThresholds = { QB: 2, RB: 4, WR: 5, TE: 2 };

        const starters = positionPlayers.slice(0, starterThresholds[pos]);
        const depth = positionPlayers.slice(starterThresholds[pos]);

        // Calculate strength based on starter quality and depth
        const avgStarterValue = starters.reduce((sum, p) => sum + (p.endzone_value || 0), 0) / Math.max(starters.length, 1);
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

    console.log(`[Cross-Position] Analyzing ${primaryUserPlayer.position}↔${primaryOtherPlayer.position} trade balance`);

    // Analyze depth for both teams
    const userDepth = analyzePositionalDepth(userTeam);
    const otherDepth = analyzePositionalDepth(otherTeam);

    // Check if teams can afford the positional swap
    const userGivingPos = primaryUserPlayer.position as 'RB' | 'WR';
    const otherGivingPos = primaryOtherPlayer.position as 'RB' | 'WR';

    if (userDepth[userGivingPos].strength === 'weak' || otherDepth[otherGivingPos].strength === 'weak') {
        console.log(`[Cross-Position] ❌ Trade rejected - insufficient depth (User ${userGivingPos}: ${userDepth[userGivingPos].strength}, Other ${otherGivingPos}: ${otherDepth[otherGivingPos].strength})`);
        return trades;
    }

    // Find balancing players
    // User needs to add a player from the position they're receiving
    // Other team needs to add a player from the position they're receiving
    const userBalancingCandidates = userTeam.players.filter(p =>
        p.position === otherGivingPos &&
        p.endzone_value > 0 &&
        p.player_id !== primaryUserPlayer.player_id
    ).sort((a, b) => (a.endzone_value || 0) - (b.endzone_value || 0)); // Start with lower values

    const otherBalancingCandidates = otherTeam.players.filter(p =>
        p.position === userGivingPos &&
        p.endzone_value > 0 &&
        p.player_id !== primaryOtherPlayer.player_id
    ).sort((a, b) => (a.endzone_value || 0) - (b.endzone_value || 0)); // Start with lower values

    if (userBalancingCandidates.length === 0 || otherBalancingCandidates.length === 0) {
        console.log(`[Cross-Position] ❌ No balancing players available`);
        return trades;
    }

    // Try combinations to find balanced trades
    for (const userBalancing of userBalancingCandidates.slice(0, 3)) { // Try top 3
        for (const otherBalancing of otherBalancingCandidates.slice(0, 3)) { // Try top 3
            const userTotal = (primaryUserPlayer.endzone_value || 0) + (userBalancing.endzone_value || 0);
            const otherTotal = (primaryOtherPlayer.endzone_value || 0) + (otherBalancing.endzone_value || 0);

            const fairness = Math.min(userTotal, otherTotal) / Math.max(userTotal, otherTotal);
            const userGain = otherTotal - userTotal;

            // Only consider if user gains value and trade is reasonably fair
            if (userGain > 0 && fairness >= 0.75) {
                const trade = createEndzoneValueTrade(
                    userTeam,
                    [primaryUserPlayer, userBalancing],
                    [primaryOtherPlayer, otherBalancing],
                    otherTeam,
                    [primaryOtherPlayer, otherBalancing],
                    [primaryUserPlayer, userBalancing],
                    '2v2_cross_position_balanced'
                );

                if (trade) {
                    // Add enhanced reasoning for cross-position trades
                    trade.reasoning = [
                        `Cross-position trade: ${primaryUserPlayer.position}+${userBalancing.position} ↔ ${primaryOtherPlayer.position}+${otherBalancing.position}`,
                        `Maintains positional balance for both teams`,
                        `You gain: +${userGain} EV while keeping roster depth`,
                        `Trade fairness: ${(fairness * 100).toFixed(1)}%`
                    ];

                    trades.push(trade);
                    console.log(`[Cross-Position] ✅ Balanced trade: ${primaryUserPlayer.name}+${userBalancing.name} ↔ ${primaryOtherPlayer.name}+${otherBalancing.name} (+${userGain} EV)`);
                }
            }
        }
    }

    return trades.slice(0, 2); // Return best 2 balanced cross-position trades
}

// Update generateMultiPlayerTrades to include cross-position balanced trades
function generateMultiPlayerTrades(
    userTeam: TeamAnalysis,
    otherTeams: TeamAnalysis[],
    maxResults: number
): TradeProposal[] {
    console.log(`[Multi-Player Trades] Generating up to ${maxResults} multi-player trades`);

    const allTrades: TradeProposal[] = [];

    for (const otherTeam of otherTeams) {
        // Generate cross-position balanced trades first (highest priority)
        for (const userPlayer of userTeam.players) {
            for (const otherPlayer of otherTeam.players) {
                if (!userPlayer.endzone_value || !otherPlayer.endzone_value) continue;
                if (otherPlayer.endzone_value <= userPlayer.endzone_value) continue;

                const crossPositionTrades = generateBalancedCrossPositionTrades(
                    userTeam, otherTeam, userPlayer, otherPlayer
                );
                allTrades.push(...crossPositionTrades);
            }
        }

        // Generate regular 2v2 and 3v3 trades
        const twoVTwoTrades = generate2v2Trades(userTeam, otherTeam);
        allTrades.push(...twoVTwoTrades);

        const threeVThreeTrades = generate3v3Trades(userTeam, otherTeam);
        allTrades.push(...threeVThreeTrades);
    }

    // Sort by combination of fairness and strategic value
    return allTrades
        .filter(trade => trade.team_a.net_value > 0)
        .sort((a, b) => {
            // Prioritize cross-position balanced trades
            const aIsBalanced = a.trade_type.includes('cross_position') ? 0.1 : 0;
            const bIsBalanced = b.trade_type.includes('cross_position') ? 0.1 : 0;

            const aScore = a.fairness_score * 0.6 + (a.team_a.net_value / 1000) * 0.3 + aIsBalanced;
            const bScore = b.fairness_score * 0.6 + (b.team_a.net_value / 1000) * 0.3 + bIsBalanced;
            return bScore - aScore;
        })
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
            const userValue = userPair.reduce((sum, p) => sum + p.endzone_value, 0);

            for (let x = 0; x < otherPlayers.length - 1; x++) {
                for (let y = x + 1; y < otherPlayers.length; y++) {
                    const otherPair = [otherPlayers[x], otherPlayers[y]];
                    const otherValue = otherPair.reduce((sum, p) => sum + p.endzone_value, 0);

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
                const userValue = userTriple.reduce((sum, p) => sum + p.endzone_value, 0);

                for (let x = 0; x < otherPlayers.length - 2 && combinations < maxCombinations; x++) {
                    for (let y = x + 1; y < otherPlayers.length - 1 && combinations < maxCombinations; y++) {
                        for (let z = y + 1; z < otherPlayers.length && combinations < maxCombinations; z++) {
                            combinations++;
                            const otherTriple = [otherPlayers[x], otherPlayers[y], otherPlayers[z]];
                            const otherValue = otherTriple.reduce((sum, p) => sum + p.endzone_value, 0);

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

// Simplified trade creation (no fairness tiers)
function createEndzoneValueTrade(
    teamA: TeamAnalysis, teamAGiving: any[], teamAReceiving: any[],
    teamB: TeamAnalysis, teamBGiving: any[], teamBReceiving: any[],
    tradeType: string
): TradeProposal | null {
    const teamAValue = teamAGiving.reduce((sum, p) => sum + (p.endzone_value || 0), 0);
    const teamBValue = teamBGiving.reduce((sum, p) => sum + (p.endzone_value || 0), 0);

    if (teamAValue === 0 || teamBValue === 0) return null;

    const fairnessScore = Math.min(teamAValue, teamBValue) / Math.max(teamAValue, teamBValue);

    // 🔥 SIMPLIFIED REASONING - Remove redundant information
    let reasoning: string[];

    if (tradeType.includes('cross_position')) {
        // Special reasoning for cross-position trades (set in generateBalancedCrossPositionTrades)
        reasoning = []; // Will be overridden
    } else if (teamAGiving.length > 1) {
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

