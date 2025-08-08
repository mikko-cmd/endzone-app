import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface SleeperPlayer {
    player_id: string;
    full_name?: string;
    first_name: string;
    last_name: string;
    team: string | null;
    position: string | null;
    active: boolean;
}

interface PlayerProjection {
    player_id: string;
    week: number;
    pts_ppr?: number;
    pts_half_ppr?: number;
    pts_std?: number;
}

interface PlayerValue {
    player_id: string;
    name: string;
    position: string;
    team: string;
    current_owner: string;
    trade_value: number;
    weekly_projection: number;
    season_projection: number;
    adp_rank?: number;
    reasons: string[];
}

interface TeamAnalysis {
    owner_id: string;
    team_name: string;
    strengths: string[];
    weaknesses: string[];
    surplus_positions: string[];
    needed_positions: string[];
    overall_score: number;
}

interface TradeProposal {
    trade_id: string;
    team_a: {
        owner_id: string;
        team_name: string;
        giving: PlayerValue[];
        receiving: PlayerValue[];
        net_value: number;
    };
    team_b: {
        owner_id: string;
        team_name: string;
        giving: PlayerValue[];
        receiving: PlayerValue[];
        net_value: number;
    };
    fairness_score: number;
    mutual_benefit: number;
    reasoning: string[];
}

const tradeFinderSchema = z.object({
    focus_team: z.string().optional(),
    min_fairness: z.number().min(0.1).max(1.0).optional().default(0.4), // Changed from min(0.6) to min(0.1) and default from 0.7 to 0.4
    max_results: z.number().min(1).max(20).optional().default(10),
});

