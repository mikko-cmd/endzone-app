// app/api/debug-player/[name]/route.ts  
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
    request: Request,
    { params }: { params: { name: string } }
) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        const { data: players, error } = await supabase
            .from('players')
            .select('sleeper_id, name, position, team')
            .ilike('name', `%${decodeURIComponent(params.name)}%`)
            .limit(5);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ players });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
}
