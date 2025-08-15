import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Add imports from trade suggestions
import axios from 'axios';

interface SleeperPlayer {
    player_id: string;
    full_name?: string;
    first_name: string;
    last_name: string;
    team: string | null;
    position: string | null;
    number: number | null;
    active: boolean;
    age?: number;
    injury_status?: string;
}

interface ADPPlayer {
    Name: string;
    Team: string;
    Pos: string;
    PPR?: string;
    'Bye Week'?: string;
}

// Update WaiverWirePlayer interface to include Endzone Value
interface WaiverWirePlayer {
    player_id: string;
    name: string;
    position: string;
    team: string;
    adp_rank?: number;
    endzone_value: number; // 🔥 NEW: Use same value system as trades
    projected_points: number; // 🔥 NEW: Season projection
    waiver_score: number; // Keep for compatibility
    injury_status?: string;
    bye_week?: number;
    reasons: string[];
    pickup_priority: 'must_add' | 'strong_add' | 'solid_add' | 'speculative'; // 🔥 NEW: Clear tiers
}

interface TeamNeeds {
    [position: string]: {
        priority: 'high' | 'medium' | 'low';
        count: number;
    };
}

// Add interface for league settings
interface SleeperLeagueSettings {
    roster_positions: string[];
    scoring_settings: { [key: string]: number };
    num_teams: number;
    playoff_week_start: number;
}

const waiverWireSchema = z.object({
    position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'ALL']).optional().default('ALL'),
    limit: z.number().min(1).max(50).optional().default(20),
});

