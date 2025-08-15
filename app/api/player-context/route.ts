import { NextRequest, NextResponse } from 'next/server';
import { contextEngine } from '@/lib/contextEngine';

interface PlayerContextRequest {
    playerName: string;
    team: string;
    position: string;
    athleteId?: string;
}

interface PlayerContextResponse {
    success: boolean;
    playerContext?: any;
    contextualFactors?: string[];
    timestamp?: string;
    error?: string;
    details?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<PlayerContextResponse>> {
    try {
        const { searchParams } = new URL(request.url);
        const playerName = searchParams.get('playerName');
        const team = searchParams.get('team');
        const position = searchParams.get('position');
        const athleteId = searchParams.get('athleteId');

        if (!playerName || !team || !position) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required parameters: playerName, team, position'
                },
                { status: 400 }
            );
        }

        console.log(`🔍 Getting enhanced context for ${playerName} (${position}, ${team})`);

        const context = await contextEngine.getEnhancedPlayerContext(
            playerName,
            team,
            position,
            athleteId || undefined
        );

        const contextualFactors = await contextEngine.getPlayerContextualFactors(playerName, team, position);

        return NextResponse.json({
            success: true,
            playerContext: context,
            contextualFactors,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) { // Fixed: Added ": any" to catch
        console.error('❌ Error in player context API:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to get player context',
                details: error?.message || 'Unknown error'
            },
            { status: 500 }
        );
    }
}
