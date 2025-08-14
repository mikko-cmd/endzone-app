import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerFilter = searchParams.get('player') || '';
        const showAll = searchParams.get('all') === 'true';

        // Environment variables
        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
        const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

        if (!RAPIDAPI_KEY) {
            return NextResponse.json({
                error: 'Missing RAPIDAPI_KEY',
                message: 'RAPIDAPI_KEY not configured in environment variables'
            }, { status: 500 });
        }

        // Sample elite players to test
        const testPlayers = [
            { search: ['Josh Allen'], position: 'QB', team: 'BUF' },
            { search: ['Christian McCaffrey', 'McCaffrey'], position: 'RB', team: 'SF' },
            { search: ['Tyreek Hill'], position: 'WR', team: 'MIA' },
            { search: ['Travis Kelce'], position: 'TE', team: 'KC' },
            { search: ['Brian Robinson', 'Robinson Jr'], position: 'RB', team: 'WSH' }, // ← Changed WAS to WSH
            { search: ['Rome Odunze'], position: 'WR', team: 'CHI' }
        ];

        console.log('🧪 Testing Week 1 Projections...');

        // Test Week 1 projections
        const response = await axios.get(
            'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLProjections',
            {
                params: {
                    week: 1,
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
            }
        );

        const data = response.data;

        if (data.statusCode === 200 && data.body?.playerProjections) {
            const playerProjections = data.body.playerProjections;
            const allPlayers = Object.values(playerProjections) as any[];

            // Search for our test players
            const foundPlayers = [];

            for (const testPlayer of testPlayers) {
                const found = allPlayers.filter((player: any) => {
                    const playerName = player.longName || '';
                    const playerTeam = player.team || '';

                    // Check if name matches any search term
                    const nameMatch = testPlayer.search.some(search =>
                        playerName.toLowerCase().includes(search.toLowerCase())
                    );

                    // Optional team check for disambiguation
                    const teamMatch = !testPlayer.team || playerTeam === testPlayer.team;

                    return nameMatch && teamMatch;
                });

                if (found.length > 0) {
                    foundPlayers.push(...found.map(player => ({
                        searchedFor: testPlayer.search.join(' / '),
                        found: true,
                        ...formatPlayerProjection(player)
                    })));
                } else {
                    foundPlayers.push({
                        searchedFor: testPlayer.search.join(' / '),
                        found: false,
                        expectedTeam: testPlayer.team,
                        expectedPosition: testPlayer.position
                    });
                }
            }

            // Filter by URL parameter if provided
            const filteredResults = playerFilter
                ? foundPlayers.filter(p => p.found &&
                    (p.name?.toLowerCase().includes(playerFilter.toLowerCase()) ||
                        p.searchedFor?.toLowerCase().includes(playerFilter.toLowerCase())))
                : foundPlayers;

            return NextResponse.json({
                success: true,
                message: `Week 1 Projections Test Results`,
                summary: {
                    totalProjections: allPlayers.length,
                    searchedPlayers: testPlayers.length,
                    foundPlayers: foundPlayers.filter(p => p.found).length,
                    notFoundPlayers: foundPlayers.filter(p => !p.found).length
                },
                results: showAll ? filteredResults : filteredResults.slice(0, 10),
                week: data.body.week,
                season: data.body.season,
                apiInfo: {
                    statusCode: data.statusCode,
                    dataStructure: 'playerProjections object with 479 players'
                }
            });
        }

        return NextResponse.json({
            error: 'Unexpected response format',
            statusCode: data.statusCode,
            available: Object.keys(data.body || {})
        }, { status: 500 });

    } catch (error: any) {
        console.error('❌ Projection test error:', error.message);

        return NextResponse.json({
            error: 'Failed to fetch projections',
            message: error.message,
            details: error.response?.status
        }, { status: 500 });
    }
}

// Helper function to format player projection data
function formatPlayerProjection(player: any) {
    return {
        name: player.longName,
        team: player.team,
        position: player.pos,
        playerId: player.playerID,
        fantasyPoints: player.fantasyPoints,
        fantasyPointsDefault: player.fantasyPointsDefault,
        passing: {
            yards: player.Passing?.passYds,
            touchdowns: player.Passing?.passTD,
            interceptions: player.Passing?.int,
            attempts: player.Passing?.passAttempts,
            completions: player.Passing?.passCompletions
        },
        rushing: {
            yards: player.Rushing?.rushYds,
            touchdowns: player.Rushing?.rushTD,
            carries: player.Rushing?.carries
        },
        receiving: {
            yards: player.Receiving?.recYds,
            touchdowns: player.Receiving?.recTD,
            receptions: player.Receiving?.receptions,
            targets: player.Receiving?.targets
        },
        other: {
            fumblesLost: player.fumblesLost,
            twoPointConversion: player.twoPointConversion
        }
    };
}
