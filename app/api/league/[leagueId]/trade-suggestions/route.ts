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
    is_starter?: boolean; // NEW: Track if player is a starter
    replacement_value?: number; // NEW: Position-specific replacement level
}

interface SleeperLeagueSettings {
    roster_positions: string[];
    scoring_settings: { [key: string]: number };
    num_teams: number;
    playoff_week_start: number;
    // Add other relevant settings as needed
}

interface TeamAnalysis {
    team_name: string;
    owner_id: string;
    players: EnhancedPlayerValue[];
    position_counts: { [pos: string]: number };
    needs: { [pos: string]: 'high' | 'medium' | 'low' | 'surplus' };
    surplus_positions: string[];
    need_positions: string[];
    starter_slots: { [pos: string]: number }; // NEW: Required starters per position
    bench_depth: { [pos: string]: number }; // NEW: Bench depth per position
}

interface TradeProposal {
    trade_id: string;
    team_a: {
        owner_id: string;
        team_name: string;
        giving: EnhancedPlayerValue[];
        receiving: EnhancedPlayerValue[];
        net_value: number;
        addresses_needs?: string[];
    };
    team_b: {
        owner_id: string;
        team_name: string;
        giving: EnhancedPlayerValue[];
        receiving: EnhancedPlayerValue[];
        net_value: number;
        addresses_needs?: string[];
    };
    fairness_score: number;
    mutual_benefit?: number;
    trade_type?: string;
    reasoning: string[];
    need_fulfillment_score?: number;
    fairness_tier: 'low' | 'medium' | 'high'; // NEW: Fairness tier system
}

