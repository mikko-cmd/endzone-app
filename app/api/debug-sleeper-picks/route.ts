import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
        return NextResponse.json({ error: 'draftId required' }, { status: 400 });
    }

    try {
        // Fetch picks from Sleeper
        console.log(`🔍 Fetching picks for draft ID: ${draftId}`);
        const sleeperResponse = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/picks`);

        console.log(`📡 Sleeper API response status: ${sleeperResponse.status}`);

        if (!sleeperResponse.ok) {
            return NextResponse.json({
                error: `Sleeper API error: ${sleeperResponse.status} ${sleeperResponse.statusText}`,
                draftId,
                apiUrl: `https://api.sleeper.app/v1/draft/${draftId}/picks`
            }, { status: 400 });
        }

        const sleeperPicks = await sleeperResponse.json();
        console.log(`📊 Received ${sleeperPicks?.length || 0} picks from Sleeper`);

        if (!sleeperPicks || !Array.isArray(sleeperPicks)) {
            return NextResponse.json({
                error: 'Invalid response from Sleeper API',
                response: sleeperPicks,
                draftId
            }, { status: 400 });
        }

        if (sleeperPicks.length === 0) {
            return NextResponse.json({
                message: 'No picks found in this draft yet',
                totalSleeperPicks: 0,
                draftId
            });
        }

        // Test our player lookup for the first few picks
        const testResults = [];
        for (const pick of sleeperPicks.slice(0, 5)) {
            try {
                const playerResponse = await fetch(`${request.nextUrl.origin}/api/draft/players-adp?search=${pick.player_id}`);
                const playerData = await playerResponse.json();

                testResults.push({
                    sleeperPick: {
                        pick_no: pick.pick_no,
                        player_id: pick.player_id,
                        round: pick.round,
                        draft_slot: pick.draft_slot
                    },
                    ourLookupResult: playerData,
                    found: playerData.players?.length > 0
                });
            } catch (error: any) {
                testResults.push({
                    sleeperPick: {
                        pick_no: pick.pick_no,
                        player_id: pick.player_id,
                        round: pick.round,
                        draft_slot: pick.draft_slot
                    },
                    error: error.message || 'Unknown error',
                    found: false
                });
            }
        }

        return NextResponse.json({
            totalSleeperPicks: sleeperPicks.length,
            testResults,
            summary: {
                tested: testResults.length,
                successful: testResults.filter(r => r.found).length,
                failed: testResults.filter(r => !r.found).length
            },
            draftId
        });

    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            draftId,
            stack: error.stack
        }, { status: 500 });
    }
}
