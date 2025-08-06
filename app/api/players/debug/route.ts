import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabase = createClient();
        const serviceSupabase = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Test with regular client
        const { count: regularCount, error: regularCountError } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true });

        const { data: regularPlayers, error: regularError } = await supabase
            .from('players')
            .select('sleeper_id, name, position, team')
            .limit(5);

        // Test with service client
        const { count: serviceCount, error: serviceCountError } = await serviceSupabase
            .from('players')
            .select('*', { count: 'exact', head: true });

        const { data: servicePlayers, error: serviceError } = await serviceSupabase
            .from('players')
            .select('sleeper_id, name, position, team')
            .limit(5);

        // Get players matching "jefferson" with service client
        const { data: jeffersonPlayers, error: jeffError } = await serviceSupabase
            .from('players')
            .select('sleeper_id, name, position, team')
            .ilike('name', '%jefferson%');

        return NextResponse.json({
            regularClient: {
                totalCount: regularCount,
                samplePlayers: regularPlayers || [],
                error: regularCountError?.message || regularError?.message
            },
            serviceClient: {
                totalCount: serviceCount,
                samplePlayers: servicePlayers || [],
                jeffersonResults: jeffersonPlayers || [],
                error: serviceCountError?.message || serviceError?.message || jeffError?.message
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
} 