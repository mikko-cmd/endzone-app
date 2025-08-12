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

interface WaiverWirePlayer {
    player_id: string;
    name: string;
    position: string;
    team: string;
    adp_rank?: number;
    waiver_score: number;
    injury_status?: string;
    bye_week?: number;
    reasons: string[];
}

interface TeamNeeds {
    [position: string]: {
        priority: 'high' | 'medium' | 'low';
        count: number;
    };
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

        // Fetch all league rosters from Sleeper
        const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
        if (!rostersRes.ok) {
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch league rosters'
            }, { status: 502 });
        }
        const rostersData = await rostersRes.json();

        // Fetch all NFL players from Sleeper
        const playersRes = await fetch(`https://api.sleeper.app/v1/players/nfl`);
        if (!playersRes.ok) {
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch NFL players'
            }, { status: 502 });
        }
        const playersData: { [id: string]: SleeperPlayer } = await playersRes.json();

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

        // Load ADP data
        const adpData = await loadADPData();
        console.log(`[WaiverWire] Loaded ${adpData.size} ADP entries`);

        // Analyze team needs
        const userRoster = league.rosters_json;
        const teamNeeds = analyzeTeamNeeds(userRoster);
        console.log(`[WaiverWire] Team needs:`, teamNeeds);

        // Filter available players
        const availablePlayers: WaiverWirePlayer[] = [];

        for (const [playerId, player] of Object.entries(playersData)) {
            // Skip if player is rostered
            if (rosteredPlayerIds.has(playerId)) continue;

            // Skip if player is inactive or not in a relevant position
            if (!player.active || !player.position) continue;
            if (!['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(player.position)) continue;

            // Filter by position if specified
            if (position !== 'ALL' && player.position !== position) continue;

            const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
            const adpInfo = adpData.get(playerName);

            // Calculate waiver score
            const waiverScore = calculateWaiverScore(player, adpInfo, teamNeeds);

            // Generate recommendations reasons
            const reasons = generateReasons(player, adpInfo, teamNeeds);

            availablePlayers.push({
                player_id: playerId,
                name: playerName,
                position: player.position,
                team: player.team || 'FA',
                adp_rank: adpInfo?.rank,
                waiver_score: waiverScore,
                injury_status: player.injury_status,
                bye_week: adpInfo?.byeWeek,
                reasons
            });
        }

        // Sort by waiver score (highest first)
        availablePlayers.sort((a, b) => b.waiver_score - a.waiver_score);

        // Limit results
        const results = availablePlayers.slice(0, validation.data.limit);

        const duration = Date.now() - startTime;
        console.log(`[WaiverWire] Analysis completed in ${duration}ms, returning ${results.length} players`);

        return NextResponse.json({
            success: true,
            data: {
                players: results,
                teamNeeds,
                totalAvailable: availablePlayers.length,
                analysis: {
                    duration,
                    rosteredCount: rosteredPlayerIds.size,
                    filterApplied: position
                }
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
async function loadADPData(): Promise<Map<string, { rank: number; byeWeek?: number }>> {
    const fs = await import('fs');
    const path = await import('path');

    const adpMap = new Map();

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
                            byeWeek,
                            team,
                            position
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

function analyzeTeamNeeds(roster: any): TeamNeeds {
    const needs: TeamNeeds = {
        QB: { priority: 'low', count: 0 },
        RB: { priority: 'low', count: 0 },
        WR: { priority: 'low', count: 0 },
        TE: { priority: 'low', count: 0 }
    };

    if (!roster?.roster) return needs;

    // Count players by position
    const positionCounts: { [pos: string]: number } = {};
    roster.roster.forEach((player: any) => {
        const pos = player.position;
        if (pos) {
            positionCounts[pos] = (positionCounts[pos] || 0) + 1;
        }
    });

    // Determine needs based on typical roster construction
    needs.QB.count = positionCounts.QB || 0;
    needs.QB.priority = needs.QB.count < 2 ? 'medium' : 'low';

    needs.RB.count = positionCounts.RB || 0;
    needs.RB.priority = needs.RB.count < 3 ? 'high' : needs.RB.count < 5 ? 'medium' : 'low';

    needs.WR.count = positionCounts.WR || 0;
    needs.WR.priority = needs.WR.count < 4 ? 'high' : needs.WR.count < 6 ? 'medium' : 'low';

    needs.TE.count = positionCounts.TE || 0;
    needs.TE.priority = needs.TE.count < 2 ? 'medium' : 'low';

    return needs;
}

function calculateWaiverScore(
    player: SleeperPlayer,
    adpInfo: any,
    teamNeeds: TeamNeeds
): number {
    let score = 0;

    // Base score from ADP (higher ADP = higher score)
    if (adpInfo?.rank) {
        // Convert ADP rank to score (lower rank = higher score)
        const adpScore = Math.max(0, 300 - adpInfo.rank);
        score += adpScore;
    } else {
        // No ADP data, give moderate score
        score += 50;
    }

    // Position need multiplier
    const position = player.position;
    if (position && teamNeeds[position]) {
        const need = teamNeeds[position];
        switch (need.priority) {
            case 'high':
                score *= 1.5;
                break;
            case 'medium':
                score *= 1.2;
                break;
            case 'low':
                score *= 0.8;
                break;
        }
    }

    // Team quality bonus (rough approximation)
    const goodOffenses = ['BUF', 'KC', 'DAL', 'SF', 'MIA', 'PHI', 'CIN', 'BAL'];
    if (player.team && goodOffenses.includes(player.team)) {
        score += 20;
    }

    // Injury penalty
    if (player.injury_status && ['Out', 'IR', 'Doubtful'].includes(player.injury_status)) {
        score *= 0.3;
    } else if (player.injury_status === 'Questionable') {
        score *= 0.8;
    }

    return Math.round(score);
}

function generateReasons(
    player: SleeperPlayer,
    adpInfo: any,
    teamNeeds: TeamNeeds
): string[] {
    const reasons: string[] = [];
    const position = player.position;

    // ADP-based reasons
    if (adpInfo?.rank) {
        if (adpInfo.rank <= 50) {
            reasons.push(`High draft capital (ADP ${adpInfo.rank})`);
        } else if (adpInfo.rank <= 100) {
            reasons.push(`Solid ADP value (ranked ${adpInfo.rank})`);
        }
    }

    // Team need reasons
    if (position && teamNeeds[position]) {
        const need = teamNeeds[position];
        if (need.priority === 'high') {
            reasons.push(`Addresses high team need at ${position}`);
        } else if (need.priority === 'medium') {
            reasons.push(`Provides depth at ${position}`);
        }
    }

    // Team quality reasons
    const goodOffenses = ['BUF', 'KC', 'DAL', 'SF', 'MIA', 'PHI', 'CIN', 'BAL'];
    if (player.team && goodOffenses.includes(player.team)) {
        reasons.push(`Plays for high-scoring ${player.team} offense`);
    }

    // Injury concerns
    if (player.injury_status) {
        if (['Out', 'IR'].includes(player.injury_status)) {
            reasons.push(`Currently injured (${player.injury_status}) - stash candidate`);
        } else if (player.injury_status === 'Questionable') {
            reasons.push(`Monitor injury status`);
        }
    }

    // Default reason if none found
    if (reasons.length === 0) {
        reasons.push('Available free agent option');
    }

    return reasons;
}
