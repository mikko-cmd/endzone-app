import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const playerName = searchParams.get('name');

        if (!playerName) {
            return NextResponse.json({ error: 'name parameter required' }, { status: 400 });
        }

        // Search for player by name
        const { data: players, error } = await supabase
            .from('players')
            .select('sleeper_id, name, position, team, espn_id')
            .ilike('name', `%${playerName}%`)
            .limit(10);

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({
            success: true,
            searchTerm: playerName,
            results: players || [],
            count: players?.length || 0
        });

    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to search players',
                details: error.message
            },
            { status: 500 }
        );
    }
}
