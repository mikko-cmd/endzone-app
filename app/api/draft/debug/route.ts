import { NextResponse } from 'next/server';
import { DraftDataService } from '@/lib/draftData';
import { DraftHeuristics } from '@/lib/draftHeuristics';
import { generateCoachRecommendation } from '@/lib/coachPrompt';
import { z } from 'zod';

// Input validation schema
const DraftRequestSchema = z.object({
    league: z.object({
        teams: z.number(),
        format: z.enum(['PPR', 'Half', 'Std', '2QB', 'Dynasty']),
        roster: z.object({
            QB: z.number(),
            RB: z.number(),
            WR: z.number(),
            TE: z.number(),
            FLEX: z.number(),
            BENCH: z.number(),
            K: z.number().optional(),
            DST: z.number().optional(),
        }),
    }),
    draft: z.object({
        round: z.number(),
        pickOverall: z.number(),
        pickInRound: z.number(),
        snake: z.boolean(),
        myTeamIndex: z.number(),
        picksUntilMe: z.number(),
        board: z.array(z.string()), // Array of drafted player names
    }),
    myTeam: z.object({
        players: z.array(z.string()),
        needs: z.record(z.number()),
        stacks: z.array(z.object({
            type: z.string(),
            players: z.array(z.string()),
            strength: z.string(),
        })).optional(),
        byes: z.record(z.array(z.number())).optional(),
    }),
    constraints: z.object({
        maxReach: z.number().default(12),
        preferStacks: z.boolean().default(true),
        avoidQBTEBackToBack: z.boolean().default(true),
    }).optional(),
});

export async function GET() {
    try {
        // Test basic functionality
        console.log('🧪 Testing API route basic functionality...');

        // Test data loading
        const { DraftDataService } = await import('@/lib/draftData');
        const players = await DraftDataService.getAllPlayersForFormat('PPR');
        console.log(`✅ Loaded ${players.length} players`);

        return NextResponse.json({
            message: 'Draft Assistant API - Use POST with draft context',
            status: 'healthy',
            playersLoaded: players.length
        });

    } catch (error) {
        console.error('❌ API health check failed:', error);
        return NextResponse.json(
            {
                error: 'API initialization failed',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        console.log('🎯 Draft assist request received');

        // Parse and validate input
        const body = await request.json();
        const validatedInput = DraftRequestSchema.parse(body);
        const { league, draft, myTeam, constraints = {} } = validatedInput;

        console.log(`📊 Draft context: Round ${draft.round}, Pick ${draft.pickOverall}, Format: ${league.format}`);

        // 1. Load format-specific player data
        const allPlayers = await DraftDataService.getAllPlayersForFormat(league.format);
        const available = DraftDataService.getAvailablePlayers(allPlayers, draft.board);

        console.log(`👥 Players: ${allPlayers.length} total, ${available.length} available`);

        // 2. Calculate heuristics for available players
        const scarcity = DraftHeuristics.estimateScarcity(draft, available, league);
        console.log('🔍 Scarcity analysis:', scarcity);

        // 3. Enrich available players with draft context
        const enrichedPlayers = available.map(player => {
            const value = DraftHeuristics.scoreValue(player, draft.pickOverall, league.format);
            const stack = DraftHeuristics.analyzeStacks(myTeam, player);
            const byeImpact = DraftHeuristics.calculateByeImpact(myTeam, player);

            return {
                ...player,
                draftContext: {
                    ...value,
                    ...stack,
                    byeImpact,
                    scarcityScore: scarcity[player.position] || 0
                }
            };
        });

        // 4. Filter to reasonable candidates - EXCLUDE players with invalid ADP
        const maxReach = constraints.maxReach || 12;
        const candidates = enrichedPlayers
            .filter(p => {
                // Exclude players with invalid/missing ADP data
                const adp = p.adp[league.format];
                if (!adp || adp >= 500) return false; // Exclude ADP 999 players

                // Include if reasonable reach OR high value score
                return p.draftContext.reach <= maxReach || p.draftContext.valueScore >= 70;
            })
            .sort((a, b) => b.draftContext.valueScore - a.draftContext.valueScore)
            .slice(0, 15); // Top 15 for AI consideration

        console.log(`🎯 ${candidates.length} valid candidates identified for analysis`);
        console.log('Top 5 candidates:', candidates.slice(0, 5).map(p =>
            `${p.name} (${p.position}, ADP: ${p.adp[league.format]})`
        ));

        // 5. Generate AI recommendation
        const recommendation = await generateCoachRecommendation({
            league,
            draft: { ...draft, available: candidates },
            myTeam,
            scarcity,
            constraints
        });

        console.log(`🤖 AI recommendation: ${recommendation.primary?.playerId || 'none'}`);

        return NextResponse.json({
            recommendation,
            candidates,
            scarcity,
            constraints
        });

    } catch (error) {
        console.error('❌ Draft assist failed:', error);
        return NextResponse.json(
            {
                error: 'Draft assist failed',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
