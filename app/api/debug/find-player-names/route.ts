import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamFilter = searchParams.get('team') || '';
        const nameFilter = searchParams.get('name') || '';
        const positionFilter = searchParams.get('pos') || '';

        // Environment variables
        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
        const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

        if (!RAPIDAPI_KEY) {
            return NextResponse.json({
                error: 'Missing RAPIDAPI_KEY'
            }, { status: 500 });
        }

        // Get Week 1 projections
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

            // Filter players based on search criteria
            let filteredPlayers = allPlayers;

            if (teamFilter) {
                filteredPlayers = filteredPlayers.filter((player: any) =>
                    (player.team || '').toLowerCase() === teamFilter.toLowerCase()
                );
            }

            if (nameFilter) {
                filteredPlayers = filteredPlayers.filter((player: any) =>
                    (player.longName || '').toLowerCase().includes(nameFilter.toLowerCase())
                );
            }

            if (positionFilter) {
                filteredPlayers = filteredPlayers.filter((player: any) =>
                    (player.pos || '').toLowerCase() === positionFilter.toLowerCase()
                );
            }

            // Format results
            const results = filteredPlayers.map((player: any) => ({
                name: player.longName,
                team: player.team,
                position: player.pos,
                playerId: player.playerID,
                fantasyPoints: player.fantasyPoints,
                fantasyPointsDefault: player.fantasyPointsDefault
            }));

            return NextResponse.json({
                success: true,
                message: `Found ${results.length} players`,
                filters: {
                    team: teamFilter || 'all',
                    name: nameFilter || 'all',
                    position: positionFilter || 'all'
                },
                totalPlayers: allPlayers.length,
                results: results.slice(0, 50), // Limit to 50 for readability
                sampleQueries: [
                    "?team=WAS (all Washington players)",
                    "?name=Robinson (all players with Robinson in name)",
                    "?team=WAS&pos=RB (Washington RBs)",
                    "?name=Brian (all Brians)"
                ]
            });
        }

        return NextResponse.json({
            error: 'No projection data available'
        }, { status: 500 });

    } catch (error: any) {
        return NextResponse.json({
            error: 'Failed to search players',
            message: error.message
        }, { status: 500 });
    }
}
