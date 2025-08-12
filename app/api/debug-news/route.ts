// app/api/debug-news/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // Get sample data to see format
        const { data: sampleNews, error } = await supabase
            .from('player_news')
            .select('player_sleeper_id, headline')
            .limit(10);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Get unique player IDs to see format
        const { data: uniqueIds } = await supabase
            .from('player_news')
            .select('player_sleeper_id')
            .limit(50);

        const uniqueSet = new Set(uniqueIds?.map(item => item.player_sleeper_id));
        const uniqueArray = Array.from(uniqueSet).slice(0, 10);

        return NextResponse.json({
            sampleNews,
            uniquePlayerIds: uniqueArray,
            totalCount: uniqueIds?.length || 0
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
}
