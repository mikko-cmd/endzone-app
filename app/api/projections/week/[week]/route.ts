import { NextRequest, NextResponse } from 'next/server';
import { projectionService } from '@/lib/services/projectionService';

export async function GET(
    request: NextRequest,
    { params }: { params: { week: string } }
) {
    try {
        const week = parseInt(params.week);
        const { searchParams } = new URL(request.url);

        const player = searchParams.get('player');
        const team = searchParams.get('team');
        const position = searchParams.get('position');

        if (player) {
            const projection = await projectionService.getPlayerProjection(player, week);
            return NextResponse.json({ success: true, projection });
        }

        if (team) {
            const projections = await projectionService.getTeamProjections(team, week);
            return NextResponse.json({ success: true, projections });
        }

        if (position) {
            const projections = await projectionService.getPositionProjections(position, week);
            return NextResponse.json({ success: true, projections });
        }

        const allProjections = await projectionService.getWeekProjections(week);
        return NextResponse.json(allProjections);

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