export async function GET(request: NextRequest, { params }: { params: { leagueId: string } }) {
    try {
        const url = new URL(request.url);
        const min_fairness = parseFloat(url.searchParams.get('min_fairness') || '0.3');
        const max_results = parseInt(url.searchParams.get('max_results') || '10');

        console.log(`[Enhanced Trade] Generating projection-based suggestions for league ${params.leagueId}`);

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

        // Fetch league data from Sleeper (INCLUDING league settings)
        console.log('[Enhanced Trade] Fetching league data from Sleeper...');
        const [rostersResponse, usersResponse, leagueResponse] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${params.leagueId}/rosters`),
            fetch(`https://api.sleeper.app/v1/league/${params.leagueId}/users`),
            fetch(`https://api.sleeper.app/v1/league/${params.leagueId}`) // NEW: Fetch league settings
        ]);

        const rosters = await rostersResponse.json();
        const users = await usersResponse.json();
        const leagueSettings: SleeperLeagueSettings = await leagueResponse.json(); // NEW

        console.log(`[Enhanced Trade] Found ${rosters.length} teams in league`);
        console.log(`[Enhanced Trade] League settings:`, {
            roster_positions: leagueSettings.roster_positions,
            num_teams: leagueSettings.num_teams,
            scoring: Object.keys(leagueSettings.scoring_settings || {}).length + ' rules'
        });

        // Get NFL projections
        console.log('[Enhanced Trade] Loading NFL projections...');
        const projections = await getNFLProjections();
        console.log(`[Enhanced Trade] Loaded projections for ${Object.keys(projections).length} players`);

        // Enhance team analysis with projections AND league settings
        const enhancedTeams = await enhanceTeamsWithProjections(rosters, users, projections, leagueSettings);

        // Find user's team using the sleeper username from the leagues table
        const userTeam = enhancedTeams.find(team => {
            const teamOwnerLower = team.owner_id.toLowerCase();
            const sleeperUsernameLower = sleeperUsername.toLowerCase();
            return teamOwnerLower === sleeperUsernameLower;
        });

        if (!userTeam) {
            console.log(`[Enhanced Trade] Could not find user team. Sleeper username: "${sleeperUsername}"`);
            console.log(`[Enhanced Trade] Available teams:`, enhancedTeams.map(t => `${t.team_name} (${t.owner_id})`));
            return NextResponse.json({
                error: 'Could not find your team in this league',
                details: `Looking for team with sleeper username: ${sleeperUsername}`
            }, { status: 404 });
        }

        const otherTeams = enhancedTeams.filter(team => team.owner_id !== userTeam.owner_id);

        console.log(`[Enhanced Trade] Analyzing projection-based trades for ${userTeam.team_name} vs ${otherTeams.length} other teams`);
        console.log(`[Enhanced Trade] User team needs:`, userTeam.needs);
        console.log(`[Enhanced Trade] User team surplus:`, userTeam.surplus_positions);
        console.log(`[Enhanced Trade] User team starter slots:`, userTeam.starter_slots);

        // DEBUGGING: Check if players have projected points
        const userPlayersWithPoints = userTeam.players.filter(p => p.projected_points > 0);
        console.log(`[Enhanced Trade] User players with projections: ${userPlayersWithPoints.length}/${userTeam.players.length}`);

        if (userPlayersWithPoints.length > 0) {
            console.log(`[Enhanced Trade] Sample user players:`, userPlayersWithPoints.slice(0, 3).map(p => `${p.name} (${p.position}, ${p.projected_points.toFixed(1)} pts)`));
        }

        // DEBUGGING: Check fairness tier
        console.log(`[Enhanced Trade] Fairness tier: ${fairnessTier} (requires ${fairnessTier === 'low' ? '40%' : fairnessTier === 'medium' ? '60%' : '80%'}+ fairness)`);

        // Generate smart trades based on needs and projections
        const enhancedTrades = generateEnhancedTrades(userTeam, otherTeams, fairnessTier, max_results);

        console.log(`[Enhanced Trade] Generated ${enhancedTrades.length} projection-based trades`);

        return NextResponse.json({
            success: true,
            data: {
                trade_proposals: enhancedTrades,
                total_players_analyzed: enhancedTeams.reduce((sum, team) => sum + team.players.length, 0),
                team_analyses: enhancedTeams.map(t => ({
                    team_id: t.owner_id,
                    team_name: t.team_name,
                    position_counts: t.position_counts,
                    needs: t.needs,
                    starter_slots: t.starter_slots // NEW: Include starter requirements
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
                fairness_tier: fairnessTier,
                user_team: userTeam.team_name,
                methodology: 'projection_based_with_league_context' // Updated methodology
            }
        });

    } catch (error) {
        console.error('[Enhanced Trade] Error:', error);
        return NextResponse.json({
            error: 'Failed to generate enhanced trade suggestions',
            details: error.message
        }, { status: 500 });
    }
}

// NEW: Convert fairness percentage to tier system
function getFairnessTier(min_fairness: number): 'low' | 'medium' | 'high' {
    if (min_fairness >= 0.6) return 'high';   // 60%+ = high fairness
    if (min_fairness >= 0.4) return 'medium'; // 40-59% = medium fairness  
    return 'low';                              // <40% = low fairness (more permissive)
}

// NEW: Calculate starter requirements from league roster positions
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

// NEW: Calculate replacement level for each position based on league size
function calculateReplacementLevel(position: string, leagueSize: number, starterSlots: { [pos: string]: number }): number {
    const totalStarters = leagueSize * (starterSlots[position] || 0);

    // Add FLEX consideration (assume 50% of FLEX slots go to RBs, 40% to WRs, 10% to TEs)
    let flexAdjustment = 0;
    if (position === 'RB') flexAdjustment = leagueSize * starterSlots.FLEX * 0.5;
    else if (position === 'WR') flexAdjustment = leagueSize * starterSlots.FLEX * 0.4;
    else if (position === 'TE') flexAdjustment = leagueSize * starterSlots.FLEX * 0.1;

    const adjustedStarters = totalStarters + flexAdjustment;

    // Replacement level is typically 1.5-2x the number of starters
    const replacementRank = Math.ceil(adjustedStarters * 1.75);

    console.log(`[Enhanced Trade] ${position} replacement level: rank ${replacementRank} (${adjustedStarters} starters in league)`);
    return replacementRank;
}

async function getNFLProjections(): Promise<{ [playerId: string]: ProjectionData }> {
    try {
        const response = await axios.get('https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLProjections', {
            params: {
                archiveSeason: '2025',
                pointsPerReception: 1,
                rushTD: 6,
                receivingTD: 6,
                passTD: 4
            },
            headers: {
                'x-rapidapi-host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com',
                'x-rapidapi-key': process.env.RAPIDAPI_KEY
            },
            timeout: 15000
        });

        return response.data.body.playerProjections || {};
    } catch (error) {
        console.error('[Enhanced Trade] Failed to load projections:', error);
        return {};
    }
}

async function getPlayerInfo(playerId: string): Promise<any> {
    try {
        // Get player info from Sleeper 
        const response = await fetch(`https://api.sleeper.app/v1/players/nfl/${playerId}`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error(`[Enhanced Trade] Failed to get player info for ${playerId}:`, error);
        return null;
    }
}

async function enhanceTeamsWithProjections(
    rosters: any[],
    users: any[],
    projections: { [playerId: string]: ProjectionData },
    leagueSettings: SleeperLeagueSettings // NEW: Pass league settings
): Promise<TeamAnalysis[]> {
    const enhancedTeams: TeamAnalysis[] = [];

    // Calculate league-wide starter requirements and replacement levels
    const starterSlots = calculateStarterSlots(leagueSettings.roster_positions);
    const leagueSize = leagueSettings.num_teams;

    // Get all player info in batch for better performance
    const allPlayerIds = rosters.flatMap(r => r.players || []);
    const playerInfoMap = new Map();

    // Fetch player info for all players
    console.log(`[Enhanced Trade] Fetching player info for ${allPlayerIds.length} players...`);
    for (const playerId of allPlayerIds) {
        const playerInfo = await getPlayerInfo(playerId);
        if (playerInfo) {
            playerInfoMap.set(playerId, playerInfo);
        }
    }

    for (const roster of rosters) {
        const user = users.find(u => u.user_id === roster.owner_id);
        const teamName = user?.display_name || user?.username || `Team ${roster.roster_id}`;

        const enhancedPlayers: EnhancedPlayerValue[] = [];
        const positionCounts: { [pos: string]: number } = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };

        // Process each player on the roster
        for (const playerId of roster.players || []) {
            const playerInfo = playerInfoMap.get(playerId);
            if (!playerInfo) continue;

            const projection = projections[playerId];
            let projectedPoints = 0;

            if (projection?.fantasyPointsDefault?.PPR) {
                projectedPoints = parseFloat(projection.fantasyPointsDefault.PPR);
            }

            const position = playerInfo.position || 'UNKNOWN';
            positionCounts[position] = (positionCounts[position] || 0) + 1;

            // Calculate scarcity bonus based on position and projected points
            const scarcityBonus = calculatePositionalScarcity(position, projectedPoints);

            // Calculate replacement value for this position
            const replacementLevel = calculateReplacementLevel(position, leagueSize, starterSlots);

            // Final player value combines projections + scarcity
            const finalValue = Math.max(5, projectedPoints + scarcityBonus);

            enhancedPlayers.push({
                player_id: playerId,
                name: `${playerInfo.first_name} ${playerInfo.last_name}`,
                position,
                team: playerInfo.team || 'FA',
                value: finalValue, // Keep compatible with existing frontend
                projected_points: projectedPoints,
                scarcity_bonus: scarcityBonus,
                replacement_value: replacementLevel // NEW: Store replacement level
            });
        }

        // Sort players by projected points for starter identification
        enhancedPlayers.sort((a, b) => b.projected_points - a.projected_points);

        // Identify starters vs bench players
        identifyStarters(enhancedPlayers, starterSlots);

        // Analyze team needs with league context
        const needs = analyzeTeamNeedsWithContext(enhancedPlayers, starterSlots, leagueSize);
        const surplus_positions = Object.keys(needs).filter(pos => needs[pos] === 'surplus');
        const need_positions = Object.keys(needs).filter(pos => needs[pos] === 'high');

        // Calculate bench depth
        const benchDepth: { [pos: string]: number } = {};
        Object.keys(positionCounts).forEach(pos => {
            const starters = enhancedPlayers.filter(p => p.position === pos && p.is_starter).length;
            benchDepth[pos] = positionCounts[pos] - starters;
        });

        enhancedTeams.push({
            team_name: teamName,
            owner_id: user?.username || user?.display_name || `user_${roster.owner_id}`,
            players: enhancedPlayers,
            position_counts: positionCounts,
            needs,
            surplus_positions,
            need_positions,
            starter_slots: starterSlots,
            bench_depth: benchDepth
        });
    }

    return enhancedTeams;
}

// NEW: Identify which players are starters based on league requirements
function identifyStarters(players: EnhancedPlayerValue[], starterSlots: { [pos: string]: number }): void {
    const positionGroups: { [pos: string]: EnhancedPlayerValue[] } = {};

    // Group players by position
    players.forEach(player => {
        if (!positionGroups[player.position]) {
            positionGroups[player.position] = [];
        }
        positionGroups[player.position].push(player);
    });

    // Mark top players at each position as starters
    Object.keys(starterSlots).forEach(position => {
        const requiredStarters = starterSlots[position];
        const positionPlayers = positionGroups[position] || [];

        // Sort by projected points and mark top N as starters
        positionPlayers
            .sort((a, b) => b.projected_points - a.projected_points)
            .slice(0, requiredStarters)
            .forEach(player => {
                player.is_starter = true;
            });
    });

    // Handle FLEX positions (simplified - could be more sophisticated)
    const flexCandidates = [...(positionGroups.RB || []), ...(positionGroups.WR || []), ...(positionGroups.TE || [])]
        .filter(p => !p.is_starter)
        .sort((a, b) => b.projected_points - a.projected_points);

    flexCandidates.slice(0, starterSlots.FLEX || 0).forEach(player => {
        player.is_starter = true;
    });
}

function calculatePositionalScarcity(position: string, projectedPoints: number): number {
    // Positional scarcity multipliers based on typical fantasy value
    const scarcityMultipliers = {
        QB: 0.1,  // Less scarce, many viable options
        RB: 0.3,  // High scarcity, especially top RBs  
        WR: 0.2,  // Medium scarcity
        TE: 0.4,  // Very scarce after top tier
        K: 0.05,  // Low scarcity
        DEF: 0.05 // Low scarcity
    };

    const multiplier = scarcityMultipliers[position] || 0;
    return projectedPoints * multiplier;
}

// IMPROVED: Analyze team needs with proper league context
function analyzeTeamNeedsWithContext(
    players: EnhancedPlayerValue[],
    starterSlots: { [pos: string]: number },
    leagueSize: number
): { [pos: string]: 'high' | 'medium' | 'low' | 'surplus' } {
    const needs: { [pos: string]: 'high' | 'medium' | 'low' | 'surplus' } = {};

    Object.keys(starterSlots).forEach(position => {
        if (position === 'FLEX' || position === 'SUPER_FLEX') return; // Skip FLEX for now

        const positionPlayers = players.filter(p => p.position === position);
        const starters = positionPlayers.filter(p => p.is_starter);
        const requiredStarters = starterSlots[position] || 0;

        if (requiredStarters === 0) {
            needs[position] = 'low';
            return;
        }

        // Calculate starter quality vs replacement level
        const starterQuality = starters.reduce((sum, p) => sum + p.projected_points, 0) / Math.max(1, starters.length);
        const replacementLevel = calculateReplacementLevel(position, leagueSize, starterSlots);

        // Determine need level based on multiple factors
        if (starters.length < requiredStarters) {
            needs[position] = 'high'; // Missing required starters
        } else if (starters.length === requiredStarters && starterQuality < replacementLevel * 0.8) {
            needs[position] = 'high'; // Have starters but they're below replacement level
        } else if (positionPlayers.length > requiredStarters + 2) {
            needs[position] = 'surplus'; // Have excess depth
        } else if (positionPlayers.length === requiredStarters + 1) {
            needs[position] = 'medium'; // Minimal depth
        } else {
            needs[position] = 'low'; // Adequate starters and depth
        }
    });

    return needs;
}

function generateEnhancedTrades(
    userTeam: TeamAnalysis,
    otherTeams: TeamAnalysis[],
    fairnessTier: 'low' | 'medium' | 'high',
    maxResults: number
): TradeProposal[] {
    const allTrades: TradeProposal[] = [];

    console.log(`[Enhanced Trade] === DEBUGGING TRADE GENERATION ===`);
    console.log(`[Enhanced Trade] User team: ${userTeam.team_name}`);
    console.log(`[Enhanced Trade] User surplus positions: [${userTeam.surplus_positions.join(', ')}]`);
    console.log(`[Enhanced Trade] User need positions: [${userTeam.need_positions.join(', ')}]`);
    console.log(`[Enhanced Trade] Fairness tier required: ${fairnessTier}`);
    console.log(`[Enhanced Trade] Processing ${otherTeams.length} other teams`);

    for (const otherTeam of otherTeams) {
        console.log(`[Enhanced Trade] --- Analyzing vs ${otherTeam.team_name} ---`);
        console.log(`[Enhanced Trade] ${otherTeam.team_name} surplus: [${otherTeam.surplus_positions.join(', ')}]`);
        console.log(`[Enhanced Trade] ${otherTeam.team_name} needs: [${otherTeam.need_positions.join(', ')}]`);

        // Look for complementary needs - you give surplus, get need
        const userGivingPositions = userTeam.surplus_positions.filter(pos => otherTeam.need_positions.includes(pos));
        const userGettingPositions = otherTeam.surplus_positions.filter(pos => userTeam.need_positions.includes(pos));

        console.log(`[Enhanced Trade] User giving to ${otherTeam.team_name}: [${userGivingPositions.join(', ')}]`);
        console.log(`[Enhanced Trade] User getting from ${otherTeam.team_name}: [${userGettingPositions.join(', ')}]`);

        if (userGivingPositions.length === 0 && userGettingPositions.length === 0) {
            console.log(`[Enhanced Trade] No complementary needs found, trying all position combos`);

            // Try regular trades even without perfect need matches
            const allPositions = ['QB', 'RB', 'WR', 'TE'];

            for (const pos1 of allPositions) {
                for (const pos2 of allPositions) {
                    if (pos1 === pos2) continue;

                    const userPlayers = userTeam.players.filter(p => p.position === pos1).slice(0, 2);
                    const otherPlayers = otherTeam.players.filter(p => p.position === pos2).slice(0, 2);

                    console.log(`[Enhanced Trade] Trying ${pos1} for ${pos2}: ${userPlayers.length} vs ${otherPlayers.length} players`);

                    for (const userPlayer of userPlayers) {
                        for (const otherPlayer of otherPlayers) {
                            const trade = createEnhancedTrade(
                                userTeam, [userPlayer], [otherPlayer],
                                otherTeam, [otherPlayer], [userPlayer],
                                '1v1'
                            );

                            if (trade) {
                                console.log(`[Enhanced Trade] Created trade: ${userPlayer.name} for ${otherPlayer.name} (fairness: ${(trade.fairness_score * 100).toFixed(1)}%)`);

                                if (isTradeInFairnessTier(trade, fairnessTier)) {
                                    console.log(`[Enhanced Trade] ✅ Trade meets ${fairnessTier} fairness requirement`);
                                    allTrades.push(trade);
                                } else {
                                    console.log(`[Enhanced Trade] ❌ Trade fails ${fairnessTier} fairness requirement`);
                                }
                            } else {
                                console.log(`[Enhanced Trade] ❌ Failed to create trade between ${userPlayer.name} and ${otherPlayer.name}`);
                            }
                        }
                    }
                }
            }
            continue;
        }

        console.log(`[Enhanced Trade] Found complementary needs, generating need-based trades`);

        // Generate need-based trades
        for (const givingPos of userGivingPositions) {
            for (const gettingPos of userGettingPositions) {
                const userGivingPlayers = userTeam.players.filter(p => p.position === givingPos);
                const otherGivingPlayers = otherTeam.players.filter(p => p.position === gettingPos);

                console.log(`[Enhanced Trade] Need-based: ${givingPos} for ${gettingPos} (${userGivingPlayers.length} vs ${otherGivingPlayers.length} players)`);

                for (const userPlayer of userGivingPlayers.slice(0, 3)) {
                    for (const otherPlayer of otherGivingPlayers.slice(0, 3)) {
                        const trade = createEnhancedTrade(
                            userTeam, [userPlayer], [otherPlayer],
                            otherTeam, [otherPlayer], [userPlayer],
                            '1v1'
                        );

                        if (trade) {
                            console.log(`[Enhanced Trade] Need-based trade: ${userPlayer.name} for ${otherPlayer.name} (fairness: ${(trade.fairness_score * 100).toFixed(1)}%)`);

                            if (isTradeInFairnessTier(trade, fairnessTier)) {
                                console.log(`[Enhanced Trade] ✅ Need-based trade meets ${fairnessTier} fairness requirement`);
                                allTrades.push(trade);
                            } else {
                                console.log(`[Enhanced Trade] ❌ Need-based trade fails ${fairnessTier} fairness requirement`);
                            }
                        }
                    }
                }
            }
        }
    }

    console.log(`[Enhanced Trade] === TRADE GENERATION COMPLETE ===`);
    console.log(`[Enhanced Trade] Total trades generated: ${allTrades.length}`);

    // Sort by combination of fairness and need fulfillment
    return allTrades
        .sort((a, b) => {
            const aScore = a.fairness_score * 0.7 + (a.need_fulfillment_score || 0) * 0.3;
            const bScore = b.fairness_score * 0.7 + (b.need_fulfillment_score || 0) * 0.3;
            return bScore - aScore;
        })
        .slice(0, maxResults);
}

function createEnhancedTrade(
    teamA: TeamAnalysis, teamAGiving: EnhancedPlayerValue[], teamAReceiving: EnhancedPlayerValue[],
    teamB: TeamAnalysis, teamBGiving: EnhancedPlayerValue[], teamBReceiving: EnhancedPlayerValue[],
    tradeType: string
): TradeProposal | null {
    const teamAValue = teamAGiving.reduce((sum, p) => sum + p.value, 0);
    const teamBValue = teamBGiving.reduce((sum, p) => sum + p.value, 0);

    if (teamAValue === 0 || teamBValue === 0) return null;

    const fairnessScore = Math.min(teamAValue, teamBValue) / Math.max(teamAValue, teamBValue);

    // Calculate need fulfillment score
    const teamAAddressedNeeds = teamAReceiving.filter(p => teamA.need_positions.includes(p.position)).map(p => p.position);
    const teamBAddressedNeeds = teamBReceiving.filter(p => teamB.need_positions.includes(p.position)).map(p => p.position);

    const needFulfillmentScore = Math.min(1, (teamAAddressedNeeds.length + teamBAddressedNeeds.length) / 2);

    const reasoning = [];
    reasoning.push(`${teamA.team_name} trades ${teamAGiving.map(p => `${p.name} (${p.projected_points.toFixed(1)} pts)`).join(', ')}`);
    reasoning.push(`${teamB.team_name} trades ${teamBGiving.map(p => `${p.name} (${p.projected_points.toFixed(1)} pts)`).join(', ')}`);

    if (teamAAddressedNeeds.length > 0) {
        reasoning.push(`${teamA.team_name} fills ${teamAAddressedNeeds.join(', ')} need(s)`);
    }
    if (teamBAddressedNeeds.length > 0) {
        reasoning.push(`${teamB.team_name} fills ${teamBAddressedNeeds.join(', ')} need(s)`);
    }

    // Determine fairness tier
    let fairnessTier: 'low' | 'medium' | 'high';
    if (fairnessScore >= 0.8) fairnessTier = 'high';
    else if (fairnessScore >= 0.6) fairnessTier = 'medium';
    else fairnessTier = 'low';

    return {
        trade_id: `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        team_a: {
            owner_id: teamA.owner_id,
            team_name: teamA.team_name,
            giving: teamAGiving,
            receiving: teamAReceiving,
            net_value: teamBValue - teamAValue,
            addresses_needs: teamAAddressedNeeds
        },
        team_b: {
            owner_id: teamB.owner_id,
            team_name: teamB.team_name,
            giving: teamBGiving,
            receiving: teamBReceiving,
            net_value: teamAValue - teamBValue,
            addresses_needs: teamBAddressedNeeds
        },
        fairness_score: fairnessScore,
        mutual_benefit: needFulfillmentScore,
        trade_type: tradeType,
        reasoning,
        need_fulfillment_score: needFulfillmentScore,
        fairness_tier: fairnessTier
    };
}

// NEW: Check if trade meets fairness tier requirements
function isTradeInFairnessTier(trade: TradeProposal, requiredTier: 'low' | 'medium' | 'high'): boolean {
    const tierValues = { low: 0.4, medium: 0.6, high: 0.8 };
    return trade.fairness_score >= tierValues[requiredTier];
}
