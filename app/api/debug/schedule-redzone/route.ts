import { NextResponse } from 'next/server';
import { dataParser } from '@/lib/dataParser';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerName = searchParams.get('player') || 'Brian Robinson Jr.';
        const team = searchParams.get('team') || 'WAS';
        const week = parseInt(searchParams.get('week') || '1');

        // Initialize data parser
        await dataParser.initializeData();

        // Test 1: Schedule/Matchup Data
        console.log(`🔍 Testing schedule for ${team} Week ${week}...`);
        const matchup = dataParser.getWeekMatchup(team, week, 'RB');

        // Test 2: Red Zone Data
        console.log(`🔍 Testing red zone data for ${playerName}...`);
        const redZoneData = dataParser.getRedZoneData(playerName, 'RB');

        // Test 3: Market Share Data  
        const marketShare = dataParser.getMarketShareByPosition(playerName, 'RB');

        const debugResults = {
            player: playerName,
            team: team,
            week: week,

            // Schedule Results
            scheduleTest: {
                matchup: matchup,
                expected: `${team} vs NYG at home`,
                issue: matchup.opponent === 'TBD' ? 'SCHEDULE PARSING FAILED' : 'OK'
            },

            // Red Zone Results
            redZoneTest: {
                rawData: redZoneData,
                parsed: {
                    attempts: redZoneData?.rzAttempts || 0,
                    touchdowns: redZoneData?.rzTouchdowns || 0,
                    percentage: redZoneData ? (((redZoneData.rzTouchdowns || 0) / Math.max(1, (redZoneData.rzAttempts || 0))) * 100).toFixed(1) : '0.0'
                },
                expected: "24 attempts, 7 touchdowns, 29.2%",
                issue: (redZoneData?.rzTouchdowns !== 7 || redZoneData?.rzAttempts !== 24) ? 'RED ZONE PARSING FAILED' : 'OK'
            },

            // Market Share Results
            marketShareTest: {
                data: marketShare,
                rushingShare: marketShare?.attPercent || 0,
                yardageShare: marketShare?.ydPercent || 0
            },

            // Raw CSV Debug
            csvDebug: {
                scheduleFile: "data/research/2025_nfl_schedule.csv line 33 for WSH",
                redZoneFile: "data/research/2024_redzone_report_rb.csv line 19 for Brian Robinson Jr.",
                expectedRB: "Should be: 24 ATT, 7 TDS, 87.5% TD%",
                expectedSchedule: "Should be: WSH vs NYG at home"
            }
        };

        return NextResponse.json(debugResults);

    } catch (error: any) {
        console.error('🚨 Debug endpoint error:', error);
        return NextResponse.json({
            error: 'Debug failed',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