export async function GET(
    request: Request,
    { params }: { params: { leagueId: string } }
) {
    try {
        const { searchParams } = new URL(request.url);
        const position = searchParams.get('position') || 'ALL';
        const limit = parseInt(searchParams.get('limit') || '20');

        const validation = waiverWireSchema.safeParse({ position, limit });
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

        console.log(`[WaiverWire] Starting analysis for league ${leagueId}`);
        const startTime = Date.now();

        // Fetch league settings, rosters, and players data in parallel
        const [leagueRes, rostersRes, playersRes] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${leagueId}`), // Add league settings fetch
            fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
            fetch(`https://api.sleeper.app/v1/players/nfl`)
        ]);

        // Check all responses
        if (!leagueRes.ok || !rostersRes.ok || !playersRes.ok) {
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch league data'
            }, { status: 502 });
        }

        const [leagueSettings, rostersData, playersData] = await Promise.all([
            leagueRes.json() as Promise<SleeperLeagueSettings>,
            rostersRes.json(),
            playersRes.json() as Promise<{ [id: string]: SleeperPlayer }>
        ]);

        console.log(`[WaiverWire] League roster positions:`, leagueSettings.roster_positions);

        // Determine valid positions based on league settings
        const validPositions = getValidPositions(leagueSettings.roster_positions);
        console.log(`[WaiverWire] Valid positions for this league:`, validPositions);

        // Get all rostered player IDs
        const rosteredPlayerIds = new Set<string>();
        rostersData.forEach((roster: any) => {
            if (roster.players) {
                roster.players.forEach((playerId: string) => {
                    rosteredPlayerIds.add(playerId);
                });
            }
        });

        console.log(`[WaiverWire] Found ${rosteredPlayerIds.size} rostered players`);

        // Analyze team needs
        const userRoster = league.rosters_json;
        const teamNeeds = analyzeTeamNeeds(userRoster, validPositions);
        console.log(`[WaiverWire] Team needs:`, teamNeeds);

        // Filter available players
        const availablePlayers: WaiverWirePlayer[] = [];

        // Load both projections and ADP data
        const [seasonProjections, adpData] = await Promise.all([
            getSeasonProjections(),
            loadADPData()
        ]);

        console.log(`[WaiverWire] Loaded ${adpData.size} ADP entries and ${Object.keys(seasonProjections).length} projections`);

        // Get all projection values for Endzone Value calculation
        const allProjectionValues = Object.values(seasonProjections).filter((p: number) => p > 0);

        // Calculate average roster Endzone Value for context
        let avgRosterEndzone = 500; // Default
        if (userRoster?.players?.length > 0) {
            const rosterProjections = userRoster.players
                .map((id: string) => {
                    const playerName = playersData[id]?.full_name?.toLowerCase();
                    return playerName ? (seasonProjections[playerName] || 0) : 0;
                })
                .filter((p: number) => p > 0);
            if (rosterProjections.length > 0) {
                const avgProjection = rosterProjections.reduce((sum: number, p: number) => sum + p, 0) / rosterProjections.length;
                avgRosterEndzone = calculateEndzoneValue(avgProjection, allProjectionValues);
            }
        }

        // Enhanced player processing
        for (const [playerId, player] of Object.entries(playersData)) {
            // Skip if player is rostered
            if (rosteredPlayerIds.has(playerId)) continue;

            // Skip if player is inactive
            if (!player.active || !player.position) continue;

            // 🔥 NEW: Skip if position is not valid for this league format
            if (!validPositions.includes(player.position)) {
                continue;
            }

            // Filter by position if specified (and position is valid)
            if (position !== 'ALL' && player.position !== position) continue;

            const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
            const adpInfo = adpData.get(playerName);
            const projectedPoints = seasonProjections[playerName.toLowerCase()] || 0;
            const endzoneValue = calculateEndzoneValue(projectedPoints, allProjectionValues);

            // Enhanced scoring
            const { score, priority } = calculateEnhancedWaiverScore(
                player, endzoneValue, projectedPoints, teamNeeds, avgRosterEndzone
            );

            // Enhanced reasons
            const reasons = generateEnhancedReasons(
                player, endzoneValue, projectedPoints, teamNeeds, priority
            );

            availablePlayers.push({
                player_id: playerId,
                name: playerName,
                position: player.position,
                team: player.team || 'FA',
                adp_rank: adpInfo?.rank,
                endzone_value: endzoneValue,
                projected_points: projectedPoints,
                waiver_score: score,
                injury_status: player.injury_status,
                bye_week: adpInfo?.byeWeek,
                reasons,
                pickup_priority: priority
            });
        }

        // Sort by waiver score (highest first)
        availablePlayers.sort((a, b) => b.waiver_score - a.waiver_score);

        // Group by priority for better display
        const groupedResults = {
            must_add: availablePlayers.filter((p: WaiverWirePlayer) => p.pickup_priority === 'must_add').slice(0, 3),
            strong_add: availablePlayers.filter((p: WaiverWirePlayer) => p.pickup_priority === 'strong_add').slice(0, 5),
            solid_add: availablePlayers.filter((p: WaiverWirePlayer) => p.pickup_priority === 'solid_add').slice(0, 10),
            speculative: availablePlayers.filter((p: WaiverWirePlayer) => p.pickup_priority === 'speculative').slice(0, 10)
        };

        const results = [
            ...groupedResults.must_add,
            ...groupedResults.strong_add,
            ...groupedResults.solid_add,
            ...groupedResults.speculative
        ].slice(0, validation.data.limit);

        const duration = Date.now() - startTime;
        console.log(`[WaiverWire] Analysis completed in ${duration}ms, returning ${results.length} players`);

        return NextResponse.json({
            success: true,
            data: {
                players: results,
                summary: {
                    total_available: availablePlayers.length,
                    must_add: groupedResults.must_add.length,
                    strong_add: groupedResults.strong_add.length,
                    solid_add: groupedResults.solid_add.length,
                    speculative: groupedResults.speculative.length,
                    avg_roster_endzone: avgRosterEndzone
                },
                team_needs: teamNeeds,
                methodology: 'endzone_value_with_projections'
            }
        });

    } catch (error: any) {
        console.error('[WaiverWire] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}

// Helper functions
async function loadADPData(): Promise<Map<string, { rank: number; byeWeek?: number; team?: string; position?: string }>> {
    const fs = await import('fs');
    const path = await import('path');

    const adpMap = new Map<string, { rank: number; byeWeek?: number; team?: string; position?: string }>();

    try {
        const adpFilePath = path.join(process.cwd(), 'data/adp/2025_sleeper_adp_ppr.csv');
        const adpContent = fs.readFileSync(adpFilePath, 'utf-8');
        const lines = adpContent.split('\n').slice(1); // Skip header

        lines.forEach((line, index) => {
            if (line.trim()) {
                const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
                if (columns.length >= 4) {
                    const name = columns[0];
                    const team = columns[1];
                    const byeWeek = parseInt(columns[2]) || undefined;
                    const position = columns[3];
                    const pprRank = columns[5]; // PPR column

                    if (name && pprRank) {
                        adpMap.set(name, {
                            rank: parseFloat(pprRank.replace(/[^\d.]/g, '')) || (index + 1),
                            byeWeek
                        });
                    }
                }
            }
        });
    } catch (error: any) {
        console.warn('[WaiverWire] Could not load ADP data:', error);
    }

    return adpMap;
}

// Add function to get season projections (same as trade suggestions)
async function getSeasonProjections(): Promise<{ [playerName: string]: number }> {
    try {
        console.log('[Waiver Wire] Fetching 2025 season projections...');

        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
        const RAPIDAPI_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

        if (!RAPIDAPI_KEY) {
            console.warn('[Waiver Wire] RAPIDAPI_KEY not configured, using ADP fallback');
            return {};
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

        console.log(`[Waiver Wire] Loaded projections for ${Object.keys(projections).length} players`);
        return projections;
    } catch (error: any) {
        console.error('[Waiver Wire] Failed to load projections:', error);
        return {};
    }
}

// Add function to calculate Endzone Value (same as trade suggestions)
function calculateEndzoneValue(projectedPoints: number, allProjections: number[]): number {
    if (projectedPoints <= 0) return 0;

    const validProjections = allProjections.filter(p => p > 0).sort((a, b) => b - a);
    const playerRank = validProjections.findIndex(p => p <= projectedPoints) + 1;

    return Math.round((validProjections.length - playerRank + 1) / validProjections.length * 1000);
}

// Enhanced waiver score calculation using Endzone Values
function calculateEnhancedWaiverScore(
    player: SleeperPlayer,
    endzoneValue: number,
    projectedPoints: number,
    teamNeeds: TeamNeeds,
    avgRosterEndzone: number = 500
): { score: number, priority: 'must_add' | 'strong_add' | 'solid_add' | 'speculative' } {

    let score = endzoneValue; // Start with Endzone Value as base

    // Position need multiplier (much more significant)
    const position = player.position;
    if (position && teamNeeds[position]) {
        const need = teamNeeds[position];
        switch (need.priority) {
            case 'high':
                score *= 1.8; // Higher multiplier for real needs
                break;
            case 'medium':
                score *= 1.3;
                break;
            case 'low':
                score *= 0.9;
                break;
        }
    }

    // Upgrade potential bonus (unrostered players with high upside)
    if (endzoneValue > avgRosterEndzone * 0.7) { // 70% of avg roster player
        score += 100; // Significant bonus for potential starters
    }

    // Team quality bonus
    const goodOffenses = ['BUF', 'KC', 'DAL', 'SF', 'MIA', 'PHI', 'CIN', 'BAL', 'DET', 'GB'];
    if (player.team && goodOffenses.includes(player.team)) {
        score += 50;
    }

    // Injury penalty
    if (player.injury_status && ['Out', 'IR', 'Doubtful'].includes(player.injury_status)) {
        score *= 0.2; // Harsh penalty for injured players
    } else if (player.injury_status === 'Questionable') {
        score *= 0.7;
    }

    // Determine pickup priority based on final score
    let priority: 'must_add' | 'strong_add' | 'solid_add' | 'speculative';
    if (score >= 800) priority = 'must_add';
    else if (score >= 600) priority = 'strong_add';
    else if (score >= 400) priority = 'solid_add';
    else priority = 'speculative';

    return { score: Math.round(score), priority };
}

// Enhanced reasons generation
function generateEnhancedReasons(
    player: SleeperPlayer,
    endzoneValue: number,
    projectedPoints: number,
    teamNeeds: TeamNeeds,
    priority: string
): string[] {
    const reasons: string[] = [];

    // Priority-based recommendation
    switch (priority) {
        case 'must_add':
            reasons.push(`🔥 Must Add: ${endzoneValue} EV player available on waivers`);
            break;
        case 'strong_add':
            reasons.push(`⭐ Strong Add: ${endzoneValue} EV with ${projectedPoints.toFixed(1)} projected points`);
            break;
        case 'solid_add':
            reasons.push(`✅ Solid Add: ${endzoneValue} EV depth/upside play`);
            break;
        case 'speculative':
            reasons.push(`💡 Speculative: ${endzoneValue} EV dart throw`);
            break;
    }

    // Position need context
    const position = player.position;
    if (position && teamNeeds[position]?.priority === 'high') {
        reasons.push(`Addresses ${position} need (${teamNeeds[position].count} currently rostered)`);
    }

    // Value context
    if (projectedPoints > 0) {
        const pointsPerGame = projectedPoints / 17;
        if (pointsPerGame >= 15) {
            reasons.push(`Elite projection: ${pointsPerGame.toFixed(1)} PPG`);
        } else if (pointsPerGame >= 10) {
            reasons.push(`Strong projection: ${pointsPerGame.toFixed(1)} PPG`);
        }
    }

    return reasons;
}

// Add helper function to determine valid positions
function getValidPositions(rosterPositions: string[]): string[] {
    const validPositions = new Set<string>();

    // Always include core positions
    validPositions.add('QB');
    validPositions.add('RB');
    validPositions.add('WR');
    validPositions.add('TE');

    // Check if league uses Kickers
    if (rosterPositions.includes('K')) {
        validPositions.add('K');
        console.log(`[WaiverWire] League uses Kickers`);
    } else {
        console.log(`[WaiverWire] League does NOT use Kickers - filtering out`);
    }

    // Check if league uses Defenses
    if (rosterPositions.includes('DEF')) {
        validPositions.add('DEF');
        console.log(`[WaiverWire] League uses Defenses`);
    } else {
        console.log(`[WaiverWire] League does NOT use Defenses - filtering out`);
    }

    return Array.from(validPositions);
}

// Update the team needs analysis to only consider valid positions
function analyzeTeamNeeds(roster: any, validPositions: string[]): TeamNeeds {
    const needs: TeamNeeds = {};

    // Initialize only valid positions
    validPositions.forEach(pos => {
        if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(pos)) {
            needs[pos] = { priority: 'low', count: 0 };
        }
    });

    if (!roster?.roster) return needs;

    // Count players by position (only valid positions)
    const positionCounts: { [key: string]: number } = {};
    validPositions.forEach(pos => {
        positionCounts[pos] = 0;
    });

    roster.roster.forEach((player: any) => {
        const pos = player.position;
        if (pos && positionCounts[pos] !== undefined) {
            positionCounts[pos] = (positionCounts[pos] || 0) + 1;
        }
    });

    // Set priorities based on counts (only for positions the league actually uses)
    if (needs.QB) {
        needs.QB.count = positionCounts.QB || 0;
        needs.QB.priority = needs.QB.count < 1 ? 'high' : needs.QB.count < 2 ? 'medium' : 'low';
    }

    if (needs.RB) {
        needs.RB.count = positionCounts.RB || 0;
        needs.RB.priority = needs.RB.count < 2 ? 'high' : needs.RB.count < 4 ? 'medium' : 'low';
    }

    if (needs.WR) {
        needs.WR.count = positionCounts.WR || 0;
        needs.WR.priority = needs.WR.count < 3 ? 'high' : needs.WR.count < 5 ? 'medium' : 'low';
    }

    if (needs.TE) {
        needs.TE.count = positionCounts.TE || 0;
        needs.TE.priority = needs.TE.count < 1 ? 'high' : needs.TE.count < 2 ? 'medium' : 'low';
    }

    // Only analyze K and DEF if the league uses them
    if (needs.K) {
        needs.K.count = positionCounts.K || 0;
        needs.K.priority = needs.K.count < 1 ? 'medium' : 'low';
    }

    if (needs.DEF) {
        needs.DEF.count = positionCounts.DEF || 0;
        needs.DEF.priority = needs.DEF.count < 1 ? 'medium' : 'low';
    }

    return needs;
}