export async function GET(
    request: Request,
    { params }: { params: { leagueId: string } }
) {
    try {
        const { searchParams } = new URL(request.url);
        const focusTeam = searchParams.get('focus_team') || undefined;
        const minFairness = parseFloat(searchParams.get('min_fairness') || '0.4'); // Changed from 0.7 to 0.4
        const maxResults = parseInt(searchParams.get('max_results') || '10');

        const validation = tradeFinderSchema.safeParse({
            focus_team: focusTeam,
            min_fairness: minFairness,
            max_results: maxResults,
        });

        if (!validation.success) {
            return NextResponse.json({
                success: false,
                error: 'Invalid query parameters',
                details: validation.error.flatten()
            }, { status: 400 });
        }

        const { leagueId } = params;
        const supabase = createClient();

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Verify league access
        const { data: league, error: leagueError } = await supabase
            .from('leagues')
            .select('*')
            .eq('sleeper_league_id', leagueId)
            .eq('user_email', user.email)
            .single();

        if (leagueError || !league) {
            return NextResponse.json({
                success: false,
                error: 'League not found or access denied.'
            }, { status: 404 });
        }

        console.log(`[TradeFinder] Starting analysis for league ${leagueId}`);
        const startTime = Date.now();

        // Fetch league data from Sleeper
        const [rostersRes, usersRes, playersRes] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
            fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
            fetch(`https://api.sleeper.app/v1/players/nfl`)
        ]);

        if (!rostersRes.ok || !usersRes.ok || !playersRes.ok) {
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch league data from Sleeper'
            }, { status: 502 });
        }

        const [rostersData, usersData, playersData] = await Promise.all([
            rostersRes.json(),
            usersRes.json(),
            playersRes.json()
        ]);

        console.log(`[TradeFinder] Fetched league data: ${rostersData.length} rosters, ${usersData.length} users`);

        // Load ADP data
        const adpData = await loadADPData();

        // Fetch current week projections (Week 1 and 2 available)
        const currentWeekProjections = await fetchWeeklyProjections(2025, 1);
        const nextWeekProjections = await fetchWeeklyProjections(2025, 2);

        console.log(`[TradeFinder] Loaded ${currentWeekProjections.size} Week 1 projections, ${nextWeekProjections.size} Week 2 projections`);

        // Identify user's team using their sleeper_username
        let userTeamId: string | undefined;
        if (league.sleeper_username) {
            const userInSleeper = usersData.find((user: any) =>
                user.display_name === league.sleeper_username ||
                user.username === league.sleeper_username
            );
            if (userInSleeper) {
                const userRoster = rostersData.find((roster: any) => roster.owner_id === userInSleeper.user_id);
                if (userRoster) {
                    userTeamId = userRoster.owner_id;
                    console.log(`[TradeFinder] Found user team: ${userInSleeper.display_name} (${userTeamId})`);
                } else {
                    console.warn(`[TradeFinder] Found user in league but no roster: ${userInSleeper.display_name}`);
                }
            } else {
                console.warn(`[TradeFinder] Could not find user in league with username: ${league.sleeper_username}`);
            }
        } else {
            console.warn(`[TradeFinder] No sleeper_username stored for this league`);
        }

        // Analyze all teams
        const teamAnalyses = analyzeAllTeams(rostersData, usersData, playersData, adpData, currentWeekProjections);
        console.log(`[TradeFinder] Analyzed ${teamAnalyses.length} teams`);

        // Calculate player values for all rostered players
        const playerValues = calculatePlayerValues(rostersData, usersData, playersData, adpData, currentWeekProjections, nextWeekProjections);
        console.log(`[TradeFinder] Calculated values for ${playerValues.length} players`);

        // Generate trade proposals focused on user's team
        const tradeProposals = generateTradeProposals(teamAnalyses, playerValues, validation.data, userTeamId);
        console.log(`[TradeFinder] Generated ${tradeProposals.length} user-focused trade proposals`);

        const duration = Date.now() - startTime;
        console.log(`[TradeFinder] Analysis completed in ${duration}ms`);

        return NextResponse.json({
            success: true,
            data: {
                trade_proposals: tradeProposals,
                team_analyses: teamAnalyses,
                total_players_analyzed: playerValues.length,
                analysis: {
                    duration,
                    week_1_projections: currentWeekProjections.size,
                    week_2_projections: nextWeekProjections.size,
                    focus_team: focusTeam,
                    fairness_threshold: validation.data.min_fairness
                }
            }
        });

    } catch (error: any) {
        console.error('[TradeFinder] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}

// Helper functions
async function loadADPData(): Promise<Map<string, { rank: number; position: string }>> {
    const fs = await import('fs');
    const path = await import('path');

    const adpMap = new Map();

    try {
        const adpFilePath = path.join(process.cwd(), 'data/adp/2025_sleeper_adp_ppr.csv');
        const adpContent = fs.readFileSync(adpFilePath, 'utf-8');
        const lines = adpContent.split('\n').slice(1);

        lines.forEach((line, index) => {
            if (line.trim()) {
                const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
                if (columns.length >= 4) {
                    const name = columns[0];
                    const position = columns[3];
                    const pprRank = columns[5];

                    if (name && pprRank) {
                        adpMap.set(name, {
                            rank: parseFloat(pprRank.replace(/[^\d.]/g, '')) || (index + 1),
                            position
                        });
                    }
                }
            }
        });
    } catch (error) {
        console.warn('[TradeFinder] Could not load ADP data:', error);
    }

    return adpMap;
}

async function fetchWeeklyProjections(season: number, week: number): Promise<Map<string, number>> {
    const projectionMap = new Map();

    try {
        // Try to fetch weekly projections for each position
        const positions = ['QB', 'RB', 'WR', 'TE'];

        for (const position of positions) {
            try {
                const response = await fetch(
                    `https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular&position[]=${position}`,
                    { cache: 'no-store' }
                );

                if (response.ok) {
                    const projections = await response.json();

                    if (Array.isArray(projections)) {
                        projections.forEach((proj: any) => {
                            if (proj.player_id && proj.stats?.pts_ppr) {
                                projectionMap.set(proj.player_id, proj.stats.pts_ppr);
                            }
                        });
                    } else if (typeof projections === 'object') {
                        // Handle different response format
                        Object.entries(projections).forEach(([playerId, data]: [string, any]) => {
                            if (data?.stats?.pts_ppr) {
                                projectionMap.set(playerId, data.stats.pts_ppr);
                            }
                        });
                    }
                }
            } catch (positionError) {
                console.warn(`[TradeFinder] Error fetching ${position} projections:`, positionError);
            }
        }
    } catch (error) {
        console.warn(`[TradeFinder] Error fetching Week ${week} projections:`, error);
    }

    return projectionMap;
}

function analyzeAllTeams(
    rosters: any[],
    users: any[],
    players: any,
    adpData: Map<string, any>,
    projections: Map<string, number>
): TeamAnalysis[] {
    const analyses: TeamAnalysis[] = [];

    rosters.forEach(roster => {
        const user = users.find(u => u.user_id === roster.owner_id);
        const teamName = user?.display_name || `Team ${roster.roster_id}`;

        // Count players by position
        const positionCounts: { [pos: string]: number } = {};
        const positionValues: { [pos: string]: number } = {};
        let totalValue = 0;

        roster.players?.forEach((playerId: string) => {
            const player = players[playerId];
            if (player?.position) {
                positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;

                // Calculate position value using projections + ADP
                const projection = projections.get(playerId) || 0;
                const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
                const adpInfo = adpData.get(playerName);
                const adpValue = adpInfo ? Math.max(0, 200 - adpInfo.rank) : 50;
                const playerValue = projection * 10 + adpValue;

                positionValues[player.position] = (positionValues[player.position] || 0) + playerValue;
                totalValue += playerValue;
            }
        });

        // Determine strengths and weaknesses
        const strengths: string[] = [];
        const weaknesses: string[] = [];
        const surplus: string[] = [];
        const needed: string[] = [];

        // Ideal roster construction (adjustable)
        const idealCounts = { QB: 2, RB: 4, WR: 5, TE: 2 };

        Object.entries(idealCounts).forEach(([position, ideal]) => {
            const current = positionCounts[position] || 0;
            const avgValue = positionValues[position] ? positionValues[position] / current : 0;

            if (current > ideal && avgValue > 100) {
                surplus.push(position);
                strengths.push(`Deep at ${position}`);
            } else if (current < ideal - 1) {
                needed.push(position);
                weaknesses.push(`Weak at ${position}`);
            } else if (avgValue > 150) {
                strengths.push(`Strong ${position} corps`);
            }
        });

        analyses.push({
            owner_id: roster.owner_id,
            team_name: teamName,
            strengths,
            weaknesses,
            surplus_positions: surplus,
            needed_positions: needed,
            overall_score: totalValue
        });
    });

    return analyses;
}

function calculatePlayerValues(
    rosters: any[],
    users: any[],
    players: any,
    adpData: Map<string, any>,
    week1Projections: Map<string, number>,
    week2Projections: Map<string, number>
): PlayerValue[] {
    const values: PlayerValue[] = [];

    // Create owner lookup
    const ownerLookup = new Map();
    rosters.forEach(roster => {
        const user = users.find(u => u.user_id === roster.owner_id);
        const teamName = user?.display_name || `Team ${roster.roster_id}`;

        roster.players?.forEach((playerId: string) => {
            ownerLookup.set(playerId, { owner_id: roster.owner_id, team_name: teamName });
        });
    });

    // Calculate values for all rostered players
    ownerLookup.forEach((ownerInfo, playerId) => {
        const player = players[playerId];
        if (!player?.position) return;

        const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
        const adpInfo = adpData.get(playerName);

        // Get projections
        const week1Proj = week1Projections.get(playerId) || 0;
        const week2Proj = week2Projections.get(playerId) || 0;
        const avgWeeklyProj = week1Proj > 0 || week2Proj > 0 ? (week1Proj + week2Proj) / 2 : 8; // Default 8 points if no projections

        // Calculate season projection (17 weeks)
        const seasonProjection = avgWeeklyProj * 17;

        // Calculate trade value (combination of projections and ADP)
        const adpValue = adpInfo ? Math.max(0, 300 - adpInfo.rank) : 50;
        const projectionValue = avgWeeklyProj * 15; // Weight weekly projection heavily
        const tradeValue = Math.round(projectionValue + (adpValue * 0.3));

        // Generate reasoning
        const reasons: string[] = [];
        if (week1Proj > 15 || week2Proj > 15) reasons.push('High weekly projection');
        if (adpInfo?.rank && adpInfo.rank <= 50) reasons.push(`High draft capital (ADP ${adpInfo.rank})`);
        if (avgWeeklyProj < 5) reasons.push('Low projection value');
        if (!week1Proj && !week2Proj) reasons.push('Limited projection data');

        values.push({
            player_id: playerId,
            name: playerName,
            position: player.position,
            team: player.team || 'FA',
            current_owner: ownerInfo.team_name,
            trade_value: tradeValue,
            weekly_projection: Math.round(avgWeeklyProj * 10) / 10,
            season_projection: Math.round(seasonProjection),
            adp_rank: adpInfo?.rank,
            reasons: reasons.length > 0 ? reasons : ['Standard trade value']
        });
    });

    return values.sort((a, b) => b.trade_value - a.trade_value);
}

function generateTradeProposals(
    teamAnalyses: TeamAnalysis[],
    playerValues: PlayerValue[],
    options: { focus_team?: string; min_fairness: number; max_results: number },
    userTeamId?: string
): TradeProposal[] {
    const proposals: TradeProposal[] = [];

    // Group players by owner
    const playersByOwner = new Map<string, PlayerValue[]>();
    playerValues.forEach(player => {
        const ownerId = teamAnalyses.find(t => t.team_name === player.current_owner)?.owner_id;
        if (ownerId) {
            if (!playersByOwner.has(ownerId)) {
                playersByOwner.set(ownerId, []);
            }
            playersByOwner.get(ownerId)!.push(player);
        }
    });

    console.log(`[TradeFinder] User team ID: ${userTeamId}`);
    console.log(`[TradeFinder] Analyzing ${teamAnalyses.length} teams for user-focused trades`);

    // Find the user's team
    const userTeam = teamAnalyses.find(team => team.owner_id === userTeamId);
    if (!userTeam) {
        console.log(`[TradeFinder] Could not find user team with ID: ${userTeamId}, falling back to all trades`);
        // Fallback to original logic if user team not found
        return generateAllTeamTrades(teamAnalyses, playersByOwner, options);
    }

    console.log(`[TradeFinder] Found user team: ${userTeam.team_name}`);

    // Only generate trades between user's team and other teams
    teamAnalyses.forEach(otherTeam => {
        // Skip if it's the same team
        if (otherTeam.owner_id === userTeamId) {
            return;
        }

        const userPlayers = playersByOwner.get(userTeam.owner_id) || [];
        const otherPlayers = playersByOwner.get(otherTeam.owner_id) || [];

        console.log(`[TradeFinder] ${userTeam.team_name} has ${userPlayers.length} players, ${otherTeam.team_name} has ${otherPlayers.length} players`);

        // Consider ALL position combinations
        ['QB', 'RB', 'WR', 'TE'].forEach(userPosition => {
            ['QB', 'RB', 'WR', 'TE'].forEach(otherPosition => {
                const userOptions = userPlayers
                    .filter(p => p.position === userPosition && p.trade_value > 20)
                    .sort((a, b) => b.trade_value - a.trade_value)
                    .slice(0, 5);

                const otherOptions = otherPlayers
                    .filter(p => p.position === otherPosition && p.trade_value > 20)
                    .sort((a, b) => b.trade_value - a.trade_value)
                    .slice(0, 5);

                // Generate trade combinations
                userOptions.forEach(userPlayer => {
                    otherOptions.forEach(otherPlayer => {
                        const valueDiff = Math.abs(userPlayer.trade_value - otherPlayer.trade_value);
                        const avgValue = (userPlayer.trade_value + otherPlayer.trade_value) / 2;
                        const fairnessScore = avgValue > 0 ? 1 - (valueDiff / avgValue) : 0;

                        if (fairnessScore >= options.min_fairness && avgValue >= 50) {
                            const tradeId = `${userTeam.owner_id}-${otherTeam.owner_id}-${userPlayer.player_id}-${otherPlayer.player_id}`;

                            // Generate reasoning focused on user's team
                            const reasoning: string[] = [];

                            // Check if this addresses user's team needs
                            if (userTeam.needed_positions.includes(otherPosition)) {
                                reasoning.push(`You need ${otherPosition} depth`);
                            }
                            if (userTeam.surplus_positions.includes(userPosition)) {
                                reasoning.push(`You have surplus ${userPosition}`);
                            }
                            if (otherTeam.needed_positions.includes(userPosition)) {
                                reasoning.push(`${otherTeam.team_name} needs ${userPosition}`);
                            }
                            if (otherTeam.surplus_positions.includes(otherPosition)) {
                                reasoning.push(`${otherTeam.team_name} has surplus ${otherPosition}`);
                            }

                            // Add value reasoning from user's perspective
                            if (fairnessScore >= 0.9) {
                                reasoning.push('Very fair value exchange');
                            } else if (fairnessScore >= 0.7) {
                                reasoning.push('Reasonably fair trade');
                            } else if (userPlayer.trade_value > otherPlayer.trade_value) {
                                reasoning.push('You\'re giving up more value - consider asking for an add');
                            } else {
                                reasoning.push('You\'re getting good value in this trade');
                            }

                            // Default reasoning if none found
                            if (reasoning.length === 0) {
                                reasoning.push(`Your ${userPosition} for their ${otherPosition}`);
                            }

                            proposals.push({
                                trade_id: tradeId,
                                team_a: {
                                    owner_id: userTeam.owner_id,
                                    team_name: `${userTeam.team_name} (YOU)`,
                                    giving: [userPlayer],
                                    receiving: [otherPlayer],
                                    net_value: otherPlayer.trade_value - userPlayer.trade_value
                                },
                                team_b: {
                                    owner_id: otherTeam.owner_id,
                                    team_name: otherTeam.team_name,
                                    giving: [otherPlayer],
                                    receiving: [userPlayer],
                                    net_value: userPlayer.trade_value - otherPlayer.trade_value
                                },
                                fairness_score: Math.round(fairnessScore * 100) / 100,
                                mutual_benefit: calculateMutualBenefit(userTeam, otherTeam, userPlayer, otherPlayer),
                                reasoning
                            });
                        }
                    });
                });
            });
        });
    });

    console.log(`[TradeFinder] Generated ${proposals.length} user-focused proposals before sorting`);

    // Sort by fairness score and mutual benefit, return top results
    const sortedProposals = proposals
        .sort((a, b) => (b.fairness_score + b.mutual_benefit) - (a.fairness_score + a.mutual_benefit))
        .slice(0, options.max_results);

    console.log(`[TradeFinder] Returning top ${sortedProposals.length} user-focused proposals`);

    return sortedProposals;
}

// Fallback function for when user team can't be identified
function generateAllTeamTrades(
    teamAnalyses: TeamAnalysis[],
    playersByOwner: Map<string, PlayerValue[]>,
    options: { focus_team?: string; min_fairness: number; max_results: number }
): TradeProposal[] {
    // This is the original logic as a fallback
    const proposals: TradeProposal[] = [];

    teamAnalyses.forEach((teamA, indexA) => {
        teamAnalyses.slice(indexA + 1).forEach(teamB => {
            const teamAPlayers = playersByOwner.get(teamA.owner_id) || [];
            const teamBPlayers = playersByOwner.get(teamB.owner_id) || [];

            ['QB', 'RB', 'WR', 'TE'].forEach(positionA => {
                ['QB', 'RB', 'WR', 'TE'].forEach(positionB => {
                    const teamAOptions = teamAPlayers
                        .filter(p => p.position === positionA && p.trade_value > 20)
                        .sort((a, b) => b.trade_value - a.trade_value)
                        .slice(0, 3);

                    const teamBOptions = teamBPlayers
                        .filter(p => p.position === positionB && p.trade_value > 20)
                        .sort((a, b) => b.trade_value - a.trade_value)
                        .slice(0, 3);

                    teamAOptions.forEach(playerA => {
                        teamBOptions.forEach(playerB => {
                            const valueDiff = Math.abs(playerA.trade_value - playerB.trade_value);
                            const avgValue = (playerA.trade_value + playerB.trade_value) / 2;
                            const fairnessScore = avgValue > 0 ? 1 - (valueDiff / avgValue) : 0;

                            if (fairnessScore >= options.min_fairness && avgValue >= 50) {
                                proposals.push({
                                    trade_id: `${teamA.owner_id}-${teamB.owner_id}-${playerA.player_id}-${playerB.player_id}`,
                                    team_a: {
                                        owner_id: teamA.owner_id,
                                        team_name: teamA.team_name,
                                        giving: [playerA],
                                        receiving: [playerB],
                                        net_value: playerB.trade_value - playerA.trade_value
                                    },
                                    team_b: {
                                        owner_id: teamB.owner_id,
                                        team_name: teamB.team_name,
                                        giving: [playerB],
                                        receiving: [playerA],
                                        net_value: playerA.trade_value - playerB.trade_value
                                    },
                                    fairness_score: Math.round(fairnessScore * 100) / 100,
                                    mutual_benefit: calculateMutualBenefit(teamA, teamB, playerA, playerB),
                                    reasoning: [`${positionA} for ${positionB} swap between teams`]
                                });
                            }
                        });
                    });
                });
            });
        });
    });

    return proposals
        .sort((a, b) => (b.fairness_score + b.mutual_benefit) - (a.fairness_score + a.mutual_benefit))
        .slice(0, options.max_results);
}

function calculateMutualBenefit(teamA: TeamAnalysis, teamB: TeamAnalysis, playerA: PlayerValue, playerB: PlayerValue): number {
    let benefit = 0;

    // Benefit from addressing needs
    if (teamA.needed_positions.includes(playerB.position)) benefit += 0.3;
    if (teamB.needed_positions.includes(playerA.position)) benefit += 0.3;

    // Benefit from reducing surplus
    if (teamA.surplus_positions.includes(playerA.position)) benefit += 0.2;
    if (teamB.surplus_positions.includes(playerB.position)) benefit += 0.2;

    return Math.round(benefit * 100) / 100;
}
