import { NextResponse } from 'next/server';
import { DraftDataService } from '@/lib/draftData';
import { DraftHeuristics } from '@/lib/draftHeuristics';
import { generateCoachRecommendation } from '@/lib/coachPrompt';
import { DraftState } from '@/lib/types/draft';
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

    } catch (error: any) {
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

        // Create complete draft state with available players
        const draftState: DraftState = {
            ...draft,
            available
        };

        // 2. Calculate heuristics for available players
        const scarcity = DraftHeuristics.estimateScarcity(draftState, available, league);
        console.log('🔍 Scarcity analysis:', scarcity);

        // 3. Enrich available players with draft context
        const enrichedPlayers = available.map(player => {
            const value = DraftHeuristics.scoreValue(player, draft.pickOverall, league.format);
            const stack = DraftHeuristics.analyzeStacks({
                ...myTeam,
                stacks: (myTeam.stacks || []) as any,
                byes: myTeam.byes || {}
            }, player);
            const byeImpact = DraftHeuristics.calculateByeImpact({
                ...myTeam,
                stacks: (myTeam.stacks || []) as any,
                byes: myTeam.byes || {}
            }, player);

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

        // 4. Filter to reasonable candidates - ADP PROXIMITY based on draft stage
        const maxReach = constraints?.maxReach || 12;
        const candidates = enrichedPlayers
            .filter(p => {
                const adp = p.adp[league.format];
                if (!adp || adp >= 300) return false; // Exclude clearly undraftable players

                // DYNAMIC ADP TOLERANCE based on draft stage
                let adpTolerance: number;

                if (draft.round <= 3) {
                    // Early rounds (1-3): Stay close to ADP, only 5-6 slots
                    adpTolerance = 6;
                } else if (draft.round <= (league.roster.QB + league.roster.RB + league.roster.WR + league.roster.TE + 2)) {
                    // Middle rounds (4 through starters + 2): Moderate flexibility  
                    adpTolerance = 12;
                } else {
                    // Late rounds (bench + fliers): High flexibility for positional needs
                    adpTolerance = 20;
                }

                const reach = Math.abs(draft.pickOverall - adp);

                // Filter by ADP proximity
                if (reach > adpTolerance) return false;

                // Exclude players with terrible value scores
                if (p.draftContext.valueScore <= 20) return false;

                return true;
            })
            .sort((a, b) => {
                // Sort by combination of value score and ADP proximity
                const aProximity = Math.abs(draft.pickOverall - a.adp[league.format]);
                const bProximity = Math.abs(draft.pickOverall - b.adp[league.format]);

                // Prioritize good value + close ADP
                const aScore = a.draftContext.valueScore - (aProximity * 2);
                const bScore = b.draftContext.valueScore - (bProximity * 2);

                return bScore - aScore;
            })
            .slice(0, 15);

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

        console.log(`🤖 AI recommendation: ${recommendation.primary?.playerId || 'none'} (${recommendation.confidence}% confidence)`);

        return NextResponse.json(recommendation);

    } catch (error: any) {
        console.error('❌ Draft assist error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid input', details: error.errors },
                { status: 400 }
            );
        }

        // Fallback recommendation
        const fallback = {
            decision: 'pick',
            primary: {
                playerId: 'unknown',
                reason: 'System error occurred. Please try again.',
                fit: { positionalNeed: 'BPA', byeImpact: 'minimal' },
                value: { rank: 0, adp: 0, reach: 0, scarcityScore: 0 },
                riskFlags: ['system_error'],
                coachism: 'Next man up.'
            },
            alternates: [],
            strategyNotes: ['System temporarily unavailable'],
            confidence: 50
        };

        return NextResponse.json(fallback, { status: 500 });
    }
}