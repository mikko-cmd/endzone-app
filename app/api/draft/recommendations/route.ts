import { NextResponse } from 'next/server';
import { z } from 'zod';

interface ADPPlayer {
    name: string;
    team: string;
    position: string;
    ppr: number;
    byeWeek: number;
    tier: number;
}

interface DraftPick {
    pick: number;
    round: number;
    player: string;
    position: string;
    team?: string;
    adp?: number;
    value?: number;
}

interface TeamComposition {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    K: number;
    DEF: number;
}

interface DraftRecommendation {
    player: ADPPlayer;
    value: number;
    reasoning: string[];
    tier: number;
    scarcity: 'high' | 'medium' | 'low';
}

const draftRequestSchema = z.object({
    leagueSize: z.number().min(8).max(16).default(12),
    picks: z.array(z.object({
        pick: z.number(),
        round: z.number(),
        player: z.string(),
        position: z.string(),
        team: z.string().optional(),
        adp: z.number().optional()
    })).default([]),
    userTeamPicks: z.array(z.number()).default([]),
    nextPick: z.number().min(1),
    scoringType: z.enum(['ppr', 'half', 'standard']).default('ppr')
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = draftRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({
                success: false,
                error: 'Invalid request data',
                details: validation.error.flatten()
            }, { status: 400 });
        }

        const { leagueSize, picks, userTeamPicks, nextPick, scoringType } = validation.data;

        // Load ADP data
        const adpData = await loadADPData();

        // Get already drafted players
        const draftedPlayers = new Set(picks.map(p => p.player.toLowerCase()));

        // Calculate user team composition
        const userPicks = picks.filter(p => userTeamPicks.includes(p.pick));
        const teamComposition = calculateTeamComposition(userPicks as DraftPick[]);

        // Get available players
        const availablePlayers = adpData.filter(player =>
            !draftedPlayers.has(player.name.toLowerCase())
        );

        // Calculate positional scarcity
        const scarcityData = calculatePositionalScarcity(availablePlayers, nextPick, leagueSize);

        // Generate recommendations
        const recommendations = generateRecommendations(
            availablePlayers,
            teamComposition,
            scarcityData,
            nextPick,
            leagueSize
        );

        // Calculate draft analysis
        const analysis = analyzeDraft(picks as DraftPick[], userPicks as DraftPick[], adpData, leagueSize);

        return NextResponse.json({
            success: true,
            data: {
                recommendations: recommendations.slice(0, 15),
                teamComposition,
                scarcityData,
                analysis,
                nextPick,
                totalPicks: picks.length,
                availablePlayers: availablePlayers.length
            }
        });

    } catch (error: any) {
        console.error('[Draft] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}

async function loadADPData(): Promise<ADPPlayer[]> {
    const fs = await import('fs');
    const path = await import('path');

    const players: ADPPlayer[] = [];

    try {
        const adpFilePath = path.join(process.cwd(), 'data/adp/2025_sleeper_adp_ppr.csv');
        const adpContent = fs.readFileSync(adpFilePath, 'utf-8');
        const lines = adpContent.split('\n').slice(1); // Skip header

        lines.forEach((line, index) => {
            if (line.trim()) {
                const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
                if (columns.length >= 6) {
                    const name = columns[0];
                    const team = columns[1];
                    const byeWeek = parseInt(columns[2]) || 0;
                    const position = columns[3];
                    const ppr = parseFloat(columns[5]) || (index + 1);

                    if (name && position && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position)) {
                        players.push({
                            name,
                            team,
                            position,
                            ppr,
                            byeWeek,
                            tier: calculateTier(ppr, position)
                        });
                    }
                }
            }
        });
    } catch (error: any) {
        console.warn('[Draft] Could not load ADP data:', error);
    }

    return players.sort((a, b) => a.ppr - b.ppr);
}

function calculateTier(adp: number, position: string): number {
    // Tier 1: Elite players
    if (adp <= 12) return 1;
    // Tier 2: High-end starters
    if (adp <= 36) return 2;
    // Tier 3: Solid starters
    if (adp <= 72) return 3;
    // Tier 4: Flex/backup options
    if (adp <= 120) return 4;
    // Tier 5: Deep sleepers
    return 5;
}

function calculateTeamComposition(userPicks: DraftPick[]): TeamComposition {
    const composition: TeamComposition = {
        QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0
    };

    userPicks.forEach(pick => {
        if (composition[pick.position as keyof TeamComposition] !== undefined) {
            composition[pick.position as keyof TeamComposition]++;
        }
    });

    return composition;
}

function calculatePositionalScarcity(
    availablePlayers: ADPPlayer[],
    nextPick: number,
    leagueSize: number
): Record<string, { available: number; scarcity: 'high' | 'medium' | 'low' }> {
    const positions = ['QB', 'RB', 'WR', 'TE'];
    const scarcity: Record<string, { available: number; scarcity: 'high' | 'medium' | 'low' }> = {};

    positions.forEach(pos => {
        const positionPlayers = availablePlayers.filter(p => p.position === pos);
        const tier1And2 = positionPlayers.filter(p => p.tier <= 2).length;

        // Calculate scarcity based on remaining elite players and draft progress
        const roundsLeft = Math.ceil((leagueSize * 16 - nextPick + 1) / leagueSize);
        let scarcityLevel: 'high' | 'medium' | 'low' = 'low';

        if (pos === 'QB') {
            scarcityLevel = tier1And2 < 3 ? 'high' : tier1And2 < 6 ? 'medium' : 'low';
        } else if (pos === 'RB') {
            scarcityLevel = tier1And2 < 8 ? 'high' : tier1And2 < 16 ? 'medium' : 'low';
        } else if (pos === 'WR') {
            scarcityLevel = tier1And2 < 12 ? 'high' : tier1And2 < 24 ? 'medium' : 'low';
        } else if (pos === 'TE') {
            scarcityLevel = tier1And2 < 3 ? 'high' : tier1And2 < 6 ? 'medium' : 'low';
        }

        scarcity[pos] = {
            available: positionPlayers.length,
            scarcity: scarcityLevel
        };
    });

    return scarcity;
}

function generateRecommendations(
    availablePlayers: ADPPlayer[],
    teamComposition: TeamComposition,
    scarcityData: Record<string, any>,
    nextPick: number,
    leagueSize: number
): DraftRecommendation[] {
    const recommendations: DraftRecommendation[] = [];

    // Calculate positional needs
    const needs = calculatePositionalNeeds(teamComposition, nextPick, leagueSize);

    availablePlayers.forEach(player => {
        const value = calculatePlayerValue(player, needs, scarcityData, nextPick);
        const reasoning = generateReasoningForPlayer(player, needs, scarcityData, nextPick);

        recommendations.push({
            player,
            value,
            reasoning,
            tier: player.tier,
            scarcity: scarcityData[player.position]?.scarcity || 'low'
        });
    });

    return recommendations.sort((a, b) => b.value - a.value);
}

function calculatePositionalNeeds(
    composition: TeamComposition,
    nextPick: number,
    leagueSize: number
): Record<string, number> {
    const round = Math.ceil(nextPick / leagueSize);

    // Standard roster: 1 QB, 2 RB, 3 WR, 1 TE, 1 K, 1 DEF + bench
    const needs: Record<string, number> = {
        QB: composition.QB < 1 ? 3 : composition.QB < 2 ? 1 : 0,
        RB: composition.RB < 2 ? 3 : composition.RB < 4 ? 2 : 1,
        WR: composition.WR < 3 ? 3 : composition.WR < 5 ? 2 : 1,
        TE: composition.TE < 1 ? 2 : composition.TE < 2 ? 1 : 0,
        K: round > 12 && composition.K < 1 ? 1 : 0,
        DEF: round > 12 && composition.DEF < 1 ? 1 : 0
    };

    return needs;
}

function calculatePlayerValue(
    player: ADPPlayer,
    needs: Record<string, number>,
    scarcityData: Record<string, any>,
    nextPick: number
): number {
    let value = 100 - player.ppr; // Base value from ADP

    // Need multiplier
    const need = needs[player.position] || 0;
    if (need >= 3) value *= 1.5;
    else if (need >= 2) value *= 1.2;
    else if (need >= 1) value *= 1.1;
    else value *= 0.8;

    // Scarcity multiplier
    const scarcity = scarcityData[player.position]?.scarcity;
    if (scarcity === 'high') value *= 1.3;
    else if (scarcity === 'medium') value *= 1.1;

    // Tier bonus
    if (player.tier === 1) value += 20;
    else if (player.tier === 2) value += 10;

    // Value pick bonus (drafted later than ADP)
    const expectedPick = player.ppr;
    if (nextPick > expectedPick) {
        value += (nextPick - expectedPick) * 2;
    }

    return Math.round(value);
}

function generateReasoningForPlayer(
    player: ADPPlayer,
    needs: Record<string, number>,
    scarcityData: Record<string, any>,
    nextPick: number
): string[] {
    const reasoning: string[] = [];
    const need = needs[player.position] || 0;
    const scarcity = scarcityData[player.position]?.scarcity;

    // Tier reasoning
    if (player.tier === 1) {
        reasoning.push('Elite tier 1 player');
    } else if (player.tier === 2) {
        reasoning.push('High-end starter');
    }

    // Need reasoning
    if (need >= 3) {
        reasoning.push(`Critical need at ${player.position}`);
    } else if (need >= 2) {
        reasoning.push(`Strong need at ${player.position}`);
    } else if (need >= 1) {
        reasoning.push(`Depth needed at ${player.position}`);
    }

    // Scarcity reasoning
    if (scarcity === 'high') {
        reasoning.push(`High scarcity at ${player.position}`);
    } else if (scarcity === 'medium') {
        reasoning.push(`Moderate scarcity at ${player.position}`);
    }

    // Value reasoning
    const expectedPick = player.ppr;
    if (nextPick > expectedPick + 12) {
        reasoning.push('Significant value pick');
    } else if (nextPick > expectedPick + 6) {
        reasoning.push('Good value');
    }

    // Bye week reasoning
    if (player.byeWeek && [6, 7, 8, 9, 10, 11].includes(player.byeWeek)) {
        reasoning.push('Manageable bye week');
    }

    if (reasoning.length === 0) {
        reasoning.push('Solid option available');
    }

    return reasoning;
}

function analyzeDraft(
    allPicks: DraftPick[],
    userPicks: DraftPick[],
    adpData: ADPPlayer[],
    leagueSize: number
): any {
    const analysis = {
        totalValue: 0,
        bestPicks: [] as any[],
        reaches: [] as any[],
        grade: 'B'
    };

    userPicks.forEach(pick => {
        const adpPlayer = adpData.find(p => p.name.toLowerCase() === pick.player.toLowerCase());
        if (adpPlayer) {
            const value = pick.pick - adpPlayer.ppr;
            analysis.totalValue += value;

            if (value > 12) {
                analysis.bestPicks.push({
                    player: pick.player,
                    value,
                    reasoning: 'Great value pick'
                });
            } else if (value < -12) {
                analysis.reaches.push({
                    player: pick.player,
                    value: Math.abs(value),
                    reasoning: 'Drafted early'
                });
            }
        }
    });

    // Calculate grade
    const avgValue = analysis.totalValue / Math.max(userPicks.length, 1);
    if (avgValue > 8) analysis.grade = 'A';
    else if (avgValue > 4) analysis.grade = 'B+';
    else if (avgValue > 0) analysis.grade = 'B';
    else if (avgValue > -4) analysis.grade = 'B-';
    else if (avgValue > -8) analysis.grade = 'C';
    else analysis.grade = 'D';

    return analysis;
}
